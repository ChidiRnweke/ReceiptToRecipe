/// <reference types="vitest/globals" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeLLM, OPENROUTER_API_KEY, withRetry } from './setup';
import { ChatCookbookStructurer } from '../../src/lib/services/CookbookStructurers';
import { parseWikibooksRecipe } from '../../src/lib/services/recipes/wikibooks';
import type { CookbookStructure } from '../../src/lib/models/recipes';

/**
 * Structures one real Wikibooks page (committed under tests/fixtures/wikibooks) with the model:
 * through OpenRouter, or through PREPROCESS_LLM_BASE_URL (with PREPROCESS_LLM_MODEL) when set.
 */
describeLLM('ChatCookbookStructurer (LLM Integration)', () => {
	let structure: CookbookStructure;

	beforeAll(async () => {
		const wikitext = readFileSync(
			join(__dirname, '../fixtures/wikibooks/beef-stroganoff.wikitext'),
			'utf8'
		);
		const parsed = parseWikibooksRecipe(wikitext);
		if (!parsed.ok) throw new Error(parsed.reason);
		const baseUrl = process.env.PREPROCESS_LLM_BASE_URL;
		const structurer = new ChatCookbookStructurer({
			baseUrl: baseUrl || 'https://openrouter.ai/api/v1',
			model:
				process.env.PREPROCESS_LLM_MODEL ||
				process.env.OPENROUTER_MODEL ||
				'google/gemini-3-flash-preview',
			apiKey: baseUrl ? (process.env.PREPROCESS_LLM_API_KEY ?? '') : OPENROUTER_API_KEY
		});
		structure = await withRetry(
			() => structurer.structure('20-Minute Beef Stroganoff', parsed.sections),
			2,
			2000
		);
	}, 300_000);

	it('keeps every ingredient of the page', () => {
		expect(structure.ingredients.length).toBeGreaterThanOrEqual(12);
	});

	it('reads the servings from the summary box', () => {
		expect(structure.servings).toBe(4);
	});

	it('names an ingredient without its amount', () => {
		expect(structure.ingredients.some((ingredient) => /^olive oil$/i.test(ingredient.name))).toBe(
			true
		);
	});
});
