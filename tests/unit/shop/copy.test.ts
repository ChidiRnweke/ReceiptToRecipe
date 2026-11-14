import { describe, it, expect } from 'vitest';
import {
	cameHomeMessage,
	dishWhen,
	endButtons,
	ideaList,
	shopTitle,
	staysLine
} from '../../../src/lib/services/shop';
import { DAY0 } from '../../helpers/kitchenEvents';

describe('the end buttons', () => {
	it('put the receipt first for a member who snaps receipts', () => {
		expect(endButtons('RECEIPT')).toEqual(['receipt', 'tick']);
	});

	it('put Got everything first for a member who ticks the list', () => {
		expect(endButtons('TICK')).toEqual(['tick', 'receipt']);
	});
});

describe('shop copy', () => {
	it('names the learned shop', () => {
		expect(shopTitle(DAY0 + 3)).toBe('Thursday’s shop');
	});

	it('says Next shop without one', () => {
		expect(shopTitle(null)).toBe('Next shop');
	});

	it('says Today for a dish today', () => {
		expect(dishWhen(DAY0, DAY0)).toBe('Today');
	});

	it('names the weekday of a later dish, with prep', () => {
		expect(dishWhen(DAY0 + 5, DAY0, true)).toBe('Saturday, prep');
	});

	it('says a plural item stays on the list as they', () => {
		expect(staysLine('Chillies')).toBe('not on the receipt, so they stay on your list');
	});

	it('counts the receipt lines and names what is still on the list', () => {
		expect(cameHomeMessage(6, ['Coriander'])).toBe(
			'Got it. 6 things in the kitchen, and coriander is still on the list.'
		);
	});
});

describe('ideaList', () => {
	const ideas = [
		{
			recipeId: 'omelette',
			ingredients: [{ itemKey: 'egg', name: 'Eggs', quantity: 3, unit: 'count', have: 2 }]
		},
		{
			recipeId: 'frittata',
			ingredients: [{ itemKey: 'egg', name: 'Eggs', quantity: 6, unit: 'count', have: 2 }]
		}
	];

	it('sums the picked dinners and takes off what is home', () => {
		expect(ideaList(ideas, ['omelette', 'frittata'])[0].quantity).toBe(7);
	});

	it('lists nothing for dinners that are not picked', () => {
		expect(ideaList(ideas, [])).toEqual([]);
	});

	it('leaves out what the kitchen has enough of', () => {
		const home = [{ ...ideas[0], ingredients: [{ ...ideas[0].ingredients[0], have: 6 }] }];
		expect(ideaList(home, ['omelette'])).toEqual([]);
	});
});
