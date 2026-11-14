import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { applyMigration, applyMigrationsUpTo, migrationTag } from '../helpers/migrations';

/**
 * Runs the shop door migration (0014) against a list that already holds items, and checks they
 * become items a person added, with the kitchen's item key as their merge key.
 */
describe('shop door migration backfill', () => {
	let container: StartedPostgreSqlContainer;
	let pool: pg.Pool;

	async function item(): Promise<Record<string, unknown>> {
		const result = await pool.query(
			`SELECT source, merge_key, held_until, for_planned_meal_ids FROM shopping_list_items`
		);
		return result.rows[0];
	}

	beforeAll(async () => {
		container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
			.withDatabase('shop_backfill')
			.withUsername('test')
			.withPassword('test')
			.start();
		pool = new pg.Pool({ connectionString: container.getConnectionUri() });
		await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

		await applyMigrationsUpTo(pool, '0013');

		const user = await pool.query<{ id: string }>(
			`INSERT INTO users (email, name, auth_provider_id) VALUES ('noor@example.com', 'Noor', 'oauth-noor') RETURNING id`
		);
		const household = await pool.query<{ id: string }>(
			`INSERT INTO households (name) VALUES ('Noor''s kitchen') RETURNING id`
		);
		const list = await pool.query<{ id: string }>(
			`INSERT INTO shopping_lists (user_id, household_id, name) VALUES ($1, $2, 'Groceries') RETURNING id`,
			[user.rows[0].id, household.rows[0].id]
		);
		await pool.query(
			`INSERT INTO shopping_list_items (shopping_list_id, name, quantity, unit) VALUES ($1, '  Baby  Spinach ', 200, 'g')`,
			[list.rows[0].id]
		);

		await applyMigration(pool, migrationTag('0014'));
	});

	afterAll(async () => {
		await pool?.end();
		await container?.stop();
	});

	it('marks an existing item as added by hand', async () => {
		expect((await item()).source).toBe('MANUAL');
	});

	it('gives an existing item the kitchen’s item key as its merge key', async () => {
		expect((await item()).merge_key).toBe('baby spinach');
	});

	it('leaves an existing item for no planned meal', async () => {
		expect((await item()).for_planned_meal_ids).toEqual([]);
	});

	it('does not hold an existing item back', async () => {
		expect((await item()).held_until).toBeNull();
	});
});
