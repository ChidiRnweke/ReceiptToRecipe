import { describe, it, expect, beforeEach } from 'vitest';
import { CookbookImportService } from '../../../src/lib/services/CookbookImportService';
import { InMemoryCookbookRecipeRepository } from '../../fakes/InMemoryCookbookRecipeRepository';
import {
	FakeEmbedder,
	FakeStructurer,
	FakeWikibooksClient,
	fixturePage
} from '../../fakes/wikibooks';

describe('CookbookImportService', () => {
	let repository: InMemoryCookbookRecipeRepository;
	let client: FakeWikibooksClient;
	let structurer: FakeStructurer;
	let embedder: FakeEmbedder;

	const service = () => new CookbookImportService(client, structurer, repository, embedder);

	beforeEach(() => {
		repository = new InMemoryCookbookRecipeRepository();
		client = new FakeWikibooksClient([
			fixturePage('beef-stroganoff'),
			fixturePage('akamu-no-amounts')
		]);
		structurer = new FakeStructurer();
		embedder = new FakeEmbedder();
	});

	describe('a first import', () => {
		it('imports the page with amounts and steps', async () => {
			expect((await service().import({ limit: 10 })).imported).toBe(1);
		});

		it('skips the page without amounts, saying why', async () => {
			expect((await service().import({ limit: 10 })).skipped).toEqual({ 'no-amounts': 1 });
		});

		it('stores the recipe under the page title without the namespace', async () => {
			await service().import({ limit: 10 });
			expect((await repository.findByPageId(127881))?.title).toBe('20-Minute Beef Stroganoff');
		});

		it('stores the licence', async () => {
			await service().import({ limit: 10 });
			expect((await repository.findByPageId(127881))?.licence).toBe('CC BY-SA 4.0');
		});

		it('links the page', async () => {
			await service().import({ limit: 10 });
			expect((await repository.findByPageId(127881))?.sourceUrl).toBe(
				'https://en.wikibooks.org/wiki/Cookbook:20-Minute_Beef_Stroganoff'
			);
		});

		it('reads no more pages than the limit', async () => {
			expect((await service().import({ limit: 1 })).seen).toBe(1);
		});
	});

	describe('a re-import', () => {
		it('changes nothing when the revision is the same', async () => {
			await service().import({ limit: 10 });
			const again = await service().import({ limit: 10 });
			expect(again.imported + again.updated).toBe(0);
		});

		it('counts the unchanged page as skipped', async () => {
			await service().import({ limit: 10 });
			expect((await service().import({ limit: 10 })).skipped.unchanged).toBe(1);
		});

		it('updates a page whose revision changed', async () => {
			await service().import({ limit: 10 });
			client.pages = [fixturePage('beef-stroganoff', 9_999_999)];
			expect((await service().import({ limit: 10 })).updated).toBe(1);
		});

		it('keeps one catalog recipe per page', async () => {
			await service().import({ limit: 10 });
			client.pages = [fixturePage('beef-stroganoff', 9_999_999)];
			await service().import({ limit: 10 });
			expect(await repository.count()).toBe(1);
		});
	});

	describe('a model answer that does not fit the schema', () => {
		it('skips the page as structure-invalid', async () => {
			structurer = new FakeStructurer(['20-Minute Beef Stroganoff']);
			expect((await service().import({ limit: 10 })).skipped['structure-invalid']).toBe(1);
		});

		it('stores nothing for it', async () => {
			structurer = new FakeStructurer(['20-Minute Beef Stroganoff']);
			await service().import({ limit: 10 });
			expect(await repository.count()).toBe(0);
		});
	});

	describe('the licence filter', () => {
		it('refuses to import when the wiki is not CC BY-SA', async () => {
			client.licenceAnswer = { text: 'All rights reserved', url: 'https://example.org' };
			await expect(service().import({ limit: 10 })).rejects.toThrow(/not CC BY-SA/);
		});

		it('imports nothing then', async () => {
			client.licenceAnswer = { text: 'All rights reserved', url: 'https://example.org' };
			await service()
				.import({ limit: 10 })
				.catch(() => undefined);
			expect(await repository.count()).toBe(0);
		});
	});

	describe('embeddings', () => {
		it('imports the page without one when the embedding model fails', async () => {
			embedder = new FakeEmbedder(true);
			expect((await service().import({ limit: 10 })).imported).toBe(1);
		});

		it('counts the page as unembedded', async () => {
			embedder = new FakeEmbedder(true);
			expect((await service().import({ limit: 10 })).unembedded).toBe(1);
		});

		it('stops asking after the first failure', async () => {
			embedder = new FakeEmbedder(true);
			client.pages = [fixturePage('beef-stroganoff'), fixturePage('adobo-chicken')];
			await service().import({ limit: 10 });
			expect(embedder.asked).toBe(1);
		});
	});
});
