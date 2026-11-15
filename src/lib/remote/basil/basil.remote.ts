import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { AppFactory } from '$lib/factories';
import {
	BasilBusyError,
	BasilRunForbiddenError,
	BasilRunNotFoundError,
	actionInput,
	runInput,
	sendMessageInput,
	type BasilConversationView,
	type BasilDecisionReceipt,
	type BasilRunReceipt
} from '$lib/models/agent';
import { requireActor } from '../actor';

function timeZone(): string {
	return getRequestEvent().locals.timeZone;
}

/** Turns Basil's errors into the status the sheet reads; anything else is rethrown. */
function asHttp(cause: unknown): never {
	if (cause instanceof BasilBusyError) error(409, cause.message);
	if (cause instanceof BasilRunForbiddenError) error(403, cause.message);
	if (cause instanceof BasilRunNotFoundError) error(404, cause.message);
	if (cause instanceof Error && /not found/i.test(cause.message)) error(404, cause.message);
	throw cause;
}

/** The member's conversation with Basil, with the run still answering, if any. */
export const getConversation = query(async (): Promise<BasilConversationView> => {
	return AppFactory.getBasilController().getConversation(requireActor());
});

/** Sends a message. Basil answers in the background; the sheet follows the run's events. */
export const sendMessage = command(sendMessageInput, async (input): Promise<BasilRunReceipt> => {
	const receipt = await AppFactory.getBasilController()
		.submit(requireActor(), input, new Date(), timeZone())
		.catch(asHttp);
	getConversation().refresh();
	return receipt;
});

/** "Yes" on a proposed change: it runs, and a run lets Basil say what changed. */
export const approve = command(actionInput, async (input): Promise<BasilDecisionReceipt> => {
	const receipt = await AppFactory.getBasilController()
		.decide(requireActor(), input, true, new Date(), timeZone())
		.catch(asHttp);
	getConversation().refresh();
	return receipt;
});

/** "Not now" on a proposed change: nothing runs. */
export const decline = command(actionInput, async (input): Promise<BasilDecisionReceipt> => {
	const receipt = await AppFactory.getBasilController()
		.decide(requireActor(), input, false, new Date(), timeZone())
		.catch(asHttp);
	getConversation().refresh();
	return receipt;
});

/** Stop: Basil keeps what it had said so far. */
export const cancel = command(runInput, async (input): Promise<void> => {
	await AppFactory.getBasilController()
		.cancel(requireActor(), input.runId, new Date())
		.catch(asHttp);
});

/** A new, empty conversation. */
export const startOver = command(async (): Promise<void> => {
	await AppFactory.getBasilController().startOver(requireActor(), new Date()).catch(asHttp);
	getConversation().refresh();
});
