import { InfisicalSDK } from "@infisical/sdk";
import { env } from "$env/dynamic/private";
import dotenv from "dotenv";

export class ConfigService {
  private static instance: ConfigService;
  private cache: Map<string, string> = new Map();
  private lastFetch: number = 0;
  private readonly TTL = 5 * 60 * 1000; // 5 minutes
  private isInitialized = false;

  private constructor() {}

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  async init() {
    if (this.isInitialized) return;
    dotenv.config();

    // Initial fetch
    await this.refreshSecrets();

    // Set up polling
    setInterval(() => {
      this.refreshSecrets().catch(console.error);
    }, this.TTL);

    this.isInitialized = true;
    console.log("ConfigService initialized with Infisical polling");
  }

  private async refreshSecrets() {
    // Check credentials
    const clientId = process.env.INFISICAL_CLIENT_ID;
    const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
    const projectId = process.env.INFISICAL_PROJECT_ID;

    if (!clientId || !clientSecret) {
      console.warn(
        "Infisical credentials (CLIENT_ID, CLIENT_SECRET) not found, skipping secret fetch",
      );
      return;
    }

    if (!projectId) {
      console.error("INFISICAL_PROJECT_ID is missing");
      return;
    }

    const environment = process.env.INFISICAL_ENVIRONMENT || "prod";
    const siteUrl = process.env.INFISICAL_URL;

    console.log(`Fetching secrets from Infisical...`);
    console.log(`Site: ${siteUrl}`);
    console.log(`Project: ${projectId}`);
    console.log(`Environment: ${environment}`);

    try {
      const client = new InfisicalSDK({
        siteUrl,
      });

      await client.auth().universalAuth.login({
        clientId,
        clientSecret,
      });

      const secrets = await client.secrets().listSecrets({
        environment,
        projectId,
        secretPath: "/", // Explicitly set root path
        includeImports: false, // Disable imports to avoid 403 Forbidden errors if lacking permissions
      });

      // Update cache
      secrets.secrets.forEach((secret) => {
        this.cache.set(secret.secretKey, secret.secretValue);
        process.env[secret.secretKey] = secret.secretValue;
      });

      this.lastFetch = Date.now();
      console.log(
        `Secrets refreshed successfully at ${new Date().toISOString()}. Count: ${secrets.secrets.length}`,
      );
    } catch (err) {
      console.error("Failed to refresh secrets from Infisical:", err);
    }
  }

  static get(key: string): string | undefined {
    const instance = ConfigService.getInstance();
    // Prioritize Infisical cache
    if (instance.cache.has(key)) {
      return instance.cache.get(key);
    }

    // Fallback to SvelteKit dynamic env or process.env
    return env[key] || process.env[key];
  }
}
