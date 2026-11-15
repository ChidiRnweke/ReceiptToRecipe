import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTables, teardownTestDb } from '../helpers/testDb';
import { CookbookRecipeRepository } from '../../src/lib/repositories/CookbookRecipeRepository';
import { CookbookBundleService } from '../../src/lib/services/CookbookBundleService';
import type { CookbookBundleFiles } from '../../src/lib/services/interfaces/ICookbook';
import { cookbookRow, cookbookStructure } from '../fakes/cookbook';
import { InMemoryCookbookRecipeRepository } from '../fakes/InMemoryCookbookRecipeRepository';
import { MockStorageService } from '../mocks';

/** A 768-dimension vector pointing mostly along one axis. */
function axis(index: number): number[] {
	return Array.from({ length: 768 }, (_, i) => (i === index ? 1 : 0.01));
}

class MemoryBundle implements CookbookBundleFiles {
	readonly files = new Map<string, Buffer>();

	async read(path: string): Promise<Buffer> {
		const data = this.files.get(path);
		if (!data) throw new Error(`No ${path} in the bundle`);
		return data;
	}

	async write(path: string, data: Buffer | string): Promise<void> {
		this.files.set(path, Buffer.from(data));
	}
}

const filter = { tagGroups: [], avoid: [], householdId: null, limit: 10 };

/** Loading a bundle into Postgres: rows, embeddings and pictures, and loading it twice. */
describe('CookbookBundleService.load (DB)', () => {
	let catalog: CookbookRecipeRepository;
	let storage: MockStorageService;
	let bundle: MemoryBundle;

	const load = () => new CookbookBundleService(catalog, storage).load(bundle);

	beforeEach(async () => {
		const db = await setupTestDb();
		await cleanTables();
		catalog = new CookbookRecipeRepository(db);
		storage = new MockStorageService();
		bundle = new MemoryBundle();

		// The bundle is written from an in-memory catalog, as the preprocessing machine would.
		const source = new InMemoryCookbookRecipeRepository();
		const sourceStorage = new MockStorageService();
		const soup = await source.upsert({
			...cookbookRow(cookbookStructure('Tomato Soup', ['tomato', 'onion']), 201),
			structuredBy: 'model',
			embedding: axis(3)
		});
		const upload = await sourceStorage.upload(Buffer.from('png'), 's.png', 'image/png', 'recipes');
		await source.updatePicture(soup.id, {
			imageUrl: upload.url,
			imageStatus: 'DONE',
			imageSource: 'GENERATED',
			imageCredit: null
		});
		await new CookbookBundleService(source, sourceStorage).export(bundle, {
			shrink: async (picture) => picture,
			models: {}
		});
	});

	afterAll(async () => {
		await teardownTestDb();
	});

	it('stores the recipe', async () => {
		await load();
		expect((await catalog.findByPageId(201))?.title).toBe('Tomato Soup');
	});

	it('stores the embedding, so similarity search finds the recipe', async () => {
		await load();
		const found = await catalog.search({ ...filter, text: null, embedding: axis(3) });
		expect(found.map((recipe) => recipe.pageId)).toEqual([201]);
	});

	it('stores the picture as done', async () => {
		await load();
		expect((await catalog.findByPageId(201))?.imageStatus).toBe('DONE');
	});

	it('changes nothing on a second load', async () => {
		await load();
		const again = await load();
		expect(again.unchanged).toBe(1);
	});

	it('keeps one row per page after a second load', async () => {
		await load();
		await load();
		expect(await catalog.count()).toBe(1);
	});
});
