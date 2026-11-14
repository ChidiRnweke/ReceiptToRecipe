import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { applyMigration, applyMigrationsUpTo, migrationTag } from '../helpers/migrations';

/**
 * Runs the households migration (0012) against a database that already holds data, the way it
 * runs in production, and checks every existing user ends up in a household of one.
 */
describe('households migration backfill', () => {
	let container: StartedPostgreSqlContainer;
	let pool: pg.Pool;
	let userId: string;

	beforeAll(async () => {
		container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
			.withDatabase('backfill')
			.withUsername('test')
			.withPassword('test')
			.start();
		pool = new pg.Pool({ connectionString: container.getConnectionUri() });
		await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

		await applyMigrationsUpTo(pool, '0011');

		const user = await pool.query<{ id: string }>(
			`INSERT INTO users (email, name, auth_provider_id) VALUES ($1, $2, $3) RETURNING id`,
			['ada@example.com', 'Ada Lovelace', 'oauth-ada']
		);
		userId = user.rows[0].id;
		await pool.query(`INSERT INTO cupboard_items (user_id, item_name) VALUES ($1, 'flour')`, [
			userId
		]);
		await pool.query(`INSERT INTO receipts (user_id, image_url) VALUES ($1, '/r.jpg')`, [userId]);

		await applyMigration(pool, migrationTag('0012'));
	});

	afterAll(async () => {
		await pool?.end();
		await container?.stop();
	});

	it('gives an existing user a membership', async () => {
		const result = await pool.query(`SELECT 1 FROM household_members WHERE user_id = $1`, [userId]);

		expect(result.rowCount).toBe(1);
	});

	it("names the backfilled household after the user's kitchen", async () => {
		const result = await pool.query<{ name: string }>(`SELECT name FROM households WHERE id = $1`, [
			userId
		]);

		expect(result.rows[0]?.name).toBe("Ada Lovelace's kitchen");
	});

	it("uses the user's first name as the display name", async () => {
		const result = await pool.query<{ display_name: string }>(
			`SELECT display_name FROM household_members WHERE user_id = $1`,
			[userId]
		);

		expect(result.rows[0]?.display_name).toBe('Ada');
	});

	it("puts the user's cupboard item in their household", async () => {
		const result = await pool.query<{ household_id: string }>(
			`SELECT household_id FROM cupboard_items WHERE user_id = $1`,
			[userId]
		);

		expect(result.rows[0]?.household_id).toBe(userId);
	});

	it("puts the user's receipt in their household", async () => {
		const result = await pool.query<{ household_id: string }>(
			`SELECT household_id FROM receipts WHERE user_id = $1`,
			[userId]
		);

		expect(result.rows[0]?.household_id).toBe(userId);
	});

	it('makes household_id required once backfilled', async () => {
		const result = await pool.query<{ is_nullable: string }>(
			`SELECT is_nullable FROM information_schema.columns
			 WHERE table_name = 'receipts' AND column_name = 'household_id'`
		);

		expect(result.rows[0]?.is_nullable).toBe('NO');
	});
});
