import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { AppFactory } from '$lib/factories';
import type { PlanIdea, PlanResult, PlanStretch, PlanView } from '$lib/models/plan';
import { MAX_STRETCH_DAYS } from '$lib/models/plan';
import type { DiscoverResult } from '$lib/controllers';
import { requireActor } from '../actor';

const day = z.number().int().min(0);
const range = z
	.object({ start: day, end: day })
	.refine((r) => r.end > r.start && r.end - r.start <= MAX_STRETCH_DAYS, 'Invalid range');
const optionalRange = range.optional();
const anySlot = z.enum(['LUNCH', 'DINNER', 'PREP']);
const mealId = z.object({ plannedMealId: z.uuid() });

const setSlotInput = z.object({
	day,
	mealType: anySlot,
	recipeId: z.uuid(),
	replaceId: z.uuid().optional()
});
const ideasInput = z.object({
	day,
	mealType: anySlot,
	exclude: z.array(z.uuid()).max(20).optional()
});
const batchPrepInput = z.object({
	day,
	recipeIds: z.array(z.uuid()).max(4).optional(),
	lunchesPerRecipe: z.number().int().min(1).max(5).optional()
});
const discoverInput = z.object({ recipeId: z.uuid(), range: optionalRange });
const prepDoneInput = z.object({ day });

function timeZone(): string {
	return getRequestEvent().locals.timeZone;
}

/** A failure inside an operation, as the HTTP error the page can show. */
function notFound(cause: unknown): never {
	if (cause instanceof Error && /not found/i.test(cause.message)) error(404, cause.message);
	throw cause;
}

/** The plan over the default stretch, or over the range the member picked. */
export const getPlan = query(optionalRange, async (input): Promise<PlanView> => {
	return AppFactory.getPlanController().getPlan(requireActor(), new Date(), timeZone(), input);
});

/** Ranked ideas for one slot. */
export const getIdeas = query(ideasInput, async (input): Promise<PlanIdea[]> => {
	return AppFactory.getPlanController().ideas(requireActor(), new Date(), timeZone(), input);
});

/** The range the member tapped, kept inside the strip. */
export const pickRange = command(range, async (input): Promise<PlanStretch & { line: string }> => {
	requireActor();
	return AppFactory.getPlanController().pickRange(new Date(), timeZone(), input);
});

/** "Suggest the rest": fills the open meals of the stretch. */
export const suggestRest = command(optionalRange, async (input): Promise<PlanResult> => {
	return AppFactory.getPlanController().suggestRest(requireActor(), new Date(), timeZone(), input);
});

/** "Plan the whole week": fills seven days from the stretch's start. */
export const planWholeWeek = command(optionalRange, async (input): Promise<PlanResult> => {
	return AppFactory.getPlanController().planWholeWeek(
		requireActor(),
		new Date(),
		timeZone(),
		input
	);
});

/** Puts a recipe in a slot, or swaps the meal there. */
export const setSlot = command(setSlotInput, async (input): Promise<PlanResult> => {
	return AppFactory.getPlanController().setSlot(requireActor(), timeZone(), input).catch(notFound);
});

/** Takes a meal off the plan, with its leftovers. */
export const removeSlot = command(mealId, async ({ plannedMealId }): Promise<PlanResult> => {
	return AppFactory.getPlanController().removeSlot(requireActor(), plannedMealId).catch(notFound);
});

/** "Cook for two days" and "Just for tonight". */
export const cookForTwoDays = command(mealId, async ({ plannedMealId }): Promise<PlanResult> => {
	return AppFactory.getPlanController()
		.cookForTwoDays(requireActor(), timeZone(), plannedMealId)
		.catch(notFound);
});

/** Plans a prep session and the lunches it makes. */
export const planBatchPrep = command(batchPrepInput, async (input): Promise<PlanResult> => {
	return AppFactory.getPlanController()
		.planBatchPrep(requireActor(), new Date(), timeZone(), input)
		.catch(notFound);
});

/** Puts a new recipe on the first free dinner of the stretch. */
export const discoverRecipe = command(discoverInput, async (input): Promise<DiscoverResult> => {
	return AppFactory.getPlanController()
		.discover(requireActor(), new Date(), timeZone(), input.recipeId, input.range)
		.catch(notFound);
});

/** "Done, boxes in the fridge": records the prep as cooked. */
export const markPrepDone = command(prepDoneInput, async (input): Promise<PlanResult> => {
	return AppFactory.getPlanController().markPrepDone(
		requireActor(),
		new Date(),
		timeZone(),
		input.day
	);
});
