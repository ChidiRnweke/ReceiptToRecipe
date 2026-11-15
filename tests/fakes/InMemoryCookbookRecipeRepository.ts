import { randomUUID } from 'node:crypto';
import type {
	CookbookFilter,
	CookbookPictureDao,
	CookbookRecipeDao,
	CookbookSampleQuery,
	CookbookSearchQuery,
	NewCookbookRecipeDao
} from '../../src/lib/repositories/daos';
import type { ICookbookRecipeRepository } from '../../src/lib/repositories/interfaces/ICookbookRecipeRepository';
import type { IRecipeRepository } from '../../src/lib/repositories/interfaces/IRecipeRepositories';

interface Stored extends CookbookRecipeDao {
	itemKeys: string[];
	embedding: number[] | null;
}

function cosine(a: number[], b: number[]): number {
	let dot = 0;
	let na = 0;
	let nb = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		na += a[i] * a[i];
		nb += b[i] * b[i];
	}
	return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/**
 * The catalog in memory, with the same filter as the Postgres repository. Pass the household
 * recipes so recipes a household adopted are left out of its offers.
 */
export class InMemoryCookbookRecipeRepository implements ICookbookRecipeRepository {
	readonly rows = new Map<string, Stored>();
	private clock = 0;

	constructor(private recipes: IRecipeRepository | null = null) {}

	async findById(id: string): Promise<CookbookRecipeDao | null> {
		return this.rows.get(id) ?? null;
	}

	async findByIds(ids: string[]): Promise<CookbookRecipeDao[]> {
		return ids.flatMap((id) => this.rows.get(id) ?? []);
	}

	async findByPageId(pageId: number): Promise<CookbookRecipeDao | null> {
		return [...this.rows.values()].find((row) => row.pageId === pageId) ?? null;
	}

	async upsert(recipe: NewCookbookRecipeDao): Promise<CookbookRecipeDao> {
		const existing = await this.findByPageId(recipe.pageId);
		const at = new Date(Date.UTC(2026, 0, 1) + this.clock++ * 1000);
		const stored: Stored = {
			id: existing?.id ?? randomUUID(),
			imageUrl: existing?.imageUrl ?? null,
			imageStatus: existing?.imageStatus ?? 'QUEUED',
			imageSource: existing?.imageSource ?? null,
			imageCredit: existing?.imageCredit ?? null,
			importedAt: existing?.importedAt ?? at,
			updatedAt: at,
			...recipe
		};
		this.rows.set(stored.id, stored);
		return stored;
	}

	async updatePicture(id: string, picture: CookbookPictureDao): Promise<void> {
		const row = this.rows.get(id);
		if (row) this.rows.set(id, { ...row, ...picture });
	}

	async findWithoutPicture(limit: number, standIns: boolean): Promise<CookbookRecipeDao[]> {
		return [...this.rows.values()]
			.filter((row) => !row.imageUrl || (standIns && row.imageSource === 'COMMONS'))
			.sort((a, b) => a.importedAt.getTime() - b.importedAt.getTime())
			.slice(0, limit);
	}

	async countWithoutPicture(standIns: boolean): Promise<number> {
		return (await this.findWithoutPicture(Number.MAX_SAFE_INTEGER, standIns)).length;
	}

	async sample(query: CookbookSampleQuery): Promise<CookbookRecipeDao[]> {
		const wanted = new Set(query.wanted);
		const passing = await this.passing(query);
		return passing
			.map((row) => ({
				row,
				uses: row.itemKeys.filter((key) => wanted.has(key)).length,
				preferred: row.tags.some((tag) => query.preferTags.includes(tag)) ? 1 : 0
			}))
			.sort(
				(a, b) =>
					b.uses - a.uses || b.preferred - a.preferred || a.row.title.localeCompare(b.row.title)
			)
			.slice(0, query.limit)
			.map(({ row }) => row);
	}

	async search(query: CookbookSearchQuery): Promise<CookbookRecipeDao[]> {
		const text = query.text?.toLowerCase() ?? null;
		let rows = (await this.passing(query)).filter(
			(row) =>
				!text ||
				row.title.toLowerCase().includes(text) ||
				row.itemKeys.some((key) => key.includes(text))
		);
		if (query.embedding) {
			const embedding = query.embedding;
			rows = rows
				.filter((row) => row.embedding)
				.sort(
					(a, b) =>
						cosine(b.embedding as number[], embedding) - cosine(a.embedding as number[], embedding)
				);
		} else {
			rows.sort((a, b) => a.title.localeCompare(b.title));
		}
		return rows.slice(0, query.limit);
	}

	async count(): Promise<number> {
		return this.rows.size;
	}

	private async passing(query: CookbookFilter): Promise<Stored[]> {
		const result: Stored[] = [];
		for (const row of this.rows.values()) {
			if (!query.tagGroups.every((group) => group.some((tag) => row.tags.includes(tag)))) continue;
			const avoided = query.avoid.some(
				(word) =>
					row.title.toLowerCase().includes(word) || row.itemKeys.some((key) => key.includes(word))
			);
			if (avoided) continue;
			if (
				query.householdId &&
				this.recipes &&
				(await this.recipes.findByHouseholdAndCookbookId(query.householdId, row.id))
			) {
				continue;
			}
			result.push(row);
		}
		return result;
	}
}
