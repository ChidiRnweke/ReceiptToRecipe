import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { applyMigration, applyMigrationsUpTo, migrationTag } from '../helpers/migrations';

/**
 * Runs the use-it-up migration (0017) over a kitchen log written before purchases carried a
 * name, and checks each purchase gets the name of its receipt line or cupboard row.
 */
describe('use it up migration backfill', () => {
	let container: StartedPostgreSqlContainer;
	let pool: pg.Pool;

	async function nameOf(itemKey: string): Promise<unknown> {
		const result = await pool.query(
			`SELECT payload->>'name' AS name FROM kitchen_events WHERE item_key = $1`,
			[itemKey]
		);
		return result.rows[0].name;
	}

	beforeAll(async () => {
		container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
			.withDatabase('use_it_up_backfill')
			.withUsername('test')
			.withPassword('test')
			.start();
		pool = new pg.Pool({ connectionString: container.getConnectionUri() });
		await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
		await applyMigrationsUpTo(pool, '0016');

		const user = await pool.query<{ id: string }>(
			`INSERT INTO users (email, name, auth_provider_id) VALUES ('noor@example.com', 'Noor', 'oauth-noor') RETURNING id`
		);
		const userId = user.rows[0].id;
		const household = await pool.query<{ id: string }>(
			`INSERT INTO households (name) VALUES ('Noor''s kitchen') RETURNING id`
		);
		const householdId = household.rows[0].id;
		const receipt = await pool.query<{ id: string }>(
			`INSERT INTO receipts (user_id, household_id, image_url, status) VALUES ($1, $2, 'mock://r.jpg', 'DONE') RETURNING id`,
			[userId, householdId]
		);
		const line = await pool.query<{ id: string }>(
			`INSERT INTO receipt_items (receipt_id, raw_name, normalized_name, quantity, unit, unit_type)
			 VALUES ($1, 'CHERRY TOM 250G', 'Cherry tomatoes', 250, 'g', 'WEIGHT') RETURNING id`,
			[receipt.rows[0].id]
		);
		const row = await pool.query<{ id: string }>(
			`INSERT INTO cupboard_items (user_id, household_id, item_name) VALUES ($1, $2, 'Free-range eggs') RETURNING id`,
			[userId, householdId]
		);
		const insert = `INSERT INTO kitchen_events (household_id, actor_user_id, occurred_at, kind, item_key, receipt_item_id, cupboard_item_id, payload)
			VALUES ($1, $2, now(), 'BOUGHT', $3, $4, $5, $6)`;
		await pool.query(insert, [householdId, userId, 'cherry tomatoes', line.rows[0].id, null, null]);
		await pool.query(insert, [
			householdId,
			userId,
			'free-range eggs',
			null,
			row.rows[0].id,
			{ category: 'dairy' }
		]);
		await pool.query(insert, [householdId, userId, 'oat', line.rows[0].id, null, { name: 'Oats' }]);
		await pool.query(insert, [householdId, userId, 'flour', null, null, null]);

		await applyMigration(pool, migrationTag('0017'));
	});

	afterAll(async () => {
		await pool?.end();
		await container?.stop();
	});

	it('names a receipt purchase after its receipt line', async () => {
		expect(await nameOf('cherry tomatoes')).toBe('Cherry tomatoes');
	});

	it('names a cupboard purchase after its cupboard row', async () => {
		expect(await nameOf('free-range eggs')).toBe('Free-range eggs');
	});

	it('keeps what the payload already held', async () => {
		const result = await pool.query(
			`SELECT payload->>'category' AS category FROM kitchen_events WHERE item_key = 'free-range eggs'`
		);
		expect(result.rows[0].category).toBe('dairy');
	});

	it('keeps a name the event already had', async () => {
		expect(await nameOf('oat')).toBe('Oats');
	});

	it('leaves a purchase with no line or row unnamed', async () => {
		expect(await nameOf('flour')).toBeNull();
	});

	it('creates the household events table', async () => {
		const result = await pool.query(`SELECT count(*)::int AS n FROM household_events`);
		expect(result.rows[0].n).toBe(0);
	});

	it('ships the same block as drizzle/hand/use_it_up.sql', () => {
		const migration = readFileSync(
			join(process.cwd(), 'drizzle', `${migrationTag('0017')}.sql`),
			'utf8'
		);
		const hand = readFileSync(join(process.cwd(), 'drizzle', 'hand', 'use_it_up.sql'), 'utf8');
		expect(migration).toContain(hand.trim());
	});
});
