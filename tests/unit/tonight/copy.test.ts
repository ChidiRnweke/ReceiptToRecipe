import { describe, it, expect } from 'vitest';
import {
	availabilityLine,
	eatOutMessage,
	formatAmount,
	pickMessage,
	tonightQuestion,
	usesChip
} from '../../../src/lib/services/tonight';

describe('Tonight copy', () => {
	it('asks about lunch before lunch', () => {
		expect(tonightQuestion('lunch', false)).toBe('What’s for *lunch*?');
	});

	it('names tomorrow’s dinner after 21:30', () => {
		expect(tonightQuestion('dinner', true)).toBe('Tomorrow’s *dinner*');
	});

	it('says a single item goes', () => {
		expect(usesChip(['spinach'])).toBe('uses the spinach before it goes');
	});

	it('says plural items go', () => {
		expect(usesChip(['mushrooms'])).toBe('uses the mushrooms before they go');
	});

	it('says everything is home when nothing is missing', () => {
		expect(availabilityLine([], null)).toBe('everything’s home');
	});

	it('asks to pick up what is missing on the way', () => {
		expect(availabilityLine(['coriander'], null)).toBe('pick up coriander on the way');
	});

	it('names the shop that brings what is missing', () => {
		expect(availabilityLine(['coriander'], { weekday: 3, daysAway: 2 })).toBe(
			'coriander comes in Thursday’s shop'
		);
	});

	it('tells where the dinner moved and why', () => {
		const message = eatOutMessage({
			title: 'Mushroom risotto',
			movedToDays: 3,
			movedToWeekday: 0,
			keptBy: { itemKey: 'mushrooms', weekday: 0 },
			firstInLine: null
		});
		expect(message).toBe(
			'Enjoy! The mushrooms keep till Monday, so mushroom risotto is Monday now.'
		);
	});

	it('says a dinner with nowhere to go is off the plan', () => {
		const message = eatOutMessage({
			title: 'Fish tacos',
			movedToDays: null,
			movedToWeekday: null,
			keptBy: null,
			firstInLine: null
		});
		expect(message).toBe('Enjoy! Fish tacos is off the plan.');
	});

	it('says what goes first when nothing was planned', () => {
		const message = eatOutMessage({
			title: null,
			movedToDays: null,
			movedToWeekday: null,
			keptBy: null,
			firstInLine: { itemKey: 'spinach', tonight: false }
		});
		expect(message).toBe(
			'Enjoy! The spinach won’t last past tomorrow, so it’s first in line tomorrow.'
		);
	});

	it('tells where the replaced dinner moved', () => {
		const message = pickMessage({
			title: 'Pea gnocchi',
			slot: 'dinner',
			tomorrow: false,
			moved: { title: 'Lentil dal', weekday: 2 },
			missing: []
		});
		expect(message).toBe('Pea gnocchi tonight. Lentil dal moves to Wednesday.');
	});

	it('rounds grams the way a cook reads them', () => {
		expect(formatAmount(437, 'g')).toBe('440 g');
	});
});
