import { describe, it, expect } from 'vitest';
import {
	combineTags,
	deriveTags,
	dietLine,
	dietTagsFor,
	hasTags,
	tagsOf
} from '../../../src/lib/services/recipes/tags';
import { judgedTagsFrom } from '../../../src/lib/models/recipes';
import type { TechniqueVerb } from '../../../src/lib/models/recipes';

const noTime = { prepTime: null, cookTime: null };
const named = (...names: string[]) => names.map((name) => ({ name }));
const step = (verb: TechniqueVerb | null, text = 'it.', minutes: number | null = null) => ({
	verb,
	text,
	minutes
});
const dietOf = (...names: string[]) =>
	deriveTags(noTime, named(...names), []).filter((tag) =>
		['vegetarian', 'vegan', 'pescatarian'].includes(tag)
	);

describe('deriveTags', () => {
	describe('diet', () => {
		it('tags a dish of only plants vegan', () => {
			expect(dietOf('chickpeas', 'spinach', 'coconut milk', 'onion')).toEqual(['vegan']);
		});

		it('tags a dish with feta vegetarian, not vegan', () => {
			expect(dietOf('spinach', 'feta', 'eggs')).toEqual(['vegetarian']);
		});

		it('tags a dish with honey vegetarian, not vegan', () => {
			expect(dietOf('oats', 'honey')).toEqual(['vegetarian']);
		});

		it('tags a dish with prawns but no meat pescatarian', () => {
			expect(dietOf('prawns', 'rice', 'garlic')).toEqual(['pescatarian']);
		});

		it('gives a dish with chicken no diet tag', () => {
			expect(dietOf('chicken thighs', 'rice')).toEqual([]);
		});

		it('counts an optional ingredient, so optional bacon is not vegetarian', () => {
			expect(dietOf('potatoes', 'bacon bits')).toEqual([]);
		});

		it('reads a beef tomato as a tomato', () => {
			expect(dietOf('beef tomatoes', 'basil')).toEqual(['vegan']);
		});

		it('reads oyster mushrooms as mushrooms', () => {
			expect(dietOf('oyster mushrooms', 'soy sauce')).toEqual(['vegan']);
		});

		it('reads a vegan substitute as a plant', () => {
			expect(dietOf('vegan sausages', 'mash')).toEqual(['vegan']);
		});

		it('reads fish sauce as fish', () => {
			expect(dietOf('rice noodles', 'fish sauce')).toEqual(['pescatarian']);
		});

		it('reads accented cheese names', () => {
			expect(deriveTags(noTime, named('crème fraîche', 'leeks'), [])).not.toContain('dairy-free');
		});

		it('keeps coconut milk dairy-free', () => {
			expect(deriveTags(noTime, named('coconut milk', 'lentils'), [])).toContain('dairy-free');
		});

		it('takes pasta out of gluten-free', () => {
			expect(deriveTags(noTime, named('penne', 'tomatoes'), [])).not.toContain('gluten-free');
		});

		it('keeps rice noodles gluten-free', () => {
			expect(deriveTags(noTime, named('rice noodles', 'tofu', 'tamari'), [])).toContain(
				'gluten-free'
			);
		});

		it('keeps gluten-free pasta gluten-free', () => {
			expect(deriveTags(noTime, named('gluten-free pasta', 'pesto'), [])).toContain('gluten-free');
		});

		it('gives a recipe without ingredients no diet tags', () => {
			expect(deriveTags(noTime, [], [])).toEqual([]);
		});
	});

	describe('quick', () => {
		it('tags a recipe whose steps add up to 30 minutes quick', () => {
			const steps = [step('Sweat', 'the onion.', 10), step('Simmer', 'the dal.', 20)];
			expect(deriveTags(noTime, [], steps)).toContain('quick');
		});

		it('does not tag a recipe whose steps add up to 45 minutes quick', () => {
			const steps = [step('Sweat', 'the onion.', 15), step('Simmer', 'the dal.', 30)];
			expect(deriveTags(noTime, [], steps)).not.toContain('quick');
		});

		it('reads prep and cook time when the steps have no minutes', () => {
			expect(deriveTags({ prepTime: 5, cookTime: 15 }, [], [])).toContain('quick');
		});

		it('uses the longer of the two times', () => {
			const steps = [step('Sauté', 'the greens.', 10)];
			expect(deriveTags({ prepTime: 20, cookTime: 40 }, [], steps)).not.toContain('quick');
		});

		it('does not call a recipe of unknown length quick', () => {
			expect(deriveTags(noTime, [], [step(null, 'Serve.')])).not.toContain('quick');
		});
	});

	describe('one-pot', () => {
		it('tags sweating, blooming and simmering one pot', () => {
			const steps = [step('Sweat'), step('Bloom'), step('Simmer')];
			expect(deriveTags(noTime, [], steps)).toContain('one-pot');
		});

		it('does not tag boiling pasta next to a sautéed sauce one pot', () => {
			const steps = [step('Boil', 'the pasta.'), step('Sauté', 'the garlic.')];
			expect(deriveTags(noTime, [], steps)).not.toContain('one-pot');
		});

		it('does not tag roasting next to searing one pot', () => {
			const steps = [step('Sear', 'the chicken.'), step('Roast', 'the potatoes.')];
			expect(deriveTags(noTime, [], steps)).not.toContain('one-pot');
		});

		it('tags a tray that only roasts one pot', () => {
			expect(deriveTags(noTime, [], [step('Roast', 'everything.')])).toContain('one-pot');
		});

		it('rules out a step that names a second pan', () => {
			const steps = [step('Simmer', 'the sauce.'), step(null, 'Fry the eggs in another pan.')];
			expect(deriveTags(noTime, [], steps)).not.toContain('one-pot');
		});

		it('tags a recipe that says it is cooked in the same pan one pot', () => {
			const steps = [step('Boil', 'the orzo.'), step('Sauté', 'the leeks in the same pan.')];
			expect(deriveTags(noTime, [], steps)).toContain('one-pot');
		});

		it('does not tag a recipe with no cooking verb one pot', () => {
			expect(deriveTags(noTime, [], [step('Fold', 'the herbs through.')])).not.toContain('one-pot');
		});
	});
});

describe('judgedTagsFrom', () => {
	it('drops tags outside the vocabulary', () => {
		expect(judgedTagsFrom(['main', 'spicy', 'keeps-well'])).toEqual(['keeps-well', 'main']);
	});

	it('drops the tags rules own', () => {
		expect(judgedTagsFrom(['vegan', 'side'])).toEqual(['side']);
	});

	it('reads tags in any case', () => {
		expect(judgedTagsFrom([' Freezes '])).toEqual(['freezes']);
	});

	it('reads a value that is not a list as no tags', () => {
		expect(judgedTagsFrom('main')).toEqual([]);
	});
});

describe('combineTags', () => {
	it('joins rule and judged tags in vocabulary order', () => {
		expect(combineTags(['quick', 'vegan'], ['main']).tags).toEqual(['vegan', 'quick', 'main']);
	});

	it('records that the model has not judged yet', () => {
		expect(combineTags(['vegan'], null).tagSource.ai).toBeNull();
	});
});

describe('hasTags', () => {
	it('counts a vegan recipe as vegetarian', () => {
		expect(hasTags(['vegan'], ['vegetarian'])).toBe(true);
	});

	it('counts a vegetarian recipe as pescatarian', () => {
		expect(hasTags(['vegetarian'], ['pescatarian'])).toBe(true);
	});

	it('does not count a vegetarian recipe as vegan', () => {
		expect(hasTags(['vegetarian'], ['vegan'])).toBe(false);
	});

	it('needs every wanted tag', () => {
		expect(hasTags(['vegan', 'quick'], ['vegetarian', 'gluten-free'])).toBe(false);
	});
});

describe('dietTagsFor', () => {
	it('reads the diets saved in preferences', () => {
		expect(dietTagsFor(['Vegetarian', 'Gluten-free'])).toEqual(['vegetarian', 'gluten-free']);
	});

	it('keeps only the strictest of vegetarian and vegan', () => {
		expect(dietTagsFor(['vegetarian', 'Vegan'])).toEqual(['vegan']);
	});

	it('ignores diets the vocabulary has no tag for', () => {
		expect(dietTagsFor(['Keto', 'omnivore', null])).toEqual([]);
	});
});

describe('dietLine', () => {
	it('names the household’s diets in one line', () => {
		expect(dietLine(['vegetarian', 'gluten-free'])).toBe(
			'Vegetarian and gluten-free, for your household.'
		);
	});
});

describe('tagsOf', () => {
	it('derives the diet of a recipe that is not tagged yet', () => {
		const recipe = { tags: null, ...noTime, ingredients: named('lentils', 'onion') };
		expect(tagsOf(recipe)).toContain('vegan');
	});

	it('keeps the stored tags of a tagged recipe', () => {
		const recipe = { tags: ['main' as const], ...noTime, ingredients: named('lentils') };
		expect(tagsOf(recipe)).toEqual(['main']);
	});
});
