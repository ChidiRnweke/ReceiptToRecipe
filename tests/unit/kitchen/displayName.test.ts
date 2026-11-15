import { describe, it, expect } from 'vitest';
import type { KitchenEvent } from '../../../src/lib/models/kitchen';
import { projectKitchen, stockAt } from '../../../src/lib/services/kitchen';
import { DAY0, TZ, at, bought, cooked } from '../../helpers/kitchenEvents';

function named(event: KitchenEvent, name: string): KitchenEvent {
	return { ...event, payload: { ...event.payload, name } };
}

function nameOf(events: KitchenEvent[], itemKey: string): string | undefined {
	const stock = stockAt(projectKitchen(events, at(3, 21), TZ), DAY0 + 3);
	return stock.find((item) => item.itemKey === itemKey)?.name;
}

describe('display names in the kitchen picture', () => {
	it('shows the name the purchase recorded', () => {
		expect(nameOf([named(bought('egg', 6, 'count', 0), 'Eggs')], 'egg')).toBe('Eggs');
	});

	it('falls back to the key with a capital when no event named the item', () => {
		expect(nameOf([bought('egg', 6, 'count', 0)], 'egg')).toBe('Egg');
	});

	it('shows the most recent name across purchases', () => {
		const events = [
			named(bought('tomato', 4, 'count', 0), 'Tomatoes'),
			named(bought('tomato', 6, 'count', 1), 'Cherry tomatoes')
		];
		expect(nameOf(events, 'tomato')).toBe('Cherry tomatoes');
	});

	it('takes a newer name from the recipe that cooked with the item', () => {
		const events = [
			named(bought('spinach', 500, 'g', 0), 'Spinach'),
			cooked(1, [{ itemKey: 'spinach', quantity: 100, unit: 'g', name: 'Baby spinach' }])
		];
		expect(nameOf(events, 'spinach')).toBe('Baby spinach');
	});

	it('names leftovers after the dish they came from', () => {
		const curry = cooked(2, [], { portions: 2, plannedMealId: 'meal-1' });
		const events = [{ ...curry, payload: { ...curry.payload, title: 'Saag paneer' } }];
		expect(nameOf(events, 'leftover:meal-1')).toBe('Saag paneer');
	});

	it('calls leftovers of an unnamed dish "Leftovers"', () => {
		const events = [cooked(2, [], { portions: 2, plannedMealId: 'meal-1' })];
		expect(nameOf(events, 'leftover:meal-1')).toBe('Leftovers');
	});
});

describe('an item that has gone off', () => {
	it('keeps the amount there is to bin', () => {
		const stock = stockAt(
			projectKitchen([bought('milk', 1000, 'ml', 0, { expiresInDays: 1 })], at(3, 21), TZ),
			DAY0 + 3
		);
		expect(stock[0].quantity).toBe(1000);
	});
});
