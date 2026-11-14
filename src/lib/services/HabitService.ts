import type {
	IHabitAnswerRepository,
	IHouseholdRepository,
	IKitchenEventRepository,
	IPlannedMealRepository,
	IPurchaseHistoryRepository
} from '$repositories';
import type { Actor } from '$lib/models/household';
import type { HabitAnswer, HabitAnswerValue, Habits, ShopMethod } from '$lib/models/kitchen';
import type { IHabitService } from './interfaces/IHabitService';
import { applyHabitAnswers, HABIT_WINDOW_DAYS, learnHabits, type HabitInput } from './habits';
import { normalizeItemKey } from './kitchen';
import { householdTimeZone } from './householdTimeZone';

const DAY_MS = 24 * 60 * 60 * 1000;

export class HabitService implements IHabitService {
	constructor(
		private kitchenEventRepository: IKitchenEventRepository,
		private habitAnswerRepository: IHabitAnswerRepository,
		private plannedMealRepository: IPlannedMealRepository,
		private purchaseHistoryRepository: IPurchaseHistoryRepository,
		private householdRepository: IHouseholdRepository
	) {}

	async getHabits(householdId: string, now: Date, timeZone?: string): Promise<Habits> {
		const zone = timeZone ?? (await householdTimeZone(this.householdRepository, householdId));
		const since = new Date(now.getTime() - HABIT_WINDOW_DAYS * DAY_MS);
		const until = new Date(now.getTime() + HABIT_WINDOW_DAYS * DAY_MS);
		const [events, plannedMeals, history, members, answers] = await Promise.all([
			this.kitchenEventRepository.listByHouseholdSince(householdId, since),
			this.plannedMealRepository.findByHouseholdIdAndRange(householdId, since, until),
			this.purchaseHistoryRepository.findByHouseholdId(householdId),
			this.householdRepository.listMembers(householdId),
			this.habitAnswerRepository.listByHousehold(householdId)
		]);
		const memberIdByUser = new Map(members.map((member) => [member.userId, member.id]));

		const input: HabitInput = {
			now,
			timeZone: zone,
			shops: events
				.filter((event) => event.kind === 'SHOP_DONE' && event.method !== null)
				.map((event) => ({
					occurredAt: event.occurredAt,
					memberId: event.actorUserId ? (memberIdByUser.get(event.actorUserId) ?? null) : null,
					method: event.method as ShopMethod
				})),
			plannedMeals: plannedMeals.map((meal) => ({
				createdAt: meal.createdAt,
				plannedDate: meal.plannedDate
			})),
			cooked: events
				.filter((event) => event.kind === 'COOKED')
				.map((event) => ({ occurredAt: event.occurredAt, portions: event.portions })),
			bought: events
				.filter((event) => event.kind === 'BOUGHT' && event.itemKey !== null)
				.map((event) => ({ itemKey: event.itemKey as string, occurredAt: event.occurredAt })),
			purchaseCounts: history.map((record) => ({
				itemKey: normalizeItemKey(record.itemName),
				purchaseCount: record.purchaseCount
			}))
		};
		return applyHabitAnswers(learnHabits(input), answers, input);
	}

	async answerOffer(
		actor: Actor,
		key: string,
		answer: HabitAnswerValue,
		at: Date
	): Promise<HabitAnswer> {
		return this.habitAnswerRepository.save({
			householdId: actor.householdId,
			key,
			answer,
			answeredBy: actor.userId,
			answeredAt: at
		});
	}
}
