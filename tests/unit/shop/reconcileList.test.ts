import { describe, it, expect } from 'vitest';
import { buildShopNeeds, reconcileList } from '../../../src/lib/services/shop';
import type { ListItem, ReconcilePlan, ShopNeeds } from '../../../src/lib/models/shop';
import { TZ } from '../../helpers/kitchenEvents';
import { meal, MON_THU, need, WEDNESDAY_EVENING } from './fixtures';

const habits = { shopDays: MON_THU, usuals: [] as string[] };

function needsFor(...meals: Parameters<typeof buildShopNeeds>[1]): ShopNeeds {
	return buildShopNeeds([], meals, habits, WEDNESDAY_EVENING, TZ);
}

let sequence = 0;

/** The list after the plan is written, the way the shop service writes it. */
function apply(items: ListItem[], plan: ReconcilePlan): ListItem[] {
	const kept = items
		.filter((item) => !plan.remove.includes(item.id))
		.map((item) => {
			const update = plan.update.find((u) => u.id === item.id);
			return update ? { ...item, ...update.patch } : item;
		});
	const created = plan.create.map((item) => ({
		...item,
		id: `item-${++sequence}`,
		checked: false
	}));
	return [...kept, ...created];
}

function manual(name: string): ListItem {
	return {
		id: `manual-${++sequence}`,
		name,
		source: 'MANUAL',
		mergeKey: name,
		quantity: 1,
		unit: 'count',
		checked: false,
		heldUntil: null,
		forPlannedMealIds: []
	};
}

const thursday = meal('thu', 3, [need('spinach', 100, 'g'), need('paneer', 200, 'g')]);
const saturday = meal('sat', 5, [need('lemon', 1, 'count')]);
const tuesday = meal('tue', 8, [need('coriander', 1, 'bunch')]);

describe('reconcileList', () => {
	it('adds a plan row for each item a dish needs', () => {
		const plan = reconcileList([], needsFor(thursday));
		expect(plan.create.map((item) => [item.source, item.mergeKey])).toEqual([
			['PLAN', 'spinach'],
			['PLAN', 'paneer']
		]);
	});

	it('changes nothing when reconciled twice', () => {
		const needs = needsFor(thursday, saturday, tuesday);
		const list = apply([], reconcileList([], needs));
		expect(reconcileList(list, needs)).toEqual({ create: [], update: [], remove: [] });
	});

	it('removes a plan row whose dish left the plan', () => {
		const list = apply([], reconcileList([], needsFor(thursday, saturday)));
		const lemon = list.find((item) => item.mergeKey === 'lemon');
		expect(reconcileList(list, needsFor(thursday)).remove).toEqual([lemon?.id]);
	});

	it('updates the amount when the dish needs more', () => {
		const list = apply([], reconcileList([], needsFor(saturday)));
		const more = meal('sat', 5, [need('lemon', 3, 'count')]);
		expect(reconcileList(list, needsFor(more)).update[0].patch).toEqual({ quantity: 3 });
	});

	it('never removes an item a person added', () => {
		const list = [manual('spinach')];
		expect(reconcileList(list, needsFor()).remove).toEqual([]);
	});

	it('never updates an item a person added', () => {
		const list = [manual('spinach')];
		expect(reconcileList(list, needsFor(thursday)).update).toEqual([]);
	});

	it('never removes a ticked plan row, even when its dish left the plan', () => {
		const list = apply([], reconcileList([], needsFor(saturday))).map((item) => ({
			...item,
			checked: true
		}));
		expect(reconcileList(list, needsFor()).remove).toEqual([]);
	});

	it('never updates a ticked plan row', () => {
		const list = apply([], reconcileList([], needsFor(saturday))).map((item) => ({
			...item,
			checked: true
		}));
		const more = meal('sat', 5, [need('lemon', 3, 'count')]);
		expect(reconcileList(list, needsFor(more)).update).toEqual([]);
	});

	it('does not add an item again while a ticked row stands for it', () => {
		const list = apply([], reconcileList([], needsFor(saturday))).map((item) => ({
			...item,
			checked: true
		}));
		expect(reconcileList(list, needsFor(saturday)).create).toEqual([]);
	});

	it('holds a later dish’s items until the shop after next', () => {
		const needs = needsFor(tuesday);
		expect(reconcileList([], needs).create[0].heldUntil).toEqual(needs.afterShop?.at);
	});

	it('remembers every dish an item is for', () => {
		const plan = reconcileList([], needsFor(thursday, meal('sat', 5, [need('spinach', 50, 'g')])));
		const spinach = plan.create.find((item) => item.mergeKey === 'spinach');
		expect(spinach?.forPlannedMealIds).toEqual(['thu', 'sat']);
	});
});
