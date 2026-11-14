import { describe, it, expect, beforeEach } from 'vitest';
import { createPlan } from '../../fakes/plan';
import { actor } from '../../fakes/tonight';
import { DAY0, TZ, at } from '../../helpers/kitchenEvents';

// Day 0 of the test calendar is Monday 2 November 2026, in UTC. "Now" is Sunday 10:00.
const NOW = at(6, 10);

describe('PlanController', () => {
	let p: ReturnType<typeof createPlan>;
	let curry: { id: string; title: string };
	let soup: { id: string; title: string };

	beforeEach(async () => {
		p = createPlan();
		curry = await p.addRecipe('Chickpea curry', [{ name: 'Chickpeas', quantity: 1, unit: 'can' }]);
		soup = await p.addRecipe('Lentil soup', [{ name: 'Lentils', quantity: 200, unit: 'g' }]);
	});

	describe('markPrepDone', () => {
		it('records a COOKED event for each prep meal of the day', async () => {
			await p.plan.planBatchPrep(actor, DAY0 + 6, [curry.id, soup.id], 2, TZ);
			await p.planController.markPrepDone(actor, NOW, TZ, DAY0 + 6);
			const events = await p.events.listByHouseholdSince(actor.householdId, at(0));
			expect(events.filter((event) => event.kind === 'COOKED')).toHaveLength(2);
		});

		it('records the boxes as portions put aside', async () => {
			await p.plan.planBatchPrep(actor, DAY0 + 6, [curry.id], 3, TZ);
			await p.planController.markPrepDone(actor, NOW, TZ, DAY0 + 6);
			const [event] = await p.events.listByHouseholdSince(actor.householdId, at(0));
			expect(event?.portions).toBe(3);
		});

		it('shows the boxes as filled afterwards', async () => {
			await p.plan.planBatchPrep(actor, DAY0 + 6, [curry.id, soup.id], 2, TZ);
			await p.planController.markPrepDone(actor, NOW, TZ, DAY0 + 6);
			const view = await p.planController.getPlan(actor, NOW, TZ);
			expect(view.prep?.done).toBe(true);
		});
	});

	describe('getPlan', () => {
		it('asks the plan question', async () => {
			const view = await p.planController.getPlan(actor, NOW, TZ);
			expect(view.question).toBe('What’s the *plan*?');
		});

		it('shows ten days on the strip', async () => {
			const view = await p.planController.getPlan(actor, NOW, TZ);
			expect(view.days).toHaveLength(10);
		});

		it('marks a dinner cooked for two days with tomorrow’s lunch', async () => {
			const dinner = await p.planOn(curry, DAY0 + 6);
			await p.planController.cookForTwoDays(actor, TZ, dinner.id);
			const view = await p.planController.getPlan(actor, NOW, TZ, {
				start: DAY0 + 6,
				end: DAY0 + 7
			});
			expect(view.slots[0]?.meal?.withLunch).toBe(true);
		});

		it('says which lunch cooking for two days sorted', async () => {
			const dinner = await p.planOn(curry, DAY0 + 6);
			const result = await p.planController.cookForTwoDays(actor, TZ, dinner.id);
			expect(result.message).toBe('Monday’s lunch is sorted: chickpea curry.');
		});
	});
});
