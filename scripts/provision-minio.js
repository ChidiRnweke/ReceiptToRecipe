import { InfisicalSDK } from '@infisical/sdk';
import { randomBytes, createHmac, createHash } from 'crypto';
import * as Minio from 'minio';

// --- CONFIGURATION ---
const ALGORITHM = 'AWS4-HMAC-SHA256';
const REGION = 'us-east-1'; // MinIO defaults to this region
const SERVICE = 's3';

/**
 * --- UTILITIES ---
 */

function generateAccessKey() {
	return randomBytes(16).toString('hex').slice(0, 20).toUpperCase();
}

function generateSecretKey() {
	return randomBytes(32).toString('base64').slice(0, 40);
}

function sha256(str) {
	return createHash('sha256').update(str).digest('hex');
}

function hmac(key, str) {
	return createHmac('sha256', key).update(str).digest();
}

/**
 * Helper to sign and execute requests against MinIO Admin API (SigV4)
 */
async function makeMinioAdminRequest(method, path, queryParams, body, config) {
	const { host, port, accessKey, secretKey, useSSL } = config;

	// 1. Prepare Date & Payload
	const now = new Date();
	const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
	const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

	const payload = typeof body === 'string' ? body : JSON.stringify(body || '');
	const payloadHash = sha256(payload);

	// 2. Canonical Request
	const canonicalUri = path;
	const canonicalQuery = new URLSearchParams(queryParams).toString(); // Sorted by default
	const endpoint = `${host}:${port}`;
	const headers = {
		host: endpoint,
		'x-amz-content-sha256': payloadHash,
		'x-amz-date': amzDate
	};

	const canonicalHeaders = Object.entries(headers)
		.map(([k, v]) => `${k}:${v}\n`)
		.join('');
	const signedHeaders = Object.keys(headers).join(';');

	const canonicalRequest = [
		method,
		canonicalUri,
		canonicalQuery,
		canonicalHeaders,
		signedHeaders,
		payloadHash
	].join('\n');

	// 3. String to Sign
	const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
	const stringToSign = [ALGORITHM, amzDate, credentialScope, sha256(canonicalRequest)].join('\n');

	// 4. Calculate Signature
	const kDate = hmac('AWS4' + secretKey, dateStamp);
	const kRegion = hmac(kDate, REGION);
	const kService = hmac(kRegion, SERVICE);
	const kSigning = hmac(kService, 'aws4_request');
	const signature = hmac(kSigning, stringToSign).toString('hex');

	// 5. Execute Request
	const protocol = useSSL ? 'https' : 'http';
	const fullUrl = `${protocol}://${endpoint}${path}?${canonicalQuery}`;

	const authHeader = `${ALGORITHM} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

	const fetchHeaders = {
		...headers,
		Authorization: authHeader,
		'Content-Type': 'application/json'
	};

	const response = await fetch(fullUrl, {
		method,
		headers: fetchHeaders,
		body: payload
	});

	if (!response.ok) {
		const text = await response.text();
		// 409 usually means "Already Exists", which we treat as success-ish
		if (response.status === 409) return { status: 409, data: text };
		throw new Error(`MinIO Admin API Error (${response.status}): ${text}`);
	}

	return { status: response.status, data: await response.json() };
}

/**
 * --- INFISICAL HELPERS ---
 */

async function connectToInfisical(clientId, clientSecret, siteUrl) {
	const client = new InfisicalSDK({ siteUrl });
	await client.auth().universalAuth.login({ clientId, clientSecret });
	return client;
}

async function getSecretIfExists(client, projectId, environment, secretKey) {
	try {
		const secret = await client.secrets().getSecret({
			projectId,
			environment,
			secretName: secretKey
		});
		return secret ? secret.secretValue : null;
	} catch (err) {
		// 404/Not Found is expected if it doesn't exist
		return null;
	}
}

async function updateOrCreateSecret(client, projectId, environment, secretKey, secretValue) {
	try {
		// Try update first
		await client.secrets().updateSecret(secretKey, {
			projectId,
			environment,
			secretValue
		});
		console.log(`Updated '${secretKey}'`);
	} catch (err) {
		// If update fails, create
		try {
			await client.secrets().createSecret(secretKey, {
				projectId,
				environment,
				secretValue
			});
			console.log(`Created '${secretKey}'`);
		} catch (createErr) {
			throw new Error(`Failed to save '${secretKey}': ${createErr.message}`);
		}
	}
}

async function createSecretOnly(client, projectId, environment, secretKey, secretValue) {
	const existing = await getSecretIfExists(client, projectId, environment, secretKey);
	if (existing) {
		console.log(`'${secretKey}' exists. Skipping.`);
		return;
	}

	try {
		await client.secrets().createSecret(secretKey, {
			projectId,
			environment,
			secretValue
		});
		console.log(`Created default '${secretKey}'`);
	} catch (err) {
		console.warn(`Could not set default '${secretKey}': ${err.message}`);
	}
}

/**
 * --- MINIO PROVISIONING ---
 */

async function createServiceAccount(adminConfig, newAccessKey, newSecretKey, bucketName) {
	console.log(`Creating Service Account for bucket: ${bucketName}...`);

	// Policy: Allow all S3 actions only on the specific bucket
	const policy = {
		Version: '2012-10-17',
		Statement: [
			{
				Effect: 'Allow',
				Action: ['s3:*'],
				Resource: [`arn:aws:s3:::${bucketName}`, `arn:aws:s3:::${bucketName}/*`]
			}
		]
	};

	try {
		const result = await makeMinioAdminRequest(
			'PUT',
			'/minio/admin/v3/add-service-account',
			{}, // Query params
			{
				accessKey: newAccessKey,
				secretKey: newSecretKey,
				policy: JSON.stringify(policy)
			},
			adminConfig
		);

		if (result.status === 200) {
			console.log('Service Account created successfully.');
		} else if (result.status === 409) {
			console.log('Service Account already exists. Proceeding.');
		}

		return true;
	} catch (err) {
		console.error('Failed to create service account via Admin API:', err.message);
		return false;
	}
}

export async function provisionMinio() {
	console.log('--- Starting MinIO Provisioning ---');

	// 1. Load Env & Clients
	const {
		INFISICAL_ADMIN_CLIENT_ID,
		INFISICAL_ADMIN_CLIENT_SECRET,
		INFISICAL_ADMIN_PROJECT_ID,
		INFISICAL_CLIENT_ID,
		INFISICAL_CLIENT_SECRET,
		INFISICAL_PROJECT_ID,
		INFISICAL_ENVIRONMENT,
		INFISICAL_URL,
		MINIO_BUCKET
	} = process.env;

	if (!MINIO_BUCKET) throw new Error('Missing MINIO_BUCKET env var');

	const adminClient = await connectToInfisical(
		INFISICAL_ADMIN_CLIENT_ID,
		INFISICAL_ADMIN_CLIENT_SECRET,
		INFISICAL_URL
	);
	const appClient = await connectToInfisical(
		INFISICAL_CLIENT_ID,
		INFISICAL_CLIENT_SECRET,
		INFISICAL_URL
	);

	// 2. Check if App already has credentials
	const existingAccess = await getSecretIfExists(
		appClient,
		INFISICAL_PROJECT_ID,
		INFISICAL_ENVIRONMENT,
		'MINIO_ACCESS_KEY'
	);
	const existingSecret = await getSecretIfExists(
		appClient,
		INFISICAL_PROJECT_ID,
		INFISICAL_ENVIRONMENT,
		'MINIO_SECRET_KEY'
	);

	if (existingAccess && existingSecret) {
		console.log('MinIO credentials already exist in App project. Done.');
		return { accessKey: existingAccess, secretKey: existingSecret };
	}

	// 3. Get Admin Credentials
	console.log('Fetching MinIO admin credentials from Infisical...');
	const adminSecretValue = await getSecretIfExists(
		adminClient,
		INFISICAL_ADMIN_PROJECT_ID,
		INFISICAL_ENVIRONMENT,
		'MINIO_ADMIN_PASS'
	);
	const adminUser = await getSecretIfExists(
		adminClient,
		INFISICAL_ADMIN_PROJECT_ID,
		INFISICAL_ENVIRONMENT,
		'MINIO_ADMIN_USER'
	);
	const minioHost = await getSecretIfExists(
		adminClient,
		INFISICAL_ADMIN_PROJECT_ID,
		INFISICAL_ENVIRONMENT,
		'MINIO_HOST'
	);
	const minioPortStr = await getSecretIfExists(
		adminClient,
		INFISICAL_ADMIN_PROJECT_ID,
		INFISICAL_ENVIRONMENT,
		'MINIO_PORT'
	);
	const minioPort = parseInt(minioPortStr || '9000');
	const useSSL =
		(await getSecretIfExists(
			adminClient,
			INFISICAL_ADMIN_PROJECT_ID,
			INFISICAL_ENVIRONMENT,
			'MINIO_USE_SSL'
		)) === 'true';

	// Validate required admin secrets
	if (!adminUser || !adminSecretValue) {
		throw new Error('Missing MINIO_ADMIN_USER or MINIO_ADMIN_PASS in admin Infisical project');
	}
	if (!minioHost) {
		throw new Error('Missing MINIO_HOST in admin Infisical project');
	}

	const adminConfig = {
		host: minioHost,
		port: minioPort,
		accessKey: adminUser,
		secretKey: adminSecretValue,
		useSSL
	};

	// 4. Initialize MinIO Client (Data Plane)
	const minioClient = new Minio.Client({
		endPoint: minioHost,
		port: minioPort,
		useSSL: useSSL,
		accessKey: adminUser,
		secretKey: adminSecretValue
	});

	// 5. Ensure Bucket Exists
	const bucketExists = await minioClient.bucketExists(MINIO_BUCKET);
	if (!bucketExists) {
		await minioClient.makeBucket(MINIO_BUCKET, REGION);
		console.log(`Created bucket: ${MINIO_BUCKET}`);
	}

	// 6. Create Service Account (Control Plane)
	const newAccessKey = generateAccessKey();
	const newSecretKey = generateSecretKey();

	const saSuccess = await createServiceAccount(
		adminConfig,
		newAccessKey,
		newSecretKey,
		MINIO_BUCKET
	);

	let finalAccess = newAccessKey;
	let finalSecret = newSecretKey;

	if (!saSuccess) {
		console.warn(
			'FALLBACK: Could not create Service Account. Using Admin credentials for App (Not Recommended).'
		);
		finalAccess = adminUser;
		finalSecret = adminSecretValue;
	}

	// 7. Save to Infisical
	console.log('Saving credentials to Infisical...');
	await updateOrCreateSecret(
		appClient,
		INFISICAL_PROJECT_ID,
		INFISICAL_ENVIRONMENT,
		'MINIO_ACCESS_KEY',
		finalAccess
	);
	await updateOrCreateSecret(
		appClient,
		INFISICAL_PROJECT_ID,
		INFISICAL_ENVIRONMENT,
		'MINIO_SECRET_KEY',
		finalSecret
	);

	// Save Configs
	await createSecretOnly(
		appClient,
		INFISICAL_PROJECT_ID,
		INFISICAL_ENVIRONMENT,
		'MINIO_ENDPOINT',
		minioHost
	);
	await createSecretOnly(
		appClient,
		INFISICAL_PROJECT_ID,
		INFISICAL_ENVIRONMENT,
		'MINIO_PORT',
		minioPort.toString()
	);
	await createSecretOnly(
		appClient,
		INFISICAL_PROJECT_ID,
		INFISICAL_ENVIRONMENT,
		'MINIO_BUCKET',
		MINIO_BUCKET
	);
	await createSecretOnly(
		appClient,
		INFISICAL_PROJECT_ID,
		INFISICAL_ENVIRONMENT,
		'MINIO_USE_SSL',
		useSSL.toString()
	);

	console.log('MinIO provisioning complete.');
	return { accessKey: finalAccess, secretKey: finalSecret };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	provisionMinio().catch((err) => {
		console.error('Fatal Error:', err);
		process.exit(1);
	});
}
