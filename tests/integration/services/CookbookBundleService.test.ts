import { beforeEach, describe, expect, it } from 'vitest';
import { CookbookBundleService } from '../../../src/lib/services/CookbookBundleService';
import type { CookbookBundleFiles } from '../../../src/lib/services/interfaces/ICookbook';
import { InMemoryCookbookRecipeRepository } from '../../fakes/InMemoryCookbookRecipeRepository';
import { cookbookRow, cookbookStructure } from '../../fakes/cookbook';
import { MockStorageService } from '../../mocks';

/** A bundle held in memory, by path. */
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

/** "Shrinks" a picture by marking it, so a test can tell the bundle's copy from the stored one. */
const shrink = async (picture: Buffer) => Buffer.concat([Buffer.from('small:'), picture]);
const MODELS = { text: 'qwen3.8-27b-splash' };

describe('CookbookBundleService', () => {
	let source: InMemoryCookbookRecipeRepository;
	let sourceStorage: MockStorageService;
	let target: InMemoryCookbookRecipeRepository;
	let targetStorage: MockStorageService;
	let bundle: MemoryBundle;

	const exportBundle = () =>
		new CookbookBundleService(source, sourceStorage).export(bundle, { shrink, models: MODELS });
	const load = () => new CookbookBundleService(target, targetStorage).load(bundle);

	beforeEach(async () => {
		source = new InMemoryCookbookRecipeRepository();
		sourceStorage = new MockStorageService();
		target = new InMemoryCookbookRecipeRepository();
		targetStorage = new MockStorageService();
		bundle = new MemoryBundle();

		const soup = await source.upsert({
			...cookbookRow(cookbookStructure('Tomato Soup', ['tomato', 'onion']), 101),
			structuredBy: 'model',
			embedding: [0.1, 0.2, 0.3]
		});
		const upload = await sourceStorage.upload(
			Buffer.from('png'),
			'soup.png',
			'image/png',
			'recipes'
		);
		await source.updatePicture(soup.id, {
			imageUrl: upload.url,
			imageStatus: 'DONE',
			imageSource: 'GENERATED',
			imageCredit: null,
			pictureStyle: 2
		});
		await source.updatePictureCaption(soup.id, 'A bowl of red soup with a swirl of cream.');
		await source.upsert(cookbookRow(cookbookStructure('Plain Rice', ['rice']), 102));
	});

	describe('export', () => {
		it('writes one catalog line per recipe', async () => {
			await exportBundle();
			expect(String(bundle.files.get('catalog.jsonl')).trim().split('\n')).toHaveLength(2);
		});

		it('writes the shrunk picture under the page id', async () => {
			await exportBundle();
			expect(String(bundle.files.get('pictures/101.webp'))).toBe('small:png');
		});

		it('counts recipes, pictures and embeddings in the manifest', async () => {
			const manifest = await exportBundle();
			expect([manifest.recipes, manifest.pictures, manifest.embedded]).toEqual([2, 1, 1]);
		});

		it('names both licences in the manifest', async () => {
			const manifest = await exportBundle();
			expect(manifest.licences).toEqual({
				text: 'CC BY-SA 4.0',
				pictures: 'FLUX Kommunity License'
			});
		});
	});

	describe('load into an empty catalog', () => {
		it('inserts every recipe', async () => {
			await exportBundle();
			expect((await load()).inserted).toBe(2);
		});

		it('keeps the structured recipe', async () => {
			await exportBundle();
			await load();
			expect((await target.findByPageId(101))?.recipe).toEqual(
				(await source.findByPageId(101))?.recipe
			);
		});

		it('keeps the picture caption', async () => {
			await exportBundle();
			await load();
			expect((await target.findByPageId(101))?.recipe.pictureCaption).toBe(
				'A bowl of red soup with a swirl of cream.'
			);
		});

		it('keeps the picture style', async () => {
			await exportBundle();
			await load();
			expect((await target.findByPageId(101))?.recipe.pictureStyle).toBe(2);
		});

		it('keeps the embedding', async () => {
			await exportBundle();
			await load();
			expect((await target.listForBundle(100, 1))[0].embedding).toEqual([0.1, 0.2, 0.3]);
		});

		it('stores the picture through the storage service', async () => {
			await exportBundle();
			await load();
			const stored = await target.findByPageId(101);
			const key = stored!.imageUrl!.replace('mock://', '');
			expect(String(targetStorage.getStored(key))).toBe('small:png');
		});

		it('marks the stored picture as generated', async () => {
			await exportBundle();
			await load();
			expect((await target.findByPageId(101))?.imageSource).toBe('GENERATED');
		});

		it('leaves a recipe without a picture without one', async () => {
			await exportBundle();
			await load();
			expect((await target.findByPageId(102))?.imageUrl).toBeNull();
		});
	});

	describe('a second load of the same bundle', () => {
		it('changes nothing', async () => {
			await exportBundle();
			await load();
			const again = await load();
			expect(again.inserted + again.updated + again.pictures).toBe(0);
		});

		it('keeps the first picture', async () => {
			await exportBundle();
			await load();
			const first = (await target.findByPageId(101))?.imageUrl;
			await load();
			expect((await target.findByPageId(101))?.imageUrl).toBe(first);
		});
	});

	describe('a bundle with regenerated pictures', () => {
		async function loadThenRegenerate() {
			const soup = (await source.findByPageId(101))!;
			await source.updatePicture(soup.id, { pictureStyle: 1 });
			await exportBundle();
			await load();
			await source.updatePicture(soup.id, { pictureStyle: 2 });
			await exportBundle();
		}

		it('stores the new picture again', async () => {
			await loadThenRegenerate();
			expect((await load()).pictures).toBe(1);
		});
	});

	describe('a bundle with a newer revision', () => {
		it('updates the stored page', async () => {
			await exportBundle();
			await load();
			await source.upsert({
				...cookbookRow(cookbookStructure('Plain Rice', ['rice', 'salt']), 102),
				revisionId: 2
			});
			await exportBundle();
			expect((await load()).updated).toBe(1);
		});
	});

	describe('a damaged bundle', () => {
		it('is refused when the catalog does not match the checksum', async () => {
			await exportBundle();
			bundle.files.set('catalog.jsonl', Buffer.from('{}\n'));
			await expect(load()).rejects.toThrow('checksum');
		});

		it('loads nothing then', async () => {
			await exportBundle();
			bundle.files.set('catalog.jsonl', Buffer.from('{}\n'));
			await load().catch(() => undefined);
			expect(await target.count()).toBe(0);
		});
	});
});
