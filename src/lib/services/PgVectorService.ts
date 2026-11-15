import { getDb } from '$db/client';
import { cookbookRecipes } from '$db/schema';
import { and, desc, isNotNull, sql } from 'drizzle-orm';
import type { CookbookStructure } from '$lib/models/recipes';
import type { IVectorService, VectorSearchResult } from './interfaces';
import type { ICulinaryIntelligence } from './interfaces';

/** A catalog recipe as reference text for a model: title, ingredients and steps. */
function referenceText(title: string, recipe: CookbookStructure): string {
	const ingredients = recipe.ingredients
		.map((ingredient) =>
			[ingredient.quantity || '', ingredient.unit, ingredient.name].filter(Boolean).join(' ')
		)
		.join('; ');
	const steps = recipe.steps
		.map((step) => (step.verb ? `${step.verb} ${step.text}` : step.text))
		.join(' ');
	return `${title}\nIngredients: ${ingredients}\nMethod: ${steps}`;
}

/** Finds shared cookbook recipes close to a text, by their embeddings. */
export class PgVectorService implements IVectorService {
	constructor(private culinaryIntelligence: ICulinaryIntelligence) {}

	async search(
		embedding: number[],
		limit: number = 5,
		threshold: number = 0.7
	): Promise<VectorSearchResult[]> {
		const db = getDb();
		const vector = `[${embedding.join(',')}]`;
		const similarity = sql<number>`1 - (${cookbookRecipes.embedding} <=> ${vector}::vector)`;
		const rows = await db
			.select({
				id: cookbookRecipes.id,
				title: cookbookRecipes.title,
				recipe: cookbookRecipes.recipe,
				sourceUrl: cookbookRecipes.sourceUrl,
				similarity
			})
			.from(cookbookRecipes)
			.where(and(isNotNull(cookbookRecipes.embedding), sql`${similarity} >= ${threshold}`))
			.orderBy(desc(similarity))
			.limit(limit);

		return rows.map((row) => ({
			id: row.id,
			recipeTitle: row.title,
			contentChunk: referenceText(row.title, row.recipe),
			similarity: row.similarity,
			metadata: { sourceUrl: row.sourceUrl }
		}));
	}

	async searchByText(query: string, limit: number = 5): Promise<VectorSearchResult[]> {
		const embedding = await this.culinaryIntelligence.embed(query);
		return this.search(embedding, limit);
	}
}
