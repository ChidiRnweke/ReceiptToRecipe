import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyMigration, applyMigrationsUpTo, migrationTag } from '../helpers/migrations';

/**
 * Runs the recipe steps migration against recipes that only have free-text instructions, the way
 * it runs in production, and checks each line becomes a step with its verb.
 */
describe('recipe steps migration backfill', () => {
	let container: StartedPostgreSqlContainer;
	let pool: pg.Pool;
	let soupId: string;
	let plainId: string;

	async function steps(recipeId: string) {
		const result = await pool.query<{ position: number; verb: string | null; text: string }>(
			`SELECT position, verb, text FROM recipe_steps WHERE recipe_id = $1 ORDER BY position`,
			[recipeId]
		);
		return result.rows;
	}

	beforeAll(async () => {
		container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
			.withDatabase('steps_backfill')
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
		const insert = (title: string, instructions: string) =>
			pool.query<{ id: string }>(
				`INSERT INTO recipes (user_id, household_id, title, instructions) VALUES ($1, $2, $3, $4) RETURNING id`,
				[user.rows[0].id, household.rows[0].id, title, instructions]
			);
		soupId = (await insert('Soup', 'Step 1: Sweat the onion\nStep 2: Simmer 10 min')).rows[0].id;
		plainId = (await insert('Toast', '1. Toast the bread.\n\n2. Saute, then serve')).rows[0].id;

		await applyMigration(pool, migrationTag('0014'));
	});

	afterAll(async () => {
		await pool?.end();
		await container?.stop();
	});

	it('makes one step per line with the vocabulary verb', async () => {
		expect((await steps(soupId)).map((step) => step.verb)).toEqual(['Sweat', 'Simmer']);
	});

	it('takes the "Step N:" prefix and the verb off the text', async () => {
		expect((await steps(soupId)).map((step) => step.text)).toEqual(['the onion', '10 min']);
	});

	it('leaves the verb empty for a word outside the vocabulary', async () => {
		expect((await steps(plainId))[0]).toEqual({
			position: 0,
			verb: null,
			text: 'Toast the bread.'
		});
	});

	it('reads "Saute," as Sauté and skips blank lines', async () => {
		expect((await steps(plainId))[1]).toEqual({ position: 1, verb: 'Sauté', text: 'then serve' });
	});

	it('ships the same block as drizzle/hand/recipe_steps.sql', () => {
		const migration = readFileSync(
			join(process.cwd(), 'drizzle', `${migrationTag('0014')}.sql`),
			'utf8'
		);
		const hand = readFileSync(join(process.cwd(), 'drizzle', 'hand', 'recipe_steps.sql'), 'utf8');

		expect(migration).toContain(hand.trim());
	});
});
