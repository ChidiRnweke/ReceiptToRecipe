import { describe, it, expect } from 'vitest';
import { matchReceiptToList } from '../../../src/lib/services/shop';

const line = (itemKey: string) => ({ id: `line-${itemKey}`, itemKey });
const item = (itemKey: string) => ({ id: `item-${itemKey}`, itemKey });

describe('matchReceiptToList', () => {
	it('matches a line to the list item of the same key', () => {
		const result = matchReceiptToList([line('spinach')], [item('spinach')]);
		expect(result.matched.map((m) => m.item.id)).toEqual(['item-spinach']);
	});

	it('matches the plural on the receipt to the singular on the list', () => {
		const result = matchReceiptToList([line('tomatoes')], [item('tomato')]);
		expect(result.matched.length).toBe(1);
	});

	it('matches a line that names the item with more words', () => {
		const result = matchReceiptToList([line('baby spinach')], [item('spinach')]);
		expect(result.matched.length).toBe(1);
	});

	it('prefers the exact item over a partial one', () => {
		const result = matchReceiptToList([line('red onion')], [item('onion'), item('red onion')]);
		expect(result.matched[0].item.id).toBe('item-red onion');
	});

	it('reports a line that was not on the list as an extra', () => {
		const result = matchReceiptToList([line('yogurt')], [item('spinach')]);
		expect(result.extras.map((l) => l.id)).toEqual(['line-yogurt']);
	});

	it('reports a list item that is not on the receipt as missing', () => {
		const result = matchReceiptToList([line('spinach')], [item('spinach'), item('coriander')]);
		expect(result.missing.map((i) => i.id)).toEqual(['item-coriander']);
	});

	it('lets one line buy only one list item', () => {
		const result = matchReceiptToList([line('milk'), line('milk')], [item('milk')]);
		expect(result.extras.length).toBe(1);
	});
});
