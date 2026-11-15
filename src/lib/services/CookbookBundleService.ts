import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';
import {
	COOKBOOK_BUNDLE_FORMAT,
	COOKBOOK_LICENCE,
	FLUX_PICTURE_LICENCE,
	type CookbookBundleLine,
	type CookbookBundleLoadSummary,
	type CookbookBundleManifest
} from '$lib/models/recipes';
import type { CookbookBundleRowDao, ICookbookRecipeRepository } from '$repositories';
import type {
	CookbookBundleExportOptions,
	CookbookBundleFiles,
	ICookbookBundleService
} from './interfaces/ICookbook';
import type { IStorageService } from './interfaces/IStorageService';

const CATALOG = 'catalog.jsonl';
const MANIFEST = 'manifest.json';
/** Rows read from the catalog per query while exporting. */
const EXPORT_PAGE = 200;
/** The folder recipe pictures are stored in, as RecipePictureService stores them. */
const PICTURE_FOLDER = 'recipes';

/** The storage key of a stored picture: its folder and file name, e.g. `recipes/x.png`. */
function storageKeyOf(imageUrl: string): string {
	return imageUrl.split('/').slice(-2).join('/');
}

function sha256(data: Buffer | string): string {
	return createHash('sha256').update(data).digest('hex');
}

/** A bundle unpacked in a directory on disk. */
export function directoryBundleFiles(root: string): CookbookBundleFiles {
	const inside = (path: string) => {
		const full = normalize(join(root, path));
		if (!full.startsWith(normalize(root) + sep)) throw new Error(`${path} is outside the bundle`);
		return full;
	};
	return {
		read: (path) => readFile(inside(path)),
		write: async (path, data) => {
			const full = inside(path);
			await mkdir(dirname(full), { recursive: true });
			await writeFile(full, data);
		}
	};
}

export class CookbookBundleService implements ICookbookBundleService {
	constructor(
		private repository: ICookbookRecipeRepository,
		private storage: IStorageService
	) {}

	async export(
		files: CookbookBundleFiles,
		options: CookbookBundleExportOptions
	): Promise<CookbookBundleManifest> {
		const lines: string[] = [];
		let pictures = 0;
		let embedded = 0;
		let after = 0;
		for (;;) {
			const rows = await this.repository.listForBundle(after, EXPORT_PAGE);
			if (rows.length === 0) break;
			for (const row of rows) {
				const picture = await this.exportPicture(files, row, options);
				if (picture) pictures += 1;
				if (row.embedding) embedded += 1;
				lines.push(JSON.stringify(this.lineOf(row, picture)));
				options.onRecipe?.(row.title, picture ? 'with picture' : 'without picture');
			}
			after = rows[rows.length - 1].pageId;
		}

		const catalog = lines.length > 0 ? `${lines.join('\n')}\n` : '';
		await files.write(CATALOG, catalog);
		const manifest: CookbookBundleManifest = {
			format: COOKBOOK_BUNDLE_FORMAT,
			createdAt: new Date().toISOString(),
			recipes: lines.length,
			pictures,
			embedded,
			models: options.models,
			licences: { text: COOKBOOK_LICENCE, pictures: FLUX_PICTURE_LICENCE },
			catalogSha256: sha256(catalog)
		};
		await files.write(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
		return manifest;
	}

	async load(
		files: CookbookBundleFiles,
		options: { onRecipe?: (title: string, outcome: string) => void } = {}
	): Promise<CookbookBundleLoadSummary> {
		const manifest = JSON.parse(
			(await files.read(MANIFEST)).toString('utf8')
		) as CookbookBundleManifest;
		if (manifest.format !== COOKBOOK_BUNDLE_FORMAT) {
			throw new Error(
				`The bundle has format ${manifest.format}; this app reads format ${COOKBOOK_BUNDLE_FORMAT}.`
			);
		}
		const catalog = await files.read(CATALOG);
		if (sha256(catalog) !== manifest.catalogSha256) {
			throw new Error(
				'The bundle catalog does not match its manifest checksum; nothing was loaded.'
			);
		}

		const summary: CookbookBundleLoadSummary = {
			recipes: 0,
			inserted: 0,
			updated: 0,
			unchanged: 0,
			pictures: 0
		};
		const lines = catalog
			.toString('utf8')
			.split('\n')
			.filter((line) => line.trim() !== '');
		for (const text of lines) {
			const line = JSON.parse(text) as CookbookBundleLine;
			summary.recipes += 1;
			const existing = await this.repository.findByPageId(line.pageId);
			const sameRevision = existing?.revisionId === line.revisionId;
			if (existing && sameRevision && (!line.picture || existing.imageUrl)) {
				summary.unchanged += 1;
				options.onRecipe?.(line.title, 'unchanged');
				continue;
			}

			const stored = await this.repository.upsert({
				pageId: line.pageId,
				revisionId: line.revisionId,
				title: line.title,
				pageTitle: line.pageTitle,
				sourceUrl: line.sourceUrl,
				licence: line.licence,
				recipe: line.recipe,
				tags: line.tags,
				cuisine: line.cuisine,
				itemKeys: line.itemKeys,
				structuredBy: line.structuredBy,
				embedding: line.embedding
			});
			if (line.picture && !(sameRevision && existing?.imageUrl)) {
				const upload = await this.storage.upload(
					await files.read(line.picture.file),
					`cookbook-${stored.id}.webp`,
					'image/webp',
					PICTURE_FOLDER
				);
				await this.repository.updatePicture(stored.id, {
					imageUrl: upload.url,
					imageStatus: 'DONE',
					imageSource: line.picture.source,
					imageCredit: line.picture.credit
				});
				summary.pictures += 1;
			}
			if (existing) summary.updated += 1;
			else summary.inserted += 1;
			options.onRecipe?.(line.title, existing ? 'updated' : 'inserted');
		}
		return summary;
	}

	/** Writes the row's picture into the bundle, or returns null when it has none. */
	private async exportPicture(
		files: CookbookBundleFiles,
		row: CookbookBundleRowDao,
		options: CookbookBundleExportOptions
	): Promise<CookbookBundleLine['picture']> {
		if (!row.imageUrl || !row.imageSource) return null;
		const stored = await this.storage.read(storageKeyOf(row.imageUrl));
		const file = `pictures/${row.pageId}.webp`;
		await files.write(file, await options.shrink(stored.data));
		return { file, source: row.imageSource, credit: row.imageCredit };
	}

	private lineOf(
		row: CookbookBundleRowDao,
		picture: CookbookBundleLine['picture']
	): CookbookBundleLine {
		return {
			pageId: row.pageId,
			revisionId: row.revisionId,
			title: row.title,
			pageTitle: row.pageTitle,
			sourceUrl: row.sourceUrl,
			licence: row.licence,
			recipe: row.recipe,
			tags: row.tags,
			cuisine: row.cuisine,
			itemKeys: row.itemKeys,
			structuredBy: row.structuredBy,
			embedding: row.embedding,
			picture
		};
	}
}
