import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { AppFactory } from '$lib/factories';
import type {
	CookResult,
	EatOutResult,
	PickResult,
	TonightIdea,
	TonightView
} from '$lib/models/tonight';
import { requireActor } from '../actor';

const cookInput = z.union([
	z.object({ plannedMealId: z.uuid() }),
	z.object({ recipeId: z.uuid() })
]);
const pickInput = z.object({ recipeId: z.uuid() });

function timeZone(): string {
	return getRequestEvent().locals.timeZone;
}

/** A failure inside an operation, as the HTTP error the page can show. */
function notFound(cause: unknown): never {
	if (cause instanceof Error && /not found/i.test(cause.message)) error(404, cause.message);
	throw cause;
}

/** The meal Tonight answers for, or ideas when nothing is planned. */
export const getTonight = query(async (): Promise<TonightView> => {
	return AppFactory.getTonightController().getTonight(requireActor(), new Date(), timeZone());
});

/** Five other things to cook instead. */
export const getAlternatives = query(async (): Promise<TonightIdea[]> => {
	return AppFactory.getTonightController().alternatives(requireActor(), new Date(), timeZone());
});

/** "Done, we ate": records the meal as cooked. */
export const cookTonight = command(cookInput, async (input): Promise<CookResult> => {
	const result = await AppFactory.getTonightController()
		.cook(requireActor(), input, new Date(), timeZone())
		.catch(notFound);
	getTonight().refresh();
	getAlternatives().refresh();
	return result;
});

/** "We're eating out": moves tonight's dinner to the next free day. */
export const eatOut = command(async (): Promise<EatOutResult> => {
	const result = await AppFactory.getTonightController().eatOut(
		requireActor(),
		new Date(),
		timeZone()
	);
	getTonight().refresh();
	getAlternatives().refresh();
	return result;
});

/** Plans another recipe for tonight; the planned one moves along. */
export const pickAlternative = command(pickInput, async ({ recipeId }): Promise<PickResult> => {
	const result = await AppFactory.getTonightController()
		.pickAlternative(requireActor(), recipeId, new Date(), timeZone())
		.catch(notFound);
	getTonight().refresh();
	getAlternatives().refresh();
	return result;
});
