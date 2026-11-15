import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { AppFactory } from '$lib/factories';
import {
	addItemInput,
	itemInput,
	setQuantityInput,
	undoInput,
	type ChangeResult,
	type UseItUpIdea,
	type UseItUpView
} from '$lib/models/useitup';
import { requireActor } from '../actor';
import { getNeedsYou } from '../needsyou/needsyou.remote';

function timeZone(): string {
	return getRequestEvent().locals.timeZone;
}

/** A failure inside an operation, as the HTTP error the page can show. */
function notFound(cause: unknown): never {
	if (cause instanceof Error && /not found/i.test(cause.message)) error(404, cause.message);
	throw cause;
}

/** What needs eating first, and everything else at home. */
export const getUseItUp = query(async (): Promise<UseItUpView> => {
	return AppFactory.getUseItUpController().get(requireActor(), new Date(), timeZone());
});

/** Household recipes that use one item, for the "Ideas" sheet. */
export const getIdeas = query(itemInput, async ({ itemKey }): Promise<UseItUpIdea[]> => {
	return AppFactory.getUseItUpController().ideas(requireActor(), itemKey, new Date(), timeZone());
});

/** A kitchen change touches the door and the questions in "Needs you". */
function refresh() {
	getUseItUp().refresh();
	getNeedsYou().refresh();
}

/** ✕ "It's gone" / "Binned it". */
export const markGone = command(itemInput, async ({ itemKey }): Promise<ChangeResult> => {
	const result = await AppFactory.getUseItUpController().markGone(
		requireActor(),
		itemKey,
		new Date(),
		timeZone()
	);
	refresh();
	return result;
});

/** ↺ "Still good". */
export const stillGood = command(itemInput, async ({ itemKey }): Promise<ChangeResult> => {
	const result = await AppFactory.getUseItUpController().stillGood(
		requireActor(),
		itemKey,
		new Date(),
		timeZone()
	);
	refresh();
	return result;
});

/** Undo for a correction or an item added by hand. */
export const undoCorrection = command(undoInput, async ({ undoId }): Promise<void> => {
	await AppFactory.getUseItUpController().undoCorrection(requireActor(), undoId).catch(notFound);
	refresh();
});

/** "Add something". */
export const addItem = command(addItemInput, async (input): Promise<ChangeResult> => {
	const result = await AppFactory.getUseItUpController().addItem(requireActor(), input, new Date());
	refresh();
	return result;
});

/** "How much is left". */
export const setQuantity = command(setQuantityInput, async (input): Promise<ChangeResult> => {
	const result = await AppFactory.getUseItUpController().setQuantity(
		requireActor(),
		input,
		new Date(),
		timeZone()
	);
	refresh();
	return result;
});
