import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { applyMigration, applyMigrationsUpTo, migrationTag } from '../helpers/migrations';

/**
 * Runs the kitchen events migration (0013) against a database that already holds receipts and
 * cupboard items, the way it runs in production, and checks the history is replayed as events.
 */
describe('kitchen events migration backfill', () => {
	let container: StartedPostgreSqlContainer;
	let pool: pg.Pool;
	let householdId: string;

	async function events(where = 'TRUE'): Promise<Record<string, unknown>[]> {
		const result = await pool.query(
			`SELECT kind, item_key, quantity, unit, method, household_id, expires_at::text AS expires_at
			 FROM kitchen_events WHERE ${where} ORDER BY occurred_at, kind`
		);
		return result.rows;
	}

	beforeAll(async () => {
		container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
			.withDatabase('kitchen_backfill')
			.withUsername('test')
			.withPassword('test')
			.start();
		pool = new pg.Pool({ connectionString: container.getConnectionUri() });
		await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

		await applyMigrationsUpTo(pool, '0012');

		const user = await pool.query<{ id: string }>(
			`INSERT INTO users (email, name, auth_provider_id) VALUES ('noor@example.com', 'Noor', 'oauth-noor') RETURNING id`
		);
		const userId = user.rows[0].id;
		const household = await pool.query<{ id: string }>(
			`INSERT INTO households (name) VALUES ('Noor''s kitchen') RETURNING id`
		);
		householdId = household.rows[0].id;
		await pool.query(
			`INSERT INTO household_members (household_id, user_id, display_name) VALUES ($1, $2, 'Noor')`,
			[householdId, userId]
		);
		const receipt = await pool.query<{ id: string }>(
			`INSERT INTO receipts (user_id, household_id, image_url, status, purchase_date)
			 VALUES ($1, $2, '/r.jpg', 'DONE', '2026-11-05 18:00') RETURNING id`,
			[userId, householdId]
		);
		await pool.query(
			`INSERT INTO receipt_items (receipt_id, raw_name, normalized_name, quantity, unit, unit_type, category)
			 VALUES ($1, 'SPINAZIE 400G', 'Baby  Spinach', 400, 'g', 'WEIGHT', 'produce')`,
			[receipt.rows[0].id]
		);
		await pool.query(
			`INSERT INTO cupboard_items (user_id, household_id, item_name, quantity, unit, added_date, shelf_life_days, is_depleted, updated_at)
			 VALUES ($1, $2, 'Flour', 1000, 'g', '2026-10-01 10:00', 180, true, '2026-11-01 09:00')`,
			[userId, householdId]
		);

		await applyMigration(pool, migrationTag('0013'));
	});

	afterAll(async () => {
		await pool?.end();
		await container?.stop();
	});

	it('replays a receipt line as a purchase under its normalized key', async () => {
		const rows = await events(`kind = 'BOUGHT' AND receipt_item_id IS NOT NULL`);

		expect(rows.map((row) => [row.item_key, row.quantity, row.unit])).toEqual([
			['baby spinach', '400.000', 'g']
		]);
	});

	it('replays a finished receipt as a shop closed by receipt', async () => {
		const rows = await events(`kind = 'SHOP_DONE'`);

		expect(rows.map((row) => row.method)).toEqual(['RECEIPT']);
	});

	it('replays a cupboard item as a purchase with the expiry its shelf life gives', async () => {
		const rows = await events(`kind = 'BOUGHT' AND item_key = 'flour'`);

		expect(rows[0]?.expires_at).toBe('2027-03-30 10:00:00');
	});

	it('replays a depleted cupboard item as gone', async () => {
		const rows = await events(`kind = 'CORRECTED_GONE'`);

		expect(rows.map((row) => row.item_key)).toEqual(['flour']);
	});

	it("puts every replayed event in the source row's household", async () => {
		const rows = await events();

		expect(new Set(rows.map((row) => row.household_id))).toEqual(new Set([householdId]));
	});
});
