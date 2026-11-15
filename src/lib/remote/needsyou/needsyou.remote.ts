import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { AppFactory } from '$lib/factories';
import { answerInput, type AnswerResult, type NeedsYouView } from '$lib/models/needsyou';
import { requireActor } from '../actor';
import { getUseItUp } from '../useitup/useitup.remote';
import { getTonight } from '../tonight/tonight.remote';
import { getShop } from '../shop/shop.remote';

function timeZone(): string {
	return getRequestEvent().locals.timeZone;
}

/** Every question the app has for the member, with how many there are. */
export const getNeedsYou = query(async (): Promise<NeedsYouView> => {
	return AppFactory.getNeedsYouController().list(requireActor(), new Date(), timeZone());
});

/** Answers one question; the item leaves the list. */
export const answer = command(answerInput, async (input): Promise<AnswerResult> => {
	const result = await AppFactory.getNeedsYouController()
		.answer(requireActor(), input, new Date(), timeZone())
		.catch((cause: unknown) => {
			if (cause instanceof Error && /not found/i.test(cause.message)) error(404, cause.message);
			throw cause;
		});
	getNeedsYou().refresh();
	getUseItUp().refresh();
	getTonight().refresh();
	getShop().refresh();
	return result;
});
