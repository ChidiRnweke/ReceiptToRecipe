import { describe, it, expect } from 'vitest';
import type { HouseholdEvent } from '../../../src/lib/models/household';
import type { Habits } from '../../../src/lib/models/kitchen';
import type { NeedsYouItem, NeedsYouKind } from '../../../src/lib/models/needsyou';
import { dayNumber, localHour } from '../../../src/lib/services/kitchen';
import {
	collectNeedsYou,
	type NeedsYouContext,
	type NeedsYouMeal
} from '../../../src/lib/services/needsyou';
import type { RankStock } from '../../../src/lib/services/tonight';
import { DAY0, TZ, at } from '../../helpers/kitchenEvents';

// Day 0 is Monday 2 November 2026 in UTC. Thursday is day 3.
const NOON = at(0, 12);

const habits = (overrides: Partial<Habits> = {}): Habits => ({
	shopDays: [],
	planningEvenings: [],
	doneHabitByMember: {},
	prepDay: null,
	planningStyle: 'none',
	usuals: [],
	...overrides
});

const stock = (itemKey: string, name: string, expiresIn: number, o: Partial<RankStock> = {}) => ({
	itemKey,
	name,
	quantity: 1,
	unit: 'count',
	expiresOn: DAY0 + expiresIn,
	known: true,
	off: false,
	perishable: true,
	...o
});

const meal = (o: Partial<NeedsYouMeal> & Pick<NeedsYouMeal, 'id' | 'title'>): NeedsYouMeal => ({
	day: DAY0,
	mealType: 'DINNER',
	status: 'PLANNED',
	isPrep: false,
	leftover: false,
	hoursAway: 7,
	ingredients: [],
	missing: [],
	...o
});

function context(overrides: Partial<NeedsYouContext> = {}): NeedsYouContext {
	const now = overrides.now ?? NOON;
	return {
		now,
		timeZone: TZ,
		today: dayNumber(now, TZ),
		hour: localHour(now, TZ),
		viewer: { userId: 'user-1', memberId: 'member-1', shops: true, joinedAt: at(-30) },
		members: [{ userId: 'user-1', firstName: 'Noor' }],
		tracks: true,
		stock: [],
		tonight: null,
		meals: [],
		dinnerDays: [],
		habits: habits(),
		lastShopDoneAt: null,
		events: [],
		answered: new Set(),
		...overrides
	};
}

const event = (o: Partial<HouseholdEvent> = {}): HouseholdEvent => ({
	id: 'event-1',
	householdId: 'household-1',
	actorUserId: 'user-2',
	kind: 'SHOP_DONE',
	payload: {},
	createdAt: at(0, 10),
	...o
});

const texts = (items: NeedsYouItem[]) => items.map((item) => item.text);
const ofKind = (items: NeedsYouItem[], kind: NeedsYouKind) => items.filter((i) => i.kind === kind);

describe('collectNeedsYou', () => {
	describe('StillGotForTonight', () => {
		const feta = stock('feta', 'Feta', 2, { known: false });
		const shakshuka = meal({
			id: 'meal-1',
			title: 'Shakshuka',
			ingredients: [{ itemKey: 'feta', name: 'feta' }]
		});

		it('asks about an estimated perishable tonight’s meal needs', () => {
			const ctx = context({ now: at(0, 17), stock: [feta], tonight: shakshuka });
			expect(texts(collectNeedsYou(ctx))).toEqual(['Still got feta for tonight’s shakshuka?']);
		});

		it('does not ask about an amount the household confirmed', () => {
			const ctx = context({ stock: [{ ...feta, known: true }], tonight: shakshuka });
			expect(ofKind(collectNeedsYou(ctx), 'StillGotForTonight')).toEqual([]);
		});
	});

	describe('ProbablyGoneOff', () => {
		it('says a plural item "have" gone off', () => {
			const ctx = context({ stock: [stock('tomato', 'Tomatoes', -1, { off: true })] });
			expect(texts(collectNeedsYou(ctx))).toEqual(['Tomatoes have probably gone off']);
		});

		it('says a singular item "has" gone off', () => {
			const ctx = context({ stock: [stock('milk', 'Milk', -1, { off: true })] });
			expect(texts(collectNeedsYou(ctx))).toEqual(['Milk has probably gone off']);
		});
	});

	describe('GoesOffToday', () => {
		it('says a perishable goes off today', () => {
			const ctx = context({ stock: [stock('spinach', 'Spinach', 0)] });
			expect(texts(collectNeedsYou(ctx))).toEqual(['Spinach goes off today']);
		});

		it('says leftovers need eating today', () => {
			const lo = stock('leftover:meal-1', 'Saag paneer', 0, { perishable: false });
			expect(texts(collectNeedsYou(context({ stock: [lo] })))).toEqual([
				'Saag paneer needs eating today'
			]);
		});
	});

	describe('MissingBeforeMeal', () => {
		const tomorrow = meal({
			id: 'meal-2',
			title: 'Shakshuka',
			day: DAY0 + 1,
			hoursAway: 31,
			missing: ['eggs', 'feta']
		});

		it('names what a meal in the next two days lacks', () => {
			expect(texts(collectNeedsYou(context({ meals: [tomorrow] })))).toEqual([
				'Tomorrow’s shakshuka needs eggs and feta'
			]);
		});

		it('stays quiet when a learned shop comes before the meal', () => {
			// Monday 18:00 is a learned shop, before Tuesday's dinner.
			const ctx = context({
				meals: [tomorrow],
				habits: habits({ shopDays: [{ weekday: 0, hour: 18, confirmed: true }] })
			});
			expect(ofKind(collectNeedsYou(ctx), 'MissingBeforeMeal')).toEqual([]);
		});
	});

	describe('OpenPlanDays', () => {
		it('names the next three days without a dinner, for a household that plans', () => {
			const ctx = context({
				habits: habits({ planningStyle: 'few' }),
				dinnerDays: [DAY0 + 2]
			});
			expect(texts(collectNeedsYou(ctx))).toEqual(['Nothing planned for Tuesday and Thursday']);
		});

		it('does not ask a household that does not plan', () => {
			expect(ofKind(collectNeedsYou(context()), 'OpenPlanDays')).toEqual([]);
		});
	});

	describe('PrepDay', () => {
		it('asks on the prep day while the prep is not cooked', () => {
			const ctx = context({
				habits: habits({ prepDay: 0, planningStyle: 'prep' }),
				meals: [meal({ id: 'prep-1', title: 'Chilli', isPrep: true, mealType: 'PREP' })]
			});
			expect(texts(collectNeedsYou(ctx))).toEqual(['Prep day: lunches to cook']);
		});
	});

	describe('ShopDayOffer', () => {
		it('offers to plan around a learned shop day nobody confirmed', () => {
			const ctx = context({
				habits: habits({ shopDays: [{ weekday: 3, hour: 18, confirmed: false }] })
			});
			expect(texts(collectNeedsYou(ctx))).toEqual([
				'You seem to shop on Thursdays. Plan around that?'
			]);
		});

		it('does not offer a shop day the household confirmed', () => {
			const ctx = context({
				habits: habits({ shopDays: [{ weekday: 3, hour: 18, confirmed: true }] })
			});
			expect(ofKind(collectNeedsYou(ctx), 'ShopDayOffer')).toEqual([]);
		});
	});

	describe('BackFromShop', () => {
		// Monday's learned shop is at 18:00; it is now 19:30 and no shop was recorded.
		const shopHabits = (member: 'TICK' | 'RECEIPT' | null) =>
			habits({
				shopDays: [{ weekday: 0, hour: 18, confirmed: true }],
				doneHabitByMember: member ? { 'member-1': member } : {}
			});
		const back = (member: 'TICK' | 'RECEIPT' | null) =>
			ofKind(
				collectNeedsYou(context({ now: at(0, 19.5), habits: shopHabits(member) })),
				'BackFromShop'
			);

		it('asks whether the member is back from the shop', () => {
			expect(texts(back(null))).toEqual(['Back from Monday’s shop?']);
		});

		it('offers "Got everything" first to a member who ticks the list', () => {
			expect(back('TICK')[0].actions.map((a) => a.label)).toEqual([
				'Got everything',
				'Snap the receipt'
			]);
		});

		it('offers "Snap the receipt" first to a member who snaps receipts', () => {
			expect(back('RECEIPT')[0].actions.map((a) => a.label)).toEqual([
				'Snap the receipt',
				'Got everything'
			]);
		});

		it('stays quiet once the shop is recorded', () => {
			const ctx = context({
				now: at(0, 19.5),
				habits: shopHabits(null),
				lastShopDoneAt: at(0, 18.5)
			});
			expect(ofKind(collectNeedsYou(ctx), 'BackFromShop')).toEqual([]);
		});
	});

	describe('HouseholdEvent', () => {
		const members = [
			{ userId: 'user-1', firstName: 'Noor' },
			{ userId: 'user-2', firstName: 'Sam' }
		];

		it('says what another member did', () => {
			const ctx = context({ members, events: [event()] });
			expect(texts(collectNeedsYou(ctx))).toEqual(['Sam got the shopping']);
		});

		it('hides the viewer’s own events', () => {
			const ctx = context({ members, events: [event({ actorUserId: 'user-1' })] });
			expect(collectNeedsYou(ctx)).toEqual([]);
		});

		it('names the days another member planned', () => {
			const planned = event({ kind: 'PLANNED', payload: { from: DAY0 + 3, to: DAY0 + 6 } });
			expect(texts(collectNeedsYou(context({ members, events: [planned] })))).toEqual([
				'Sam planned Thu–Sun'
			]);
		});

		it('hides an event from before the viewer joined the household', () => {
			const ctx = context({
				members,
				viewer: { userId: 'user-1', memberId: 'member-1', shops: true, joinedAt: NOON },
				events: [event({ createdAt: new Date(NOON.getTime() - 60 * 1000) })]
			});
			expect(collectNeedsYou(ctx)).toEqual([]);
		});

		it('forgets an event older than ten hours', () => {
			const ctx = context({ members, now: at(0, 21), events: [event({ createdAt: at(0, 10) })] });
			expect(collectNeedsYou(ctx)).toEqual([]);
		});
	});

	describe('answers', () => {
		it('leaves out a question the member answered', () => {
			const ctx = context({
				stock: [stock('tomato', 'Tomatoes', -1, { off: true })],
				answered: new Set([`goneOff:tomato:${DAY0 - 1}`])
			});
			expect(collectNeedsYou(ctx)).toEqual([]);
		});

		it('leaves out a shop-day offer the member put off with "Not now"', () => {
			const ctx = context({
				habits: habits({ shopDays: [{ weekday: 3, hour: 18, confirmed: false }] }),
				answered: new Set(['shopDayOffer:3'])
			});
			expect(collectNeedsYou(ctx)).toEqual([]);
		});
	});

	it('lists the kinds in their fixed order', () => {
		const ctx = context({
			now: at(0, 17),
			stock: [
				stock('feta', 'Feta', 2, { known: false }),
				stock('milk', 'Milk', -1, { off: true }),
				stock('spinach', 'Spinach', 0)
			],
			tonight: meal({
				id: 'm',
				title: 'Shakshuka',
				ingredients: [{ itemKey: 'feta', name: 'feta' }]
			}),
			habits: habits({ shopDays: [{ weekday: 3, hour: 18, confirmed: false }] })
		});
		expect(collectNeedsYou(ctx).map((item) => item.kind)).toEqual([
			'StillGotForTonight',
			'ProbablyGoneOff',
			'GoesOffToday',
			'ShopDayOffer'
		]);
	});
});
