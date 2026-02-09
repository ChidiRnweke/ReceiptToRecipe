import { InfisicalSDK } from "@infisical/sdk";
import { randomBytes } from "crypto";
import * as Minio from "minio";
import aws4 from "aws4";
import https from "https";
import http from "http";

/**
 * Generate a secure random access key (alphanumeric, 20 chars)
 */
function generateAccessKey() {
  return randomBytes(16).toString("hex").slice(0, 20);
}

/**
 * Generate a secure random secret key (alphanumeric + symbols, 40 chars)
 */
function generateSecretKey() {
  return randomBytes(32).toString("base64").slice(0, 40);
}

/**
 * Connect to Infisical and return authenticated client
 */
async function connectToInfisical(clientId, clientSecret, siteUrl) {
  const client = new InfisicalSDK({ siteUrl });
  await client.auth().universalAuth.login({ clientId, clientSecret });
  return client;
}

/**
 * Check if secret exists in Infisical project
 */
async function getSecretIfExists(client, projectId, environment, secretKey) {
  try {
    const secrets = await client.secrets().listSecrets({
      environment,
      projectId,
      includeImports: true,
    });
    const secret = secrets.secrets.find((s) => s.secretKey === secretKey);
    return secret ? secret.secretValue : null;
  } catch (err) {
    console.error(`Failed to check for existing secret: ${err.message}`);
    return null;
  }
}

/**
 * Force update or create a secret (Use this for Credentials that MUST match)
 */
async function updateOrCreateSecret(
  client,
  projectId,
  environment,
  secretKey,
  secretValue,
) {
  try {
    // Try to update first
    try {
      await client.secrets().updateSecret(secretKey, {
        environment,
        projectId,
        secretValue,
      });
      console.log(`Updated secret '${secretKey}' in Infisical`);
    } catch (updateErr) {
      // If update fails (doesn't exist), create it
      await client.secrets().createSecret(secretKey, {
        environment,
        projectId,
        secretValue,
      });
      console.log(`Created secret '${secretKey}' in Infisical`);
    }
  } catch (err) {
    throw new Error(`Failed to save secret '${secretKey}': ${err.message}`);
  }
}

/**
 * Only create secret if it doesn't exist (Use this for Config like Host/Port)
 */
async function createSecretOnly(
  client,
  projectId,
  environment,
  secretKey,
  secretValue,
) {
  try {
    // Check if it exists first to avoid errors and overwrites
    const secrets = await client.secrets().listSecrets({
      environment,
      projectId,
      includeImports: true,
    });
    
    const exists = secrets.secrets.some((s) => s.secretKey === secretKey);

    if (exists) {
      console.log(`Secret '${secretKey}' already exists. Preserving existing value.`);
      return;
    }

    // It doesn't exist, so create it
    await client.secrets().createSecret(secretKey, {
      environment,
      projectId,
      secretValue,
    });
    console.log(`Created default secret '${secretKey}' in Infisical`);
  } catch (err) {
    console.warn(`Warning: Could not set default for '${secretKey}': ${err.message}`);
  }
}

/**
 * Create a Service Account (Restricted Credentials) directly via MinIO API
 * This bypasses the need for 'mc' binary using signed HTTP requests.
 */
async function createServiceAccount(
  minioHost,
  minioPort,
  adminUser,
  adminPassword,
  newAccessKey,
  newSecretKey,
  bucketName,
  useSSL,
) {
  // Define the Policy (Restricted to this bucket only)
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: [
          "s3:ListBucket",
          "s3:GetBucketLocation",
          "s3:ListBucketMultipartUploads",
        ],
        Resource: [`arn:aws:s3:::${bucketName}`],
      },
      {
        Effect: "Allow",
        Action: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListMultipartUploadParts",
          "s3:AbortMultipartUpload",
        ],
        Resource: [`arn:aws:s3:::${bucketName}/*`],
      },
    ],
  };

  // Prepare the API Request
  const requestOptions = {
    host: minioHost,
    port: minioPort,
    method: "POST",
    path: "/?Action=CreateServiceAccount",
    service: "s3",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accessKey: newAccessKey,
      secretKey: newSecretKey,
      policy: JSON.stringify(policy),
    }),
  };

  // Sign the request using Admin Credentials (aws4)
  const signedRequest = aws4.sign(requestOptions, {
    accessKeyId: adminUser,
    secretAccessKey: adminPassword,
  });

  // Send the Request
  return new Promise((resolve, reject) => {
    const lib = useSSL ? https : http;
    const req = lib.request(signedRequest, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log("Service Account created successfully.");
          resolve(data ? JSON.parse(data) : null);
        } else if (res.statusCode === 409 || data.includes("already exists") || data.includes("Access key already exists")) {
          // Service account already exists (idempotent)
          console.log("Service Account already exists (idempotent).");
          resolve(null);
        } else {
          reject(new Error(`MinIO API Error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.write(signedRequest.body);
    req.end();
  });
}

/**
 * Provision MinIO bucket and service account, then store credentials in Infisical
 */
export async function provisionMinio() {
  console.log("Starting MinIO provisioning...");

  // Admin Infisical credentials (for accessing MinIO admin credentials)
  const adminClientId = process.env.INFISICAL_ADMIN_CLIENT_ID;
  const adminClientSecret = process.env.INFISICAL_ADMIN_CLIENT_SECRET;
  const adminProjectId = process.env.INFISICAL_ADMIN_PROJECT_ID;

  // App Infisical credentials (for upserting MINIO_ACCESS_KEY/SECRET_KEY)
  const appClientId = process.env.INFISICAL_CLIENT_ID;
  const appClientSecret = process.env.INFISICAL_CLIENT_SECRET;
  const appProjectId = process.env.INFISICAL_PROJECT_ID;
  const appEnvironment = process.env.INFISICAL_ENVIRONMENT;

  const siteUrl = process.env.INFISICAL_URL;

  if (!appEnvironment) {
    throw new Error("Missing INFISICAL_ENVIRONMENT environment variable");
  }

  // Validate all required credentials
  if (!adminClientId || !adminClientSecret || !adminProjectId || !siteUrl) {
    throw new Error(
      "Missing admin Infisical credentials (INFISICAL_ADMIN_CLIENT_ID, INFISICAL_ADMIN_CLIENT_SECRET, INFISICAL_ADMIN_PROJECT_ID, INFISICAL_URL)",
    );
  }

  if (!appClientId || !appClientSecret || !appProjectId) {
    throw new Error(
      "Missing app Infisical credentials (INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, INFISICAL_PROJECT_ID)",
    );
  }

  // Connect to both Infisical projects
  console.log("Connecting to admin Infisical project...");
  const adminInfisical = await connectToInfisical(
    adminClientId,
    adminClientSecret,
    siteUrl,
  );

  console.log("Connecting to app Infisical project...");
  const appInfisical = await connectToInfisical(
    appClientId,
    appClientSecret,
    siteUrl,
  );

  // Check if MinIO credentials already exist in app project
  console.log("Checking for existing MinIO credentials in app project...");
  const existingAccessKey = await getSecretIfExists(
    appInfisical,
    appProjectId,
    appEnvironment,
    "MINIO_ACCESS_KEY",
  );
  const existingSecretKey = await getSecretIfExists(
    appInfisical,
    appProjectId,
    appEnvironment,
    "MINIO_SECRET_KEY",
  );

  if (existingAccessKey && existingSecretKey) {
    console.log(
      "MinIO credentials already exist in Infisical. Skipping MinIO provisioning.",
    );
    return { accessKey: existingAccessKey, secretKey: existingSecretKey };
  }

  console.log("MinIO credentials not found. Proceeding to provision MinIO...");

  // Fetch MinIO admin credentials and connection config from admin project
  console.log("Fetching MinIO admin credentials...");
  const adminSecrets = await adminInfisical.secrets().listSecrets({
    environment: appEnvironment,
    projectId: adminProjectId,
    includeImports: true,
  });

  const adminSecretMap = {};
  adminSecrets.secrets.forEach(
    (s) => (adminSecretMap[s.secretKey] = s.secretValue),
  );

  const adminUser = adminSecretMap["MINIO_ADMIN_USER"];
  const adminPassword = adminSecretMap["MINIO_ADMIN_PASS"];
  const minioHost = adminSecretMap["MINIO_HOST"];
  const minioPort = adminSecretMap["MINIO_PORT"];
  const minioUseSSL = adminSecretMap["MINIO_USE_SSL"];

  if (!adminUser || !adminPassword) {
    throw new Error(
      "Missing MINIO_ADMIN_USER or MINIO_ADMIN_PASS in admin Infisical project",
    );
  }

  if (!minioHost) {
    throw new Error(
      "Missing MINIO_HOST in admin Infisical project",
    );
  }

  const port = minioPort ? parseInt(minioPort) : 9000;
  const useSSL = minioUseSSL === "true";

  // Bucket name comes from env var (project-specific)
  const bucketName = process.env.MINIO_BUCKET;
  if (!bucketName) {
    throw new Error(
      "Missing MINIO_BUCKET environment variable",
    );
  }

  // Use standard Client for Bucket Operations (Data Plane)
  console.log(`Connecting to MinIO at ${minioHost}:${port}...`);
  const minioClient = new Minio.Client({
    endPoint: minioHost,
    port: port,
    useSSL: useSSL,
    accessKey: adminUser,
    secretKey: adminPassword,
  });

  // Generate new credentials for the app
  const appAccessKey = generateAccessKey();
  const appSecretKey = generateSecretKey();

  try {
    // 1. Create Bucket (Standard SDK works fine here)
    console.log(`Checking if bucket '${bucketName}' exists...`);
    const bucketExists = await minioClient.bucketExists(bucketName);
    if (bucketExists) {
      console.log(`Bucket '${bucketName}' already exists.`);
    } else {
      console.log(`Creating bucket '${bucketName}'...`);
      await minioClient.makeBucket(bucketName);
      console.log(`Bucket '${bucketName}' created successfully.`);
    }

    // 2. Create Service Account via API (Control Plane via signed HTTP request)
    console.log(`Provisioning Service Account for '${appAccessKey}'...`);
    await createServiceAccount(
      minioHost,
      port,
      adminUser,
      adminPassword,
      appAccessKey,
      appSecretKey,
      bucketName,
      useSSL,
    );

    // 3. Store credentials in app Infisical project
    console.log("Storing MinIO credentials in app Infisical project...");
    
    // For CREDENTIALS: We MUST overwrite because we just generated new ones
    await updateOrCreateSecret(
      appInfisical,
      appProjectId,
      appEnvironment,
      "MINIO_ACCESS_KEY",
      appAccessKey,
    );
    await updateOrCreateSecret(
      appInfisical,
      appProjectId,
      appEnvironment,
      "MINIO_SECRET_KEY",
      appSecretKey,
    );

    // For CONFIG: Only create if missing (Don't overwrite manual changes)
    await createSecretOnly(
      appInfisical,
      appProjectId,
      appEnvironment,
      "MINIO_ENDPOINT",
      minioHost,
    );
    await createSecretOnly(
      appInfisical,
      appProjectId,
      appEnvironment,
      "MINIO_PORT",
      port.toString(),
    );
    await createSecretOnly(
      appInfisical,
      appProjectId,
      appEnvironment,
      "MINIO_BUCKET",
      bucketName,
    );
    await createSecretOnly(
      appInfisical,
      appProjectId,
      appEnvironment,
      "MINIO_USE_SSL",
      useSSL.toString(),
    );

    console.log("MinIO provisioning completed successfully!");
    return { accessKey: appAccessKey, secretKey: appSecretKey };
  } catch (err) {
    throw new Error(`MinIO provisioning failed: ${err.message}`);
  }
}

// Run directly if called as script
if (import.meta.url === `file://${process.argv[1]}`) {
  provisionMinio()
    .then((creds) => {
      console.log("Provisioned MinIO credentials:", creds);
      process.exit(0);
    })
    .catch((err) => {
      console.error("MinIO provisioning failed:", err);
      process.exit(1);
    });
}
