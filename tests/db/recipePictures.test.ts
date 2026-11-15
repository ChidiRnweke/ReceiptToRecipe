import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { applyMigration, applyMigrationsUpTo, migrationNamed } from '../helpers/migrations';
import { setupTestDb, cleanTables, teardownTestDb, createHouseholdFor } from '../helpers/testDb';
import { UserRepository } from '../../src/lib/repositories/UserRepositories';
import { RecipeRepository } from '../../src/lib/repositories/RecipeRepositories';

describe('RecipeRepository pictures (DB)', () => {
	let recipes: RecipeRepository;
	let userId: string;
	let householdId: string;

	const add = (title: string, imageUrl: string | null = null) =>
		recipes.create({ userId, householdId, title, instructions: 'Cook it.', imageUrl });

	beforeEach(async () => {
		const db = await setupTestDb();
		await cleanTables();
		recipes = new RecipeRepository(db);
		userId = (
			await new UserRepository(db).create({
				email: 'p@example.com',
				name: 'Pictures Test',
				authProviderId: 'oauth-p1'
			})
		).id;
		householdId = await createHouseholdFor(userId);
	});

	afterAll(async () => {
		await teardownTestDb();
	});

	it('lists recipes without a picture', async () => {
		const bare = await add('Dal');
		await add('Shakshuka', '/seed/recipes/shakshuka.webp');

		expect((await recipes.findWithoutPicture(10)).map((recipe) => recipe.id)).toEqual([bare.id]);
	});

	it('lists at most the limit', async () => {
		await add('Dal');
		await add('Bean chili');

		expect(await recipes.findWithoutPicture(1)).toHaveLength(1);
	});

	it('stores where the picture came from', async () => {
		const recipe = await add('Dal');

		await recipes.update(recipe.id, {
			imageUrl: '/uploads/recipes/a.png',
			imageSource: 'GENERATED'
		});

		expect((await recipes.findById(recipe.id))?.imageSource).toBe('GENERATED');
	});

	it('stores the photo credit', async () => {
		const credit = {
			author: 'Jane Cook',
			licence: 'CC BY-SA 4.0',
			licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
			sourceUrl: 'https://commons.wikimedia.org/wiki/File:Dal.jpg'
		};
		const recipe = await add('Dal');

		await recipes.update(recipe.id, { imageCredit: credit });

		expect((await recipes.findById(recipe.id))?.imageCredit).toEqual(credit);
	});
});

/** Runs the recipe pictures migration over recipes made before it, and checks the backfill. */
describe('recipe pictures migration backfill', () => {
	let container: StartedPostgreSqlContainer;
	let pool: pg.Pool;

	async function imageSourceOf(title: string): Promise<unknown> {
		const result = await pool.query(`SELECT image_source FROM recipes WHERE title = $1`, [title]);
		return result.rows[0].image_source;
	}

	beforeAll(async () => {
		const migration = migrationNamed('recipe_pictures');
		container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
			.withDatabase('recipe_pictures_backfill')
			.withUsername('test')
			.withPassword('test')
			.start();
		pool = new pg.Pool({ connectionString: container.getConnectionUri() });
		await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
		await applyMigrationsUpTo(pool, migration.previous.slice(0, 4));

		const user = await pool.query<{ id: string }>(
			`INSERT INTO users (email, name, auth_provider_id) VALUES ('noor@example.com', 'Noor', 'oauth-noor') RETURNING id`
		);
		const household = await pool.query<{ id: string }>(
			`INSERT INTO households (name) VALUES ('Noor''s kitchen') RETURNING id`
		);
		const insert = `INSERT INTO recipes (user_id, household_id, title, instructions, source, image_url)
			VALUES ($1, $2, $3, 'Cook it.', $4, $5)`;
		const owner = [user.rows[0].id, household.rows[0].id];
		await pool.query(insert, [...owner, 'Snapped orzo', 'SNAPPED', '/uploads/recipes/orzo.jpg']);
		await pool.query(insert, [...owner, 'Generated dal', 'GENERATED', 'data:image/png;base64,AA']);
		await pool.query(insert, [...owner, 'Bare chili', 'GENERATED', null]);

		await applyMigration(pool, migration.tag);
	});

	afterAll(async () => {
		await pool?.end();
		await container?.stop();
	});

	it('marks a snapped recipe’s picture as snapped', async () => {
		expect(await imageSourceOf('Snapped orzo')).toBe('SNAPPED');
	});

	it('marks any other picture as generated', async () => {
		expect(await imageSourceOf('Generated dal')).toBe('GENERATED');
	});

	it('leaves a recipe without a picture without a source', async () => {
		expect(await imageSourceOf('Bare chili')).toBeNull();
	});
});
