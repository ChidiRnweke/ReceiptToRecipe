import { describe, it, expect, beforeEach } from 'vitest';
import type { Actor } from '../../../src/lib/models/household';
import { at, DAY0 } from '../../helpers/kitchenEvents';
import { createNeedsYou } from '../../fakes/needsyou';
import { shopper } from '../../fakes/shop';

/** Wednesday 4 November 2026, 18:00 UTC. */
const NOW = at(2, 18);
const TZ = 'UTC';

const sam: Actor = {
	...shopper,
	userId: 'user-2',
	memberId: 'member-2',
	displayName: 'Sam Haddad'
};

describe('NeedsYouController', () => {
	let t: ReturnType<typeof createNeedsYou>;

	beforeEach(async () => {
		t = createNeedsYou();
		await t.seatShopper();
	});

	const items = async (actor: Actor = shopper) => (await t.needsYou.list(actor, NOW, TZ)).items;
	const keyOf = async (kind: string) => (await items()).find((item) => item.kind === kind)!.key;

	/** Milk that went off on Tuesday. */
	async function milkGoneOff() {
		await t.kitchen.recordBought(
			shopper,
			[{ name: 'Milk', quantity: 1000, unit: 'ml', expiresAt: at(1, 10) }],
			at(0, 10),
			'receipt'
		);
	}

	/** Thursday and Monday shops at 10:00 teach a shop day nobody confirmed yet. */
	async function learnShopDays() {
		for (const day of [-11, -7, -4, 0]) {
			await t.kitchen.recordShopDone({
				author: shopper,
				method: 'RECEIPT',
				items: [],
				at: at(day, 10)
			});
		}
	}

	it('counts the questions', async () => {
		await milkGoneOff();
		expect((await t.needsYou.list(shopper, NOW, TZ)).count).toBe(1);
	});

	describe('answer', () => {
		it('"Binned" takes the item out of the kitchen', async () => {
			await milkGoneOff();
			const key = await keyOf('ProbablyGoneOff');
			await t.needsYou.answer(shopper, { key, command: 'kitchen.gone' }, NOW, TZ);
			const picture = await t.kitchen.getPicture(shopper.householdId, NOW, TZ);
			expect(picture.stock.map((item) => item.itemKey)).toEqual([]);
		});

		it('"Still good" keeps the item and stops the question', async () => {
			await milkGoneOff();
			const key = await keyOf('ProbablyGoneOff');
			await t.needsYou.answer(shopper, { key, command: 'kitchen.stillGood' }, NOW, TZ);
			expect(await items()).toEqual([]);
		});

		it('"Yes" to the shop-day offer confirms the shop days', async () => {
			await learnShopDays();
			const key = await keyOf('ShopDayOffer');
			await t.needsYou.answer(shopper, { key, command: 'habit.acceptShopDays' }, NOW, TZ);
			const habits = await t.habits.getHabits(shopper.householdId, NOW, TZ);
			expect(habits.shopDays.every((day) => day.confirmed)).toBe(true);
		});

		it('"Not now" stops the offer without changing the habits', async () => {
			await learnShopDays();
			const key = await keyOf('ShopDayOffer');
			await t.needsYou.answer(shopper, { key, command: 'dismiss' }, NOW, TZ);
			expect((await items()).map((item) => item.kind)).not.toContain('ShopDayOffer');
		});

		it('keeps "Not now" from changing the learned shop days', async () => {
			await learnShopDays();
			const key = await keyOf('ShopDayOffer');
			await t.needsYou.answer(shopper, { key, command: 'dismiss' }, NOW, TZ);
			const habits = await t.habits.getHabits(shopper.householdId, NOW, TZ);
			expect(habits.shopDays.map((day) => day.weekday).sort()).toEqual([0, 3]);
		});

		it('"Get it on the way" puts what the meal lacks on the list', async () => {
			const shakshuka = await t.addRecipe('Shakshuka', [
				{ name: 'Eggs', quantity: 4, unit: 'pcs' }
			]);
			await t.planOn(shakshuka, DAY0 + 3);
			await t.kitchen.recordBought(shopper, [{ name: 'Rice', quantity: 1 }], at(0, 10), 'receipt');
			const key = await keyOf('MissingBeforeMeal');
			await t.needsYou.answer(shopper, { key, command: 'tonight.quickGet' }, NOW, TZ);
			expect(t.items.getAllStored().map((item) => item.name)).toEqual(['Eggs']);
		});

		it('"Got everything" closes the shop the way the Shop door does', async () => {
			await t.habitAnswers.save({
				householdId: shopper.householdId,
				key: 'shopDay:2',
				answer: 'accepted',
				answeredBy: shopper.userId,
				answeredAt: at(-1)
			});
			for (const day of [-12, -5]) {
				await t.kitchen.recordShopDone({
					author: shopper,
					method: 'TICK',
					items: [],
					at: at(day, 16)
				});
			}
			await t.shopService.addManual(shopper, { name: 'Bread' });
			const key = await keyOf('BackFromShop');
			await t.needsYou.answer(shopper, { key, command: 'shop.gotEverything' }, NOW, TZ);
			const last = t.events
				.all(shopper.householdId)
				.filter((event) => event.kind === 'SHOP_DONE')
				.at(-1);
			expect(last?.occurredAt).toEqual(NOW);
		});

		it('refuses a command the question does not offer', async () => {
			await milkGoneOff();
			const key = await keyOf('ProbablyGoneOff');
			await expect(
				t.needsYou.answer(shopper, { key, command: 'shop.gotEverything' }, NOW, TZ)
			).rejects.toThrow('Question not found');
		});
	});

	describe('household events', () => {
		let undoId: string | null;

		beforeEach(async () => {
			await t.households.createMember({
				householdId: shopper.householdId,
				userId: sam.userId,
				displayName: 'Sam Haddad'
			});
			await t.kitchen.recordBought(sam, [{ name: 'Rice', quantity: 1 }], at(0, 10), 'receipt');
			await t.shopService.addManual(sam, { name: 'Oat milk' });
			({ undoId } = await t.controller.gotEverything(sam, at(2, 17), TZ));
		});

		it('tells another member that Sam got the shopping', async () => {
			expect((await items()).map((item) => item.text)).toContain('Sam got the shopping');
		});

		it('does not tell Sam about his own shop', async () => {
			expect((await items(sam)).map((item) => item.kind)).not.toContain('HouseholdEvent');
		});

		it('forgets the news when the shop is undone', async () => {
			await t.controller.undoGotEverything(sam, undoId!, NOW);
			expect((await items()).map((item) => item.kind)).not.toContain('HouseholdEvent');
		});
	});
});
