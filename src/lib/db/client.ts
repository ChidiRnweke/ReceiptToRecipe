import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const { Pool } = pg;

const pool = new Pool({
	connectionString: env.DATABASE_URL || 'postgresql://r2r:r2r@localhost:5432/r2r'
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;
