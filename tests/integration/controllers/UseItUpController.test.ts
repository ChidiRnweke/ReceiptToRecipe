import { describe, it, expect, beforeEach } from 'vitest';
import { at } from '../../helpers/kitchenEvents';
import { createNeedsYou } from '../../fakes/needsyou';
import { shopper } from '../../fakes/shop';

// Day 0 is Monday 2 November 2026 in UTC.
const NOW = at(2, 18);
const TZ = 'UTC';

describe('UseItUpController', () => {
	let t: ReturnType<typeof createNeedsYou>;

	/** Spinach (goes in two days), rice (keeps) and milk (gone off) came home on Monday. */
	beforeEach(async () => {
		t = createNeedsYou();
		await t.kitchen.recordBought(
			shopper,
			[
				{ name: 'Baby spinach', quantity: 200, unit: 'g', expiresAt: at(4, 10) },
				{ name: 'Rice', quantity: 1000, unit: 'g', category: 'pantry' },
				{ name: 'Milk', quantity: 1000, unit: 'ml', expiresAt: at(1, 10) }
			],
			at(0, 10),
			'receipt'
		);
	});

	const view = () => t.useItUp.get(shopper, NOW, TZ);
	const names = async () => {
		const v = await view();
		return [...v.eatFirst, ...v.everything].map((item) => item.name);
	};

	describe('get', () => {
		it('lists what needs eating first by the names people bought them as', async () => {
			expect((await view()).eatFirst.map((item) => item.name)).toEqual(['Milk', 'Baby spinach']);
		});

		it('keeps everything else under "Everything at home"', async () => {
			expect((await view()).everything.map((item) => item.name)).toEqual(['Rice']);
		});

		it('pins the front-of-the-fridge note just after a shop', async () => {
			await t.kitchen.recordShopClosed({
				author: shopper,
				method: 'TICK',
				itemCount: 3,
				at: at(2, 17)
			});
			expect((await view()).frontNames).toBe('baby spinach');
		});

		it('drops the note three hours after the shop', async () => {
			await t.kitchen.recordShopClosed({
				author: shopper,
				method: 'TICK',
				itemCount: 3,
				at: at(2, 14)
			});
			expect((await view()).frontNames).toBeNull();
		});
	});

	describe('markGone', () => {
		it('takes the item out of the kitchen', async () => {
			await t.useItUp.markGone(shopper, 'milk', NOW, TZ);
			expect(await names()).not.toContain('Milk');
		});

		it('brings the item back on undo', async () => {
			const { undoId } = await t.useItUp.markGone(shopper, 'milk', NOW, TZ);
			await t.useItUp.undoCorrection(shopper, undoId);
			expect(await names()).toContain('Milk');
		});

		it('names the item in its message', async () => {
			const { message } = await t.useItUp.markGone(shopper, 'baby spinach', NOW, TZ);
			expect(message).toBe('Baby spinach gone. If anything planned needed it, it’s on the list.');
		});
	});

	describe('stillGood', () => {
		const milk = async () => (await view()).eatFirst.find((item) => item.name === 'Milk');

		it('makes a gone-off item good again', async () => {
			await t.useItUp.stillGood(shopper, 'milk', NOW, TZ);
			expect((await milk())?.off).toBe(false);
		});

		it('puts the item back as gone off on undo', async () => {
			const { undoId } = await t.useItUp.stillGood(shopper, 'milk', NOW, TZ);
			await t.useItUp.undoCorrection(shopper, undoId);
			expect((await milk())?.off).toBe(true);
		});
	});

	describe('undoCorrection', () => {
		it('refuses to take back a purchase from a receipt', async () => {
			const receiptEvent = t.events.all(shopper.householdId)[0];
			await expect(t.useItUp.undoCorrection(shopper, receiptEvent.id)).rejects.toThrow(
				'Change not found'
			);
		});
	});

	describe('addItem and setQuantity', () => {
		it('adds something that came home without a receipt', async () => {
			await t.useItUp.addItem(shopper, { name: 'Eggs', quantity: 6 }, NOW);
			expect(await names()).toContain('Eggs');
		});

		it('takes an added item back on undo', async () => {
			const { undoId } = await t.useItUp.addItem(shopper, { name: 'Eggs', quantity: 6 }, NOW);
			await t.useItUp.undoCorrection(shopper, undoId);
			expect(await names()).not.toContain('Eggs');
		});

		it('sets how much is left', async () => {
			await t.useItUp.setQuantity(shopper, { itemKey: 'rice', quantity: 250 }, NOW, TZ);
			expect((await view()).everything[0].amount).toBe('250 g');
		});
	});
});
