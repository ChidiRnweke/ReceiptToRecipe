import { and, asc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import { isRecipeTag, type CookbookStructurer } from '$lib/models/recipes';
import type {
	CookbookFilter,
	CookbookPictureDao,
	CookbookRecipeDao,
	CookbookSampleQuery,
	CookbookSearchQuery,
	NewCookbookRecipeDao
} from './daos';
import type { ICookbookRecipeRepository } from './interfaces/ICookbookRecipeRepository';

const t = schema.cookbookRecipes;

function vectorLiteral(embedding: number[]): string {
	return `[${embedding.join(',')}]`;
}

function textArray(values: string[]): SQL {
	return sql`ARRAY[${sql.join(
		values.map((value) => sql`${value}`),
		sql`, `
	)}]::text[]`;
}

export class CookbookRecipeRepository implements ICookbookRecipeRepository {
	constructor(private db: Database) {}

	async findById(id: string): Promise<CookbookRecipeDao | null> {
		const [row] = await this.db.select().from(t).where(eq(t.id, id)).limit(1);
		return row ? this.toDao(row) : null;
	}

	async findByIds(ids: string[]): Promise<CookbookRecipeDao[]> {
		if (ids.length === 0) return [];
		const rows = await this.db.select().from(t).where(inArray(t.id, ids));
		return rows.map((row) => this.toDao(row));
	}

	async findByPageId(pageId: number): Promise<CookbookRecipeDao | null> {
		const [row] = await this.db.select().from(t).where(eq(t.pageId, pageId)).limit(1);
		return row ? this.toDao(row) : null;
	}

	async upsert(recipe: NewCookbookRecipeDao): Promise<CookbookRecipeDao> {
		const values = {
			pageId: recipe.pageId,
			revisionId: recipe.revisionId,
			title: recipe.title,
			pageTitle: recipe.pageTitle,
			sourceUrl: recipe.sourceUrl,
			licence: recipe.licence,
			recipe: recipe.recipe,
			tags: recipe.tags,
			cuisine: recipe.cuisine,
			itemKeys: recipe.itemKeys,
			structuredBy: recipe.structuredBy,
			embedding: recipe.embedding
		};
		const [row] = await this.db
			.insert(t)
			.values(values)
			.onConflictDoUpdate({ target: t.pageId, set: { ...values, updatedAt: new Date() } })
			.returning();
		return this.toDao(row);
	}

	async updatePicture(id: string, picture: CookbookPictureDao): Promise<void> {
		await this.db
			.update(t)
			.set({ ...picture, updatedAt: new Date() })
			.where(eq(t.id, id));
	}

	async findWithoutPicture(limit: number, standIns: boolean): Promise<CookbookRecipeDao[]> {
		const rows = await this.db
			.select()
			.from(t)
			.where(this.withoutPicture(standIns))
			.orderBy(asc(t.importedAt), asc(t.id))
			.limit(limit);
		return rows.map((row) => this.toDao(row));
	}

	async countWithoutPicture(standIns: boolean): Promise<number> {
		const [row] = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(t)
			.where(this.withoutPicture(standIns));
		return row?.count ?? 0;
	}

	async sample(query: CookbookSampleQuery): Promise<CookbookRecipeDao[]> {
		const order: SQL[] = [];
		if (query.wanted.length > 0) {
			order.push(
				sql`cardinality(ARRAY(SELECT unnest(${t.itemKeys}) INTERSECT SELECT unnest(${textArray(query.wanted)}))) DESC`
			);
		}
		if (query.preferTags.length > 0) {
			order.push(sql`(${t.tags} && ${textArray(query.preferTags)}) DESC`);
		}
		order.push(sql`md5(${t.id}::text || ${query.seed})`);
		const rows = await this.db
			.select()
			.from(t)
			.where(this.filter(query))
			.orderBy(...order)
			.limit(query.limit);
		return rows.map((row) => this.toDao(row));
	}

	async search(query: CookbookSearchQuery): Promise<CookbookRecipeDao[]> {
		const conditions = [this.filter(query)];
		if (query.text) {
			const pattern = `%${query.text.toLowerCase()}%`;
			conditions.push(
				or(
					sql`lower(${t.title}) LIKE ${pattern}`,
					sql`EXISTS (SELECT 1 FROM unnest(${t.itemKeys}) k WHERE k LIKE ${pattern})`
				) as SQL
			);
		}
		if (query.embedding) {
			conditions.push(isNotNull(t.embedding));
			const vector = vectorLiteral(query.embedding);
			const rows = await this.db
				.select()
				.from(t)
				.where(and(...conditions))
				.orderBy(sql`${t.embedding} <=> ${vector}::vector`)
				.limit(query.limit);
			return rows.map((row) => this.toDao(row));
		}
		const rows = await this.db
			.select()
			.from(t)
			.where(and(...conditions))
			.orderBy(asc(t.title))
			.limit(query.limit);
		return rows.map((row) => this.toDao(row));
	}

	async count(): Promise<number> {
		const [row] = await this.db.select({ count: sql<number>`count(*)::int` }).from(t);
		return row?.count ?? 0;
	}

	private withoutPicture(standIns: boolean): SQL {
		return (
			standIns ? or(isNull(t.imageUrl), eq(t.imageSource, 'COMMONS')) : isNull(t.imageUrl)
		) as SQL;
	}

	private filter(query: CookbookFilter): SQL {
		const conditions: SQL[] = query.tagGroups
			.filter((group) => group.length > 0)
			.map((group) => sql`${t.tags} && ${textArray(group)}`);
		if (query.avoid.length > 0) {
			const avoid = textArray(query.avoid.map((word) => word.toLowerCase()));
			conditions.push(
				sql`NOT EXISTS (SELECT 1 FROM unnest(${avoid}) a WHERE lower(${t.title}) LIKE '%' || a || '%' OR EXISTS (SELECT 1 FROM unnest(${t.itemKeys}) k WHERE k LIKE '%' || a || '%'))`
			);
		}
		if (query.householdId) {
			conditions.push(
				sql`NOT EXISTS (SELECT 1 FROM ${schema.recipes} r WHERE r.household_id = ${query.householdId} AND r.cookbook_recipe_id = ${t.id})`
			);
		}
		return conditions.length > 0 ? (and(...conditions) as SQL) : sql`true`;
	}

	private toDao(row: typeof t.$inferSelect): CookbookRecipeDao {
		return {
			id: row.id,
			pageId: row.pageId,
			revisionId: row.revisionId,
			title: row.title,
			pageTitle: row.pageTitle,
			sourceUrl: row.sourceUrl,
			licence: row.licence,
			recipe: row.recipe,
			tags: row.tags.filter(isRecipeTag),
			cuisine: row.cuisine,
			structuredBy: row.structuredBy as CookbookStructurer,
			imageUrl: row.imageUrl,
			imageStatus: row.imageStatus,
			imageSource: row.imageSource,
			imageCredit: row.imageCredit,
			importedAt: row.importedAt,
			updatedAt: row.updatedAt
		};
	}
}
