import {
	COOKBOOK_LICENCE,
	type CookbookImportSummary,
	type CookbookSkipReason
} from '$lib/models/recipes';
import { wikibooksUrls } from '$lib/models/recipes';
import type { ICookbookRecipeRepository } from '$repositories';
import type {
	CookbookEmbedder,
	CookbookImportOptions,
	ICookbookImportService,
	ICookbookStructurer,
	IWikibooksClient
} from './interfaces/ICookbook';
import { parseWikibooksRecipe, recipeTitleOf } from './recipes/wikibooks';
import { cookbookTags, embeddingText, itemKeysOf } from './recipes/cookbookText';

/** The wiki's text licence must be this one for the import to run. */
const SHARE_ALIKE = /Attribution-Share[ -]?Alike/i;

/** Imports Wikibooks Cookbook pages into the shared catalog. */
export class CookbookImportService implements ICookbookImportService {
	constructor(
		private client: IWikibooksClient,
		private structurer: ICookbookStructurer,
		private repository: ICookbookRecipeRepository,
		private embedder: CookbookEmbedder | null
	) {}

	async import(
		options: CookbookImportOptions
	): Promise<CookbookImportSummary & { importedIds: string[] }> {
		const licence = await this.client.licence();
		if (!SHARE_ALIKE.test(licence.text)) {
			throw new Error(
				`The wiki's text licence is "${licence.text}", not CC BY-SA; nothing was imported.`
			);
		}

		const summary: CookbookImportSummary & { importedIds: string[] } = {
			seen: 0,
			imported: 0,
			updated: 0,
			skipped: {},
			unembedded: 0,
			skips: [],
			importedIds: []
		};
		const skip = (title: string, reason: CookbookSkipReason, detail?: string) => {
			summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
			summary.skips.push({ title, reason, ...(detail ? { detail } : {}) });
			options.onPage?.(title, `skipped: ${reason}${detail ? ` (${detail})` : ''}`);
		};
		let embedderUp = this.embedder !== null;

		for await (const page of this.client.recipePages(options.limit)) {
			summary.seen += 1;
			const existing = await this.repository.findByPageId(page.pageId);
			// A model run structures again a page the rules structured; nothing else at the same
			// revision is done twice.
			const upgrade = existing?.structuredBy === 'rules' && this.structurer.kind === 'model';
			if (existing && existing.revisionId === page.revisionId && !upgrade) {
				skip(page.title, 'unchanged');
				continue;
			}

			const parsed = parseWikibooksRecipe(page.wikitext);
			if (!parsed.ok) {
				skip(page.title, parsed.reason);
				continue;
			}

			const title = recipeTitleOf(page.title);
			let recipe;
			try {
				recipe = await this.structurer.structure(title, parsed.sections);
			} catch (error) {
				skip(page.title, 'structure-invalid', (error as Error).message.slice(0, 160));
				continue;
			}

			// Undefined keeps the embedding already stored for the page, when one is.
			let embedding: number[] | undefined;
			if (embedderUp && this.embedder) {
				try {
					embedding = await this.embedder.embed(embeddingText(recipe));
				} catch (error) {
					// One failure is enough to know the embedding model is unreachable this run.
					embedderUp = false;
					console.error('Embedding failed; importing the rest without embeddings:', error);
				}
			}
			if (!embedding && !existing?.embedded) summary.unembedded += 1;

			const stored = await this.repository.upsert({
				pageId: page.pageId,
				revisionId: page.revisionId,
				title,
				pageTitle: page.title,
				sourceUrl: wikibooksUrls(page.title).pageUrl,
				licence: COOKBOOK_LICENCE,
				recipe,
				tags: cookbookTags(recipe),
				cuisine: recipe.cuisine,
				itemKeys: itemKeysOf(recipe),
				structuredBy: this.structurer.kind,
				...(embedding ? { embedding } : existing ? {} : { embedding: null })
			});
			if (existing) {
				summary.updated += 1;
				options.onPage?.(page.title, 'updated');
			} else {
				summary.imported += 1;
				options.onPage?.(page.title, 'imported');
			}
			summary.importedIds.push(stored.id);
		}
		return summary;
	}
}
