import type { IHabitService, IHouseholdService, IKitchenService, IPlanService } from '$services';
import type { Actor } from '$lib/models/household';
import type { DoorChoice } from '$lib/models/tonight';
import { chooseDoor } from '$lib/services/frontdoor';
import { dayNumber } from '$lib/services/kitchen';

/** The front door reads this many days of the plan, enough for a week-long stretch. */
const PLAN_AHEAD_DAYS = 8;

/** Picks the door a signed-in member lands on when they open the app. */
export class FrontDoorController {
	constructor(
		private planService: IPlanService,
		private kitchenService: IKitchenService,
		private habitService: IHabitService,
		private householdService: IHouseholdService
	) {}

	async decide(actor: Actor, now: Date, timeZone: string): Promise<DoorChoice> {
		const today = dayNumber(now, timeZone);
		const [meals, picture, habits, members] = await Promise.all([
			this.planService.listMeals(actor.householdId, today, today + PLAN_AHEAD_DAYS, timeZone),
			this.kitchenService.getPicture(actor.householdId, now, timeZone),
			this.habitService.getHabits(actor.householdId, now, timeZone),
			this.householdService.listMembers(actor)
		]);
		return chooseDoor({
			now,
			timeZone,
			habits,
			roles: actor.roles,
			memberCount: members.length,
			tracksKitchen: picture.tracks,
			lastShopDoneAt: picture.lastShopDoneAt,
			meals
		});
	}
}
