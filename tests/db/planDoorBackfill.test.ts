import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { applyMigration, applyMigrationsUpTo, migrationTag } from '../helpers/migrations';

/**
 * Runs the plan door migration (0014) over meals that were cooked with portions put aside, and
 * checks those portions become the meals' extra portions.
 */
describe('plan door migration backfill', () => {
	let container: StartedPostgreSqlContainer;
	let pool: pg.Pool;
	let cookedId: string;
	let plainId: string;

	async function extraPortions(id: string): Promise<number> {
		const result = await pool.query(`SELECT extra_portions FROM planned_meals WHERE id = $1`, [id]);
		return result.rows[0].extra_portions;
	}

	beforeAll(async () => {
		container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
			.withDatabase('plan_backfill')
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
		const meal = (name: string) =>
			pool.query<{ id: string }>(
				`INSERT INTO planned_meals (user_id, household_id, meal_name, planned_date, planned_calories, meal_type)
				 VALUES ($1, $2, $3, now(), 600, 'DINNER') RETURNING id`,
				[user.rows[0].id, household.rows[0].id, name]
			);
		cookedId = (await meal('Chickpea curry')).rows[0].id;
		plainId = (await meal('Omelette')).rows[0].id;
		const cooked = `INSERT INTO kitchen_events (household_id, actor_user_id, occurred_at, kind, planned_meal_id, portions)
			VALUES ($1, $2, now(), 'COOKED', $3, $4)`;
		await pool.query(cooked, [household.rows[0].id, user.rows[0].id, cookedId, 2]);
		await pool.query(cooked, [household.rows[0].id, user.rows[0].id, plainId, null]);

		await applyMigration(pool, migrationTag('0014'));
	});

	afterAll(async () => {
		await pool?.end();
		await container?.stop();
	});

	it('gives a meal cooked with portions put aside that many extra portions', async () => {
		expect(await extraPortions(cookedId)).toBe(2);
	});

	it('leaves a meal cooked without leftovers at no extra portions', async () => {
		expect(await extraPortions(plainId)).toBe(0);
	});
});
