import type {
	CorrectionKind,
	IHabitService,
	IKitchenService,
	KitchenPicture,
	BoughtItem
} from '$services';
import type { Actor } from '$lib/models/household';
import type {
	HabitAnswer,
	HabitAnswerValue,
	Habits,
	KitchenEvent,
	ShopMethod
} from '$lib/models/kitchen';

export interface CookedInput {
	plannedMealId?: string | null;
	recipeId: string;
	servings: number;
	extraPortions?: number;
	at?: Date;
}

export interface CorrectInput {
	itemKey: string;
	kind: CorrectionKind;
	quantity?: number | null;
	unit?: string | null;
	at?: Date;
}

export interface ShopDoneInput {
	method: ShopMethod;
	items: BoughtItem[];
	at?: Date;
}

/** The kitchen picture and habits, for the signed-in member's household. */
export class KitchenController {
	constructor(
		private kitchenService: IKitchenService,
		private habitService: IHabitService,
		private now: () => Date = () => new Date()
	) {}

	/** Local days use `timeZone` when given, else the household's time zone. */
	async getPicture(actor: Actor, timeZone: string = actor.timeZone): Promise<KitchenPicture> {
		return this.kitchenService.getPicture(actor.householdId, this.now(), timeZone);
	}

	async recordCooked(actor: Actor, input: CookedInput): Promise<KitchenEvent> {
		return this.kitchenService.recordCooked({ ...input, actor, at: input.at ?? this.now() });
	}

	async correct(actor: Actor, input: CorrectInput): Promise<KitchenEvent> {
		return this.kitchenService.correct({ ...input, actor, at: input.at ?? this.now() });
	}

	async recordShopDone(actor: Actor, input: ShopDoneInput): Promise<KitchenEvent[]> {
		return this.kitchenService.recordShopDone({
			author: actor,
			method: input.method,
			items: input.items,
			at: input.at ?? this.now()
		});
	}

	async getHabits(actor: Actor, timeZone: string = actor.timeZone): Promise<Habits> {
		return this.habitService.getHabits(actor.householdId, this.now(), timeZone);
	}

	async answerOffer(actor: Actor, key: string, answer: HabitAnswerValue): Promise<HabitAnswer> {
		return this.habitService.answerOffer(actor, key, answer, this.now());
	}
}
