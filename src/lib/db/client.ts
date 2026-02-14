import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { ConfigService } from "$services/ConfigService";

const { Pool } = pg;

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export const getDb = () => {
  if (!dbInstance) {
    const connectionString = ConfigService.get("DATABASE_URL");
    if (!connectionString) {
      // Fallback for build time / when secrets aren't loaded yet
      // This allows the app to build without crashing, though runtime will fail if secrets are missing
      console.warn("DATABASE_URL not found, using default localhost");
    }

    const pool = new Pool({
      connectionString:
        connectionString || "postgresql://r2r:r2r@localhost:5432/r2r",
    });

    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance;
};

// Type helper
export type Database = ReturnType<typeof getDb>;
