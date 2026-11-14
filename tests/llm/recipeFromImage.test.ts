/// <reference types="vitest/globals" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeLLM, OPENROUTER_API_KEY, withRetry } from './setup';
import { SmartCulinaryIntelligence } from '../../src/lib/services/SmartCulinaryIntelligence';
import { TECHNIQUE_VERBS } from '../../src/lib/models/recipes';
import type { ImageRecipe } from '../../src/lib/services/interfaces/ICulinaryIntelligence';

/** The model the app is configured with; snapping needs one that reads images. */
const VISION_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-3-flash-preview';

describeLLM('SmartCulinaryIntelligence.recipeFromImage (LLM Integration)', () => {
	let read: ImageRecipe;

	beforeAll(async () => {
		const service = new SmartCulinaryIntelligence(OPENROUTER_API_KEY, VISION_MODEL);
		const bytes = new Uint8Array(
			readFileSync(join(process.cwd(), 'tests', 'fixtures', 'cookbook-page.jpg'))
		);
		read = await withRetry(() =>
			service.recipeFromImage({ bytes, mimeType: 'image/jpeg' }, { preferences: {}, servings: 2 })
		);
	}, 120000);

	it('reads a printed recipe as a page', () => {
		expect(read.kind).toBe('page');
	});

	it('keeps the dish from the page', () => {
		expect(read.recipe.title.toLowerCase()).toContain('orzo');
	});

	it('keeps the ingredients from the page', () => {
		const names = read.recipe.ingredients.map((ingredient) => ingredient.name.toLowerCase());

		expect(names.some((name) => name.includes('spinach'))).toBe(true);
	});

	it('writes steps with verbs from the vocabulary only', () => {
		const verbs = (read.recipe.steps ?? []).flatMap((step) => (step.verb ? [step.verb] : []));

		expect(verbs.every((verb) => (TECHNIQUE_VERBS as readonly string[]).includes(verb))).toBe(true);
	});

	it('uses the vocabulary for at least one step', () => {
		expect((read.recipe.steps ?? []).some((step) => step.verb !== null)).toBe(true);
	});
});
