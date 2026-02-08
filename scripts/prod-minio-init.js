import { InfisicalSDK } from "@infisical/sdk";
import * as Minio from "minio";

async function run() {
  console.log("Starting MinIO init script...");

  // 1. Fetch Secrets
  const clientId = process.env.INFISICAL_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
  const projectId = process.env.INFISICAL_PROJECT_ID;

  if (!clientId || !clientSecret || !projectId) {
    console.error("Missing Infisical credentials");
    process.exit(1);
  }

  console.log("Fetching secrets from Infisical...");
  const client = new InfisicalSDK({ siteUrl: process.env.INFISICAL_SITE_URL });
  await client.auth().universalAuth.login({ clientId, clientSecret });
  const secrets = await client.secrets().listSecrets({
    environment: process.env.INFISICAL_ENVIRONMENT || "prod",
    projectId,
    includeImports: true,
  });

  const secretMap = {};
  secrets.secrets.forEach((s) => (secretMap[s.secretKey] = s.secretValue));

  // 2. Configure MinIO Client
  const endPoint =
    secretMap["MINIO_ENDPOINT"] || process.env.MINIO_ENDPOINT || "minio";
  const port = parseInt(
    secretMap["MINIO_PORT"] || process.env.MINIO_PORT || "9000",
  );
  const useSSL =
    (secretMap["MINIO_USE_SSL"] || process.env.MINIO_USE_SSL) === "true";
  const accessKey =
    secretMap["MINIO_ACCESS_KEY"] || process.env.MINIO_ACCESS_KEY;
  const secretKey =
    secretMap["MINIO_SECRET_KEY"] || process.env.MINIO_SECRET_KEY;
  const bucketName =
    secretMap["MINIO_BUCKET"] || process.env.MINIO_BUCKET || "r2r-images";

  if (!accessKey || !secretKey) {
    console.error("Missing MINIO_ACCESS_KEY or MINIO_SECRET_KEY");
    process.exit(1);
  }

  console.log(`Connecting to MinIO at ${endPoint}:${port}...`);
  const minioClient = new Minio.Client({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  });

  // 3. Ensure Bucket Exists
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (exists) {
      console.log(`Bucket '${bucketName}' already exists.`);
    } else {
      console.log(`Creating bucket '${bucketName}'...`);
      await minioClient.makeBucket(bucketName);
      console.log(`Bucket '${bucketName}' created.`);
    }

    // 4. Set Public Policy
    console.log(`Setting public read policy for '${bucketName}'...`);
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${bucketName}/*`],
        },
      ],
    };
    await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    console.log("Bucket policy set successfully.");
  } catch (err) {
    console.error("MinIO initialization failed:", err);
    process.exit(1);
  }
}

run();
