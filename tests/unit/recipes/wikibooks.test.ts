import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WikibooksSections } from '../../../src/lib/models/recipes';
import { parseWikibooksRecipe, plainText } from '../../../src/lib/services/recipes/wikibooks';
import {
	minutesIn,
	parseIngredientLine,
	servingsIn,
	structureByRules,
	tagsFromCategories
} from '../../../src/lib/services/recipes/cookbookRules';

const FIXTURES = join(__dirname, '../../fixtures/wikibooks');

function page(name: string): string {
	return readFileSync(join(FIXTURES, `${name}.wikitext`), 'utf8');
}

function sections(name: string): WikibooksSections {
	const parsed = parseWikibooksRecipe(page(name));
	if (!parsed.ok) throw new Error(`${name} did not parse: ${parsed.reason}`);
	return parsed.sections;
}

describe('parseWikibooksRecipe on a good page', () => {
	it('reads every ingredient line', () => {
		expect(sections('beef-stroganoff').ingredients).toHaveLength(13);
	});

	it('reads links as their label', () => {
		expect(sections('beef-stroganoff').ingredients[1]).toBe('1 teaspoon olive oil');
	});

	it('reads {{convert}} as the amount and unit', () => {
		expect(sections('beef-stroganoff').ingredients[0]).toBe(
			'8 oz wide egg noodles (figures are for yolk-free noodles)'
		);
	});

	it('reads every numbered step', () => {
		expect(sections('beef-stroganoff').procedure).toHaveLength(9);
	});

	it('reads the servings from the summary box', () => {
		expect(sections('beef-stroganoff').servings).toBe('4');
	});

	it('reads the time from the summary box', () => {
		expect(sections('beef-stroganoff').time).toBe('20 minutes');
	});

	it('reads the categories', () => {
		expect(sections('beef-stroganoff').categories).toContain('Main course recipes');
	});
});

describe('parseWikibooksRecipe on other page shapes', () => {
	it('takes a "Preparation" section as the procedure', () => {
		expect(sections('adobo-chicken').procedure[0]).toBe(
			'Put chicken, garlic, peppercorn, soy sauce and vinegar in a pan and bring to a boil.'
		);
	});

	it('reads the cuisine from a category such as "Filipino recipes"', () => {
		expect(sections('adobo-chicken').cuisine).toBe('Filipino');
	});

	it('reads the lead paragraph as the description', () => {
		expect(sections('adobo-chicken').description).toMatch(/^Adobo chicken is the most indigenous/);
	});

	it('reads {{cb|…}} as the ingredient', () => {
		expect(sections('agar-jelly').ingredients[0]).toBe('5 g agar powder');
	});

	it('finds a procedure under a level-3 heading inside the ingredients', () => {
		expect(sections('eggplant-parmesan').procedure.length).toBeGreaterThan(3);
	});

	it('keeps the level-3 procedure out of the ingredients', () => {
		expect(sections('eggplant-parmesan').ingredients.some((line) => /^Cut off/.test(line))).toBe(
			false
		);
	});
});

describe('parseWikibooksRecipe refuses', () => {
	it('a page whose ingredients have no amounts', () => {
		expect(parseWikibooksRecipe(page('akamu-no-amounts'))).toEqual({
			ok: false,
			reason: 'no-amounts'
		});
	});

	it('a page with an empty Ingredients section', () => {
		expect(parseWikibooksRecipe(page('afghan-bread-no-ingredients'))).toEqual({
			ok: false,
			reason: 'no-ingredients'
		});
	});

	it('a redirect', () => {
		expect(parseWikibooksRecipe('#REDIRECT [[Cookbook:Paella]]')).toEqual({
			ok: false,
			reason: 'redirect'
		});
	});

	it('a page without steps', () => {
		expect(parseWikibooksRecipe('==Ingredients==\n* 1 cup rice\n==Procedure==\n')).toEqual({
			ok: false,
			reason: 'no-steps'
		});
	});
});

describe('plainText', () => {
	it('drops references', () => {
		expect(plainText('Salt<ref>to taste</ref>, fine')).toBe('Salt, fine');
	});

	it('keeps the suffix of a link, as in [[Cookbook:Egg|egg]]s', () => {
		expect(plainText('4 [[Cookbook:Egg|egg]]s')).toBe('4 eggs');
	});
});

describe('parseIngredientLine', () => {
	it('reads an amount and a unit word', () => {
		expect(parseIngredientLine('1 teaspoon olive oil')).toEqual({
			name: 'olive oil',
			quantity: 1,
			unit: 'tsp',
			optional: false,
			notes: null
		});
	});

	it('reads a fraction character', () => {
		expect(parseIngredientLine('¼ cup (60 ml) skim milk').quantity).toBe(0.25);
	});

	it('reads a whole number and a fraction character', () => {
		expect(parseIngredientLine('1 ½ pounds spinach').quantity).toBe(1.5);
	});

	it('reads a range as its middle', () => {
		expect(parseIngredientLine('6–8 chicken pieces').quantity).toBe(7);
	});

	it('moves a parenthesised conversion to the notes', () => {
		expect(parseIngredientLine('¼ cup (60 ml) skim milk').notes).toBe('60 ml');
	});

	it('moves what follows a comma to the notes', () => {
		expect(parseIngredientLine('4 cloves of garlic, crushed').notes).toBe('crushed');
	});

	it('reads "cloves of garlic" as garlic in cloves', () => {
		expect(parseIngredientLine('4 cloves of garlic, crushed').name).toBe('garlic');
	});

	it('gives an ingredient without an amount a quantity of 0', () => {
		expect(parseIngredientLine('Salt to taste').quantity).toBe(0);
	});

	it('notes "to taste"', () => {
		expect(parseIngredientLine('Salt to taste').notes).toBe('to taste');
	});

	it('moves how it is cut to the notes', () => {
		expect(parseIngredientLine('1 cup chopped onion').name).toBe('onion');
	});

	it('reads "(optional)" as optional', () => {
		expect(parseIngredientLine('2 medium snails (optional)').optional).toBe(true);
	});

	it('leaves a count without a unit', () => {
		expect(parseIngredientLine('4 eggs').unit).toBe('');
	});
});

describe('the summary box', () => {
	it('adds the minutes of "Prep: 20 minutes Baking: 60 minutes"', () => {
		expect(minutesIn('Prep: 20 minutes Baking: 60 minutes')).toBe(80);
	});

	it('reads hours', () => {
		expect(minutesIn('1 hour 30 min')).toBe(90);
	});

	it('reads the first number of "8–10" as the servings', () => {
		expect(servingsIn('8–10')).toBe(8);
	});

	it('has no servings in "1 pot of tea" beyond the number', () => {
		expect(servingsIn('a pot of tea')).toBeNull();
	});
});

describe('structureByRules', () => {
	it('tags the course a category names', () => {
		expect(tagsFromCategories(['Recipes for dessert'])).toEqual(['dessert']);
	});

	it('takes no diet tag from a category', () => {
		expect(tagsFromCategories(['Vegetarian recipes'])).toEqual([]);
	});

	it('tags a recipe with beef as neither vegetarian nor vegan', () => {
		const tags = structureByRules('Beef Stroganoff', sections('beef-stroganoff')).tags;
		expect(tags.some((tag) => tag === 'vegetarian' || tag === 'vegan')).toBe(false);
	});

	it('reads a step that starts with a vocabulary verb as that verb', () => {
		const steps = structureByRules('Beef Stroganoff', sections('beef-stroganoff')).steps;
		expect(steps[6].verb).toBe('Simmer');
	});

	it('uses 4 servings when the page gives none', () => {
		expect(structureByRules('Adobo', sections('adobo-chicken')).servings).toBe(4);
	});
});
