import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { AppFactory } from '$lib/factories';
import {
	actionInput,
	sendMessageInput,
	type BasilConversationView,
	type BasilTurnResult
} from '$lib/models/agent';
import { requireActor } from '../actor';

function timeZone(): string {
	return getRequestEvent().locals.timeZone;
}

/** Another member's action, or one that no longer exists, is a 404. */
function notFound(cause: unknown): never {
	if (cause instanceof Error && /not found/i.test(cause.message)) error(404, cause.message);
	throw cause;
}

/** The member's conversation with Basil. */
export const getConversation = query(async (): Promise<BasilConversationView> => {
	return AppFactory.getBasilController().getConversation(requireActor());
});

/**
 * Sends a message and waits for Basil's answer. The result names the doors whose data changed,
 * so the page refreshes their queries, and the steps the browser carries out.
 */
export const sendMessage = command(sendMessageInput, async (input): Promise<BasilTurnResult> => {
	const result = await AppFactory.getBasilController().sendMessage(
		requireActor(),
		input,
		new Date(),
		timeZone()
	);
	getConversation().refresh();
	return result;
});

/** "Yes" on a proposed change: it runs, and Basil says what changed. */
export const approve = command(actionInput, async (input): Promise<BasilTurnResult> => {
	const result = await AppFactory.getBasilController()
		.approve(requireActor(), input, new Date(), timeZone())
		.catch(notFound);
	getConversation().refresh();
	return result;
});

/** "Not now" on a proposed change: nothing runs. */
export const decline = command(actionInput, async (input): Promise<BasilTurnResult> => {
	const result = await AppFactory.getBasilController()
		.decline(requireActor(), input, new Date(), timeZone())
		.catch(notFound);
	getConversation().refresh();
	return result;
});
