import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { sql } from "drizzle-orm";
import * as schema from "../../src/lib/db/schema";

const { Pool } = pg;

let container: StartedPostgreSqlContainer | null = null;
let pool: pg.Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function setupTestDb() {
  if (db) return db;

  // Start PostgreSQL container with pgvector
  // Using a specific version to ensure compatibility
  container = await new PostgreSqlContainer("pgvector/pgvector:pg16")
    .withDatabase("test_r2r")
    .withUsername("test")
    .withPassword("test")
    .start();

  pool = new Pool({ connectionString: container.getConnectionUri() });
  db = drizzle(pool, { schema });

  // Enable pgvector extension (might be redundant if image has it enabled, but safe)
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

  // Run migrations
  await migrate(db, { migrationsFolder: "./drizzle" });

  return db;
}

export function getTestDb() {
  if (!db)
    throw new Error("Test DB not initialized. Call setupTestDb() first.");
  return db;
}

export async function cleanTables() {
  const _db = getTestDb();
  // Truncate all tables in correct order
  // Note: we don't truncate enums or internal migration tables
  await _db.execute(sql`TRUNCATE 
    shopping_list_items, shopping_lists,
    recipe_ingredients, saved_recipes, recipes,
    receipt_items, receipts,
    purchase_history, category_shelf_life,
    cookbook_embeddings,
    user_allergies, user_ingredient_preferences, 
    user_cuisine_preferences, user_dietary_profiles,
    user_preferences, sessions, users
    CASCADE`);
}

export async function teardownTestDb() {
  await pool?.end();
  await container?.stop();
  db = null;
  pool = null;
  container = null;
}
