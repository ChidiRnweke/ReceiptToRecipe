import { describe, it, expect, beforeEach } from 'vitest';
import type { Actor } from '../../../src/lib/models/household';
import type { ShopMethod } from '../../../src/lib/models/kitchen';
import { at, DAY0 } from '../../helpers/kitchenEvents';
import { createShop, shopper, stranger } from '../../fakes/shop';

/** Wednesday 4 November 2026, 18:00 UTC: the evening before Thursday's shop. */
const NOW = at(2, 18);
const TZ = 'UTC';

type Shop = ReturnType<typeof createShop>;

/** Two Thursday and two Monday shops in the past teach the household its shop days. */
async function learnShopDays(shop: Shop, method: ShopMethod = 'RECEIPT', author = shopper) {
	for (const day of [-11, -7, -4, 0]) {
		await shop.kitchen.recordShopDone({ author, method, items: [], at: at(day, 10) });
	}
}

/** Saag on Thursday, risotto on Saturday, and a coriander dish next Tuesday. */
async function planTheWeek(shop: Shop) {
	const saag = await shop.addRecipe('Saag paneer', [
		{ name: 'spinach', quantity: 300, unit: 'g' },
		{ name: 'paneer', quantity: 200, unit: 'g' }
	]);
	const risotto = await shop.addRecipe('Mushroom risotto', [
		{ name: 'mushrooms', quantity: 250, unit: 'g' }
	]);
	const tacos = await shop.addRecipe('Fish tacos', [
		{ name: 'coriander', quantity: 1, unit: 'bunch' }
	]);
	await shop.planOn(saag, DAY0 + 3);
	await shop.planOn(risotto, DAY0 + 5);
	await shop.planOn(tacos, DAY0 + 8);
}

function bought(shop: Shop): string[] {
	return shop.events
		.all(shopper.householdId)
		.filter((event) => event.kind === 'BOUGHT')
		.map((event) => event.itemKey as string)
		.sort();
}

async function openItems(shop: Shop) {
	const view = await shop.controller.getShop(shopper, NOW, TZ);
	return view.groups.flatMap((group) => group.items);
}

describe('ShopController', () => {
	let shop: Shop;

	beforeEach(async () => {
		shop = createShop();
		await learnShopDays(shop);
		await planTheWeek(shop);
	});

	describe('getShop', () => {
		it('titles the list after the learned shop', async () => {
			expect((await shop.controller.getShop(shopper, NOW, TZ)).title).toBe('Thursday’s shop');
		});

		it('groups the list by the dish each item is for', async () => {
			const view = await shop.controller.getShop(shopper, NOW, TZ);
			expect(view.groups.map((group) => group.title)).toEqual(['Saag paneer', 'Mushroom risotto']);
		});

		it('labels the dish of a prep session as a prep', async () => {
			const lea = createShop();
			await learnShopDays(lea);
			const stew = await lea.addRecipe('Lentil stew', [
				{ name: 'lentils', quantity: 400, unit: 'g' }
			]);
			const meal = await lea.planOn(stew, DAY0 + 3);
			// The Plan door's prep flag on planned meals.
			Object.assign((await lea.plannedMeals.findById(meal.id))!, { isPrep: true });
			const view = await lea.controller.getShop(shopper, NOW, TZ);
			expect(view.groups.map((group) => group.when)).toEqual(['Tomorrow, prep']);
		});

		it('holds next Tuesday’s coriander for Monday’s shop', async () => {
			const view = await shop.controller.getShop(shopper, NOW, TZ);
			expect(view.held).toEqual({
				shop: 'Monday’s shop',
				items: [{ name: 'Coriander', days: ['Tue'], amount: '1' }]
			});
		});

		it('writes the plan’s items to the list only once', async () => {
			await shop.controller.getShop(shopper, NOW, TZ);
			await shop.controller.getShop(shopper, NOW, TZ);
			expect(shop.items.getAllStored().length).toBe(4);
		});

		it('keeps an item added by hand', async () => {
			await shop.controller.addItem(shopper, { name: 'Dish soap' });
			const view = await shop.controller.getShop(shopper, NOW, TZ);
			expect(view.manual.map((item) => item.name)).toEqual(['Dish soap']);
		});

		it('notes that an item added by hand may still be at home', async () => {
			await shop.kitchen.recordBought(
				shopper,
				[{ name: 'rice', quantity: 1000, unit: 'g' }],
				at(0, 10),
				'manual'
			);
			await shop.controller.addItem(shopper, { name: 'Rice' });
			const view = await shop.controller.getShop(shopper, NOW, TZ);
			expect(view.manual.map((item) => item.atHome)).toEqual([true]);
		});

		it('adds no note to an item added by hand that is not at home', async () => {
			await shop.controller.addItem(shopper, { name: 'Rice' });
			const view = await shop.controller.getShop(shopper, NOW, TZ);
			expect(view.manual.map((item) => item.atHome)).toEqual([false]);
		});

		it('counts the things on the list', async () => {
			expect((await shop.controller.getShop(shopper, NOW, TZ)).count).toBe(3);
		});

		it('offers ideas to a household that does not plan and has nothing planned', async () => {
			const lea = createShop();
			await lea.addRecipe('Omelette', [{ name: 'eggs', quantity: 3, unit: '' }]);
			expect((await lea.controller.getShop(shopper, NOW, TZ)).mode).toBe('ideas');
		});
	});

	describe('the done habit', () => {
		it('is the receipt for a member who has not shown one', async () => {
			expect((await shop.controller.getShop(shopper, NOW, TZ)).doneHabit).toBe('RECEIPT');
		});

		it('is ticking for a member who closes shops by ticking', async () => {
			const ticker = createShop();
			const member = await ticker.households.createMember({
				householdId: shopper.householdId,
				userId: shopper.userId,
				displayName: 'Noor'
			});
			const actor: Actor = { ...shopper, memberId: member.id };
			await learnShopDays(ticker, 'TICK', actor);
			expect((await ticker.controller.getShop(actor, NOW, TZ)).doneHabit).toBe('TICK');
		});
	});

	describe('toggleItem', () => {
		it('ticks the item', async () => {
			const [first] = await openItems(shop);
			await shop.controller.toggleItem(shopper, first.id, true);
			expect(shop.items.getStored(first.id)?.checked).toBe(true);
		});

		it('refuses an item of another household', async () => {
			const [first] = await openItems(shop);
			await expect(shop.controller.toggleItem(stranger, first.id, true)).rejects.toThrow(
				'Item not found'
			);
		});
	});

	describe('gotEverything', () => {
		it('records the whole list as bought when nothing is ticked', async () => {
			await shop.controller.getShop(shopper, NOW, TZ);
			await shop.controller.gotEverything(shopper, NOW, TZ);
			expect(bought(shop)).toEqual(['mushrooms', 'paneer', 'spinach']);
		});

		it('records only the ticked items when some are ticked', async () => {
			const items = await openItems(shop);
			const spinach = items.find((item) => item.name === 'Spinach');
			await shop.controller.toggleItem(shopper, spinach!.id, true);
			await shop.controller.gotEverything(shopper, NOW, TZ);
			expect(bought(shop)).toEqual(['spinach']);
		});

		it('leaves the unticked items on the list', async () => {
			const items = await openItems(shop);
			const spinach = items.find((item) => item.name === 'Spinach');
			await shop.controller.toggleItem(shopper, spinach!.id, true);
			await shop.controller.gotEverything(shopper, NOW, TZ);
			const left = shop.items.getAllStored().filter((item) => item.heldUntil === null);
			expect(left.map((item) => item.name).sort()).toEqual(['Mushrooms', 'Paneer']);
		});

		it('keeps the held-back items for the later shop', async () => {
			await shop.controller.getShop(shopper, NOW, TZ);
			await shop.controller.gotEverything(shopper, NOW, TZ);
			expect(shop.items.getAllStored().map((item) => item.name)).toEqual(['Coriander']);
		});

		it('closes the shop with method TICK', async () => {
			await shop.controller.getShop(shopper, NOW, TZ);
			await shop.controller.gotEverything(shopper, NOW, TZ);
			const last = shop.events
				.all(shopper.householdId)
				.filter((event) => event.kind === 'SHOP_DONE')
				.at(-1);
			expect(last?.method).toBe('TICK');
		});

		it('plans the dinners picked from ideas', async () => {
			const lea = createShop();
			const omelette = await lea.addRecipe('Omelette', [{ name: 'eggs', quantity: 3, unit: '' }]);
			await lea.controller.gotEverything(shopper, NOW, TZ, [omelette.id]);
			const planned = await lea.plan.listMeals(shopper.householdId, DAY0, DAY0 + 7, TZ);
			expect(planned.map((meal) => meal.recipeId)).toEqual([omelette.id]);
		});
	});

	describe('undoing Got everything', () => {
		async function gotItAndUndo() {
			await shop.controller.getShop(shopper, NOW, TZ);
			const { undoId } = await shop.controller.gotEverything(shopper, NOW, TZ);
			await shop.controller.undoGotEverything(shopper, undoId!);
		}

		const tickShops = () =>
			shop.events
				.all(shopper.householdId)
				.filter((event) => event.kind === 'SHOP_DONE' && event.method === 'TICK');

		it('puts the items back on the list', async () => {
			await gotItAndUndo();
			const names = shop.items.getAllStored().map((item) => item.name);
			expect(names.sort()).toEqual(['Coriander', 'Mushrooms', 'Paneer', 'Spinach']);
		});

		it('keeps a ticked item ticked', async () => {
			const items = await openItems(shop);
			await shop.controller.toggleItem(shopper, items.find((i) => i.name === 'Spinach')!.id, true);
			const { undoId } = await shop.controller.gotEverything(shopper, NOW, TZ);
			await shop.controller.undoGotEverything(shopper, undoId!);
			const spinach = shop.items.getAllStored().find((item) => item.name === 'Spinach');
			expect(spinach?.checked).toBe(true);
		});

		it('takes the items out of the kitchen', async () => {
			await gotItAndUndo();
			expect(bought(shop)).toEqual([]);
		});

		it('forgets the shop', async () => {
			await gotItAndUndo();
			expect(tickShops()).toEqual([]);
		});

		it('takes the purchases out of the purchase history', async () => {
			await gotItAndUndo();
			expect(shop.history.getAll()).toEqual([]);
		});

		it('puts an earlier purchase count back', async () => {
			await shop.controller.getShop(shopper, NOW, TZ);
			await shop.controller.gotEverything(shopper, NOW, TZ);
			await shop.controller.addItem(shopper, { name: 'Paneer' });
			const { undoId } = await shop.controller.gotEverything(shopper, at(3, 18), TZ);
			await shop.controller.undoGotEverything(shopper, undoId!);
			const paneer = shop.history.getAll().find((entry) => entry.itemName === 'Paneer');
			expect(paneer?.purchaseCount).toBe(1);
		});

		it('refuses the shop of another household', async () => {
			await shop.controller.getShop(shopper, NOW, TZ);
			const { undoId } = await shop.controller.gotEverything(shopper, NOW, TZ);
			await expect(shop.controller.undoGotEverything(stranger, undoId!)).rejects.toThrow(
				'Shop not found'
			);
		});

		it('is not offered when dinners were planned from ideas', async () => {
			const lea = createShop();
			const omelette = await lea.addRecipe('Omelette', [{ name: 'eggs', quantity: 3, unit: '' }]);
			const result = await lea.controller.gotEverything(shopper, NOW, TZ, [omelette.id]);
			expect(result.undoId).toBeNull();
		});
	});

	describe('a snapped receipt', () => {
		async function snapSpinachAndYogurt() {
			await shop.controller.getShop(shopper, NOW, TZ);
			return shop.snap([
				{ name: 'spinach', quantity: '300g' },
				{ name: 'mushrooms', quantity: '250g' },
				{ name: 'yogurt', quantity: '500g' }
			]);
		}

		it('counts the lines that matched the list', async () => {
			const receiptId = await snapSpinachAndYogurt();
			const result = await shop.controller.getReceiptResult(shopper, receiptId, TZ);
			expect(result.cameHome?.matched).toBe(2);
		});

		/** What a sync in another tab does once the kitchen holds the receipt's lines. */
		async function syncDropsTheBoughtItems() {
			const bought = shop.items
				.getAllStored()
				.filter((item) => item.name === 'Spinach' || item.name === 'Mushrooms');
			await shop.shopService.removeItems(
				shopper,
				bought.map((item) => item.id)
			);
		}

		it('counts the matches against the list at the photo, after a sync while it was read', async () => {
			const receiptId = await snapSpinachAndYogurt();
			await syncDropsTheBoughtItems();
			const result = await shop.controller.getReceiptResult(shopper, receiptId, TZ);
			expect(result.cameHome?.matched).toBe(2);
		});

		it('settles the list after a sync while it was read', async () => {
			const receiptId = await snapSpinachAndYogurt();
			await syncDropsTheBoughtItems();
			await shop.controller.confirmWhatCameHome(shopper, receiptId);
			const left = shop.items.getAllStored().filter((item) => item.heldUntil === null);
			expect(left.map((item) => item.name)).toEqual(['Paneer']);
		});

		it('names the lines that were not on the list', async () => {
			const receiptId = await snapSpinachAndYogurt();
			const result = await shop.controller.getReceiptResult(shopper, receiptId, TZ);
			expect(result.cameHome?.extras.map((extra) => extra.name)).toEqual(['Yogurt']);
		});

		it('keeps what the receipt did not have on the list after Looks right', async () => {
			const receiptId = await snapSpinachAndYogurt();
			await shop.controller.confirmWhatCameHome(shopper, receiptId);
			const left = shop.items.getAllStored().filter((item) => item.heldUntil === null);
			expect(left.map((item) => item.name)).toEqual(['Paneer']);
		});

		it('unticks a ticked item the receipt did not have', async () => {
			const items = await openItems(shop);
			const paneer = items.find((item) => item.name === 'Paneer');
			await shop.controller.toggleItem(shopper, paneer!.id, true);
			const receiptId = await snapSpinachAndYogurt();
			await shop.controller.confirmWhatCameHome(shopper, receiptId);
			expect(shop.items.getStored(paneer!.id)?.checked).toBe(false);
		});

		it('records each receipt line as bought once, with the OCR job and Looks right', async () => {
			const receiptId = await snapSpinachAndYogurt();
			await shop.controller.confirmWhatCameHome(shopper, receiptId);
			expect(bought(shop)).toEqual(['mushrooms', 'spinach', 'yogurt']);
		});

		it('closes the shop once, with method RECEIPT', async () => {
			const receiptId = await snapSpinachAndYogurt();
			await shop.controller.confirmWhatCameHome(shopper, receiptId);
			const receiptShops = shop.events
				.all(shopper.householdId)
				.filter((event) => event.kind === 'SHOP_DONE' && event.payload?.receiptId === receiptId);
			expect(receiptShops.map((event) => event.method)).toEqual(['RECEIPT']);
		});

		it('refuses the receipt of another household', async () => {
			const receiptId = await snapSpinachAndYogurt();
			await expect(shop.controller.getReceiptResult(stranger, receiptId, TZ)).rejects.toThrow(
				'Receipt not found'
			);
		});
	});

	describe('removeItem', () => {
		it('removes an item added by hand', async () => {
			await shop.controller.addItem(shopper, { name: 'Dish soap' });
			const [soap] = shop.items.getAllStored();
			await shop.controller.removeItem(shopper, soap.id);
			expect(shop.items.getAllStored()).toEqual([]);
		});

		it('puts a removed item back with its undo', async () => {
			await shop.controller.addItem(shopper, { name: 'Dish soap', quantity: 2 });
			const [soap] = shop.items.getAllStored();
			const removed = await shop.controller.removeItem(shopper, soap.id);
			await shop.controller.restoreItem(shopper, removed);
			const view = await shop.controller.getShop(shopper, NOW, TZ);
			expect(view.manual.map((item) => `${item.name} ${item.amount}`)).toEqual(['Dish soap 2']);
		});

		it('refuses to remove an item the plan wrote', async () => {
			const [first] = await openItems(shop);
			await expect(shop.controller.removeItem(shopper, first.id)).rejects.toThrow();
		});
	});
});
