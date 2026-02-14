import { InfisicalSDK } from "@infisical/sdk";
import { randomBytes } from "crypto";
import pg from "pg";

const { Client } = pg;

/**
 * Generate a secure random password
 */
function generatePassword(length = 32) {
  return randomBytes(length).toString("hex").slice(0, length);
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
      console.log(
        `Secret '${secretKey}' already exists. Preserving existing value.`,
      );
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
    console.warn(
      `Warning: Could not set default for '${secretKey}': ${err.message}`,
    );
  }
}

/**
 * Provision database and user, then store connection string in Infisical
 */
export async function provisionDatabase() {
  console.log("Starting database provisioning...");

  // Admin Infisical credentials (for accessing PostgreSQL admin credentials)
  const adminClientId = process.env.INFISICAL_ADMIN_CLIENT_ID;
  const adminClientSecret = process.env.INFISICAL_ADMIN_CLIENT_SECRET;
  const adminProjectId = process.env.INFISICAL_ADMIN_PROJECT_ID;

  // App Infisical credentials (for upserting DATABASE_URL)
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

  // Check if DATABASE_URL already exists in app project
  console.log("Checking for existing DATABASE_URL in app project...");
  const existingDatabaseUrl = await getSecretIfExists(
    appInfisical,
    appProjectId,
    appEnvironment,
    "DATABASE_URL",
  );

  if (existingDatabaseUrl) {
    console.log(
      "DATABASE_URL already exists in Infisical. Skipping database provisioning.",
    );
    return existingDatabaseUrl;
  }

  console.log("DATABASE_URL not found. Proceeding to provision database...");

  // Fetch PostgreSQL admin credentials from admin project
  console.log("Fetching PostgreSQL admin credentials...");
  const adminSecrets = await adminInfisical.secrets().listSecrets({
    environment: appEnvironment,
    projectId: adminProjectId,
    includeImports: true,
  });

  const adminSecretMap = {};
  adminSecrets.secrets.forEach(
    (s) => (adminSecretMap[s.secretKey] = s.secretValue),
  );

  const adminUser = adminSecretMap["POSTGRES_ADMIN_USER"];
  const adminPassword = adminSecretMap["POSTGRES_ADMIN_PASSWORD"];
  const postgresHost = adminSecretMap["POSTGRES_HOST"];
  const postgresPort = adminSecretMap["POSTGRES_PORT"];

  if (!adminUser || !adminPassword) {
    throw new Error(
      "Missing POSTGRES_ADMIN_USER or POSTGRES_ADMIN_PASSWORD in admin Infisical project",
    );
  }

  if (!postgresHost) {
    throw new Error("Missing POSTGRES_HOST in admin Infisical project");
  }

  const port = postgresPort ? parseInt(postgresPort) : 5432;

  // Database name and user come from env vars (project-specific)
  const dbName = process.env.DB_NAME;
  const dbUser = process.env.DB_USER;

  if (!dbName) {
    throw new Error("Missing DB_NAME environment variable");
  }

  if (!dbUser) {
    throw new Error("Missing DB_USER environment variable");
  }

  // Connect to PostgreSQL as admin
  const adminConnectionString = `postgresql://${adminUser}:${adminPassword}@${postgresHost}:${port}/postgres`;

  console.log(`Connecting to PostgreSQL at ${postgresHost}:${port}...`);
  const adminClient = new Client({ connectionString: adminConnectionString });

  try {
    await adminClient.connect();

    const dbPassword = generatePassword(32);

    console.log(`Checking if database '${dbName}' exists...`);
    const dbCheckResult = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );

    if (dbCheckResult.rows.length === 0) {
      console.log(`Creating database '${dbName}'...`);
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database '${dbName}' created successfully.`);
    } else {
      console.log(`Database '${dbName}' already exists.`);
    }

    console.log(`Checking if user '${dbUser}' exists...`);
    const userCheckResult = await adminClient.query(
      "SELECT 1 FROM pg_roles WHERE rolname = $1",
      [dbUser],
    );

    if (userCheckResult.rows.length === 0) {
      console.log(`Creating user '${dbUser}'...`);
      await adminClient.query(
        `CREATE USER "${dbUser}" WITH PASSWORD '${dbPassword}'`,
      );
      console.log(`User '${dbUser}' created successfully.`);
    } else {
      console.log(`User '${dbUser}' already exists. Updating password...`);
      await adminClient.query(
        `ALTER USER "${dbUser}" WITH PASSWORD '${dbPassword}'`,
      );
      console.log(`User '${dbUser}' password updated.`);
    }

    // Grant privileges - make user the owner for full control
    console.log(
      `Granting privileges on database '${dbName}' to user '${dbUser}'...`,
    );
    await adminClient.query(`ALTER DATABASE "${dbName}" OWNER TO "${dbUser}"`);
    await adminClient.query(
      `GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${dbUser}"`,
    );

    console.log(`Reconnecting to '${dbName}' to grant schema privileges...`);

    const appDbConnectionString = `postgresql://${adminUser}:${adminPassword}@${postgresHost}:${port}/${dbName}`;
    const appDbClient = new Client({ connectionString: appDbConnectionString });

    try {
      await appDbClient.connect();

      // Grant schema privileges
      console.log(`Granting schema privileges on '${dbName}'...`);
      await appDbClient.query(`GRANT ALL ON SCHEMA public TO "${dbUser}"`);
      await appDbClient.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${dbUser}"`,
      );
      await appDbClient.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${dbUser}"`,
      );

      // Hardening: Revoke CREATE from public to prevent other users from creating tables
      await appDbClient.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);

      console.log("Database privileges granted successfully.");
    } finally {
      await appDbClient.end();
    }

    // Create connection string
    const databaseUrl = `postgresql://${dbUser}:${dbPassword}@${postgresHost}:${port}/${dbName}`;

    // Store credentials in app Infisical project
    console.log("Storing database credentials in app Infisical project...");

    // For CREDENTIALS (DATABASE_URL): We MUST overwrite because we just generated a new password
    await updateOrCreateSecret(
      appInfisical,
      appProjectId,
      appEnvironment,
      "DATABASE_URL",
      databaseUrl,
    );

    // For CONFIG: Only create if missing (Don't overwrite manual changes)
    await createSecretOnly(
      appInfisical,
      appProjectId,
      appEnvironment,
      "DB_HOST",
      postgresHost,
    );
    await createSecretOnly(
      appInfisical,
      appProjectId,
      appEnvironment,
      "DB_PORT",
      port.toString(),
    );
    await createSecretOnly(
      appInfisical,
      appProjectId,
      appEnvironment,
      "DB_NAME",
      dbName,
    );
    await createSecretOnly(
      appInfisical,
      appProjectId,
      appEnvironment,
      "DB_USER",
      dbUser,
    );

    console.log("Database provisioning completed successfully!");
    return databaseUrl;
  } finally {
    await adminClient.end();
  }
}

// Run directly if called as script
if (import.meta.url === `file://${process.argv[1]}`) {
  provisionDatabase()
    .then((databaseUrl) => {
      console.log("Provisioned database URL:", databaseUrl);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Database provisioning failed:", err);
      process.exit(1);
    });
}
