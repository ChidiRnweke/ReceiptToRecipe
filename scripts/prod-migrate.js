import { InfisicalSDK } from "@infisical/sdk";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { provisionDatabase } from "./provision-db.js";

const { Pool } = pg;

async function run() {
  console.log("Starting migration script...");

  // Step 1: Provision database if needed
  console.log("Step 1: Provisioning database...");
  let databaseUrl;
  try {
    databaseUrl = await provisionDatabase();
    console.log("Database provisioning completed.");
  } catch (err) {
    console.error("Database provisioning failed:", err);
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

  const client = new InfisicalSDK({ siteUrl: process.env.INFISICAL_SITE_URL });
  await client.auth().universalAuth.login({ clientId, clientSecret });
  const secrets = await client.secrets().listSecrets({
    environment: process.env.INFISICAL_ENVIRONMENT || "prod",
    projectId,
    includeImports: true,
  });

  const secretMap = {};
  secrets.secrets.forEach((s) => (secretMap[s.secretKey] = s.secretValue));

  console.log("Step 3: Connecting to database...");
  const connectionString =
    databaseUrl || secretMap["DATABASE_URL"] || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL not found in secrets or environment");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  // Step 4: Run Migrations
  try {
    console.log("Running migrations from ./drizzle folder...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
