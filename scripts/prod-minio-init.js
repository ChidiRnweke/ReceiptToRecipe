import { InfisicalSDK } from "@infisical/sdk";
import * as Minio from "minio";
import { provisionMinio } from "./provision-minio.js";

async function run() {
  console.log("Starting MinIO init script...");

  // Step 1: Provision MinIO if needed
  // (This is safe: it returns early if secrets exist)
  console.log("Step 1: Provisioning MinIO...");
  let minioCreds;
  try {
    minioCreds = await provisionMinio();
    console.log("MinIO provisioning completed.");
  } catch (err) {
    console.error("MinIO provisioning failed:", err);
    process.exit(1);
  }

  // Step 2: Fetch Secrets from Infisical
  console.log("Step 2: Fetching secrets from Infisical...");
  const clientId = process.env.INFISICAL_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
  const projectId = process.env.INFISICAL_PROJECT_ID;

  if (!clientId || !clientSecret || !projectId) {
    console.error(
      "Missing Infisical credentials (CLIENT_ID, CLIENT_SECRET, PROJECT_ID)",
    );
    process.exit(1);
  }

  const client = new InfisicalSDK({ siteUrl: process.env.INFISICAL_URL });
  await client.auth().universalAuth.login({ clientId, clientSecret });
  const secrets = await client.secrets().listSecrets({
    environment: process.env.INFISICAL_ENVIRONMENT || "prod",
    projectId,
    includeImports: true,
  });

  const secretMap = {};
  secrets.secrets.forEach((s) => (secretMap[s.secretKey] = s.secretValue));

  // Step 3: Configure MinIO Client
  console.log("Step 3: Configuring MinIO client...");
  const endPoint =
    secretMap["MINIO_ENDPOINT"] || process.env.MINIO_ENDPOINT || "minio";
  const port = parseInt(
    secretMap["MINIO_PORT"] || process.env.MINIO_PORT || "9000",
  );
  const useSSL =
    (secretMap["MINIO_USE_SSL"] || process.env.MINIO_USE_SSL) === "true";
  const accessKey =
    minioCreds?.accessKey ||
    secretMap["MINIO_ACCESS_KEY"] ||
    process.env.MINIO_ACCESS_KEY;
  const secretKey =
    minioCreds?.secretKey ||
    secretMap["MINIO_SECRET_KEY"] ||
    process.env.MINIO_SECRET_KEY;
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

  // Step 4: Verify bucket ONLY (Do not touch Policy)
  try {
    console.log(`Verifying bucket '${bucketName}' exists...`);
    const exists = await minioClient.bucketExists(bucketName);
    if (exists) {
      console.log(`Bucket '${bucketName}' verified.`);
    } else {
      console.log(`Creating bucket '${bucketName}'...`);
      await minioClient.makeBucket(bucketName);
      console.log(`Bucket '${bucketName}' created.`);
    }

    console.log("MinIO initialization completed successfully!");
  } catch (err) {
    console.error("MinIO initialization failed:", err);
    process.exit(1);
  }
}

run();
