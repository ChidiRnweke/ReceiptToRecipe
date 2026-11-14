import { command, form, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { AppFactory } from '$lib/factories';
import type { ConfirmResult, GotEverythingResult, ReceiptResult, ShopView } from '$lib/models/shop';
import { requireActor } from '../actor';

/** Receipt photos up to 10 MB, the same limit as the receipts page. */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const toggleInput = z.object({ itemId: z.uuid(), checked: z.boolean() });
const addInput = z.object({
	name: z.string().trim().min(1).max(120),
	quantity: z.number().positive().max(100_000).nullish(),
	unit: z.string().trim().max(20).nullish()
});
const itemInput = z.object({ itemId: z.uuid() });
const gotInput = z.object({ ideas: z.array(z.uuid()).max(10).default([]) });
const receiptInput = z.object({ receiptId: z.uuid() });
const photoInput = z.object({
	receipt: z
		.instanceof(File, { message: 'Choose a photo of the receipt.' })
		.refine((file) => file.size > 0, 'Choose a photo of the receipt.')
		.refine((file) => file.type.startsWith('image/'), 'That is not a photo.')
		.refine((file) => file.size <= MAX_PHOTO_BYTES, 'The photo must be smaller than 10 MB.')
});

function timeZone(): string {
	return getRequestEvent().locals.timeZone;
}

/** A failure inside an operation, as the HTTP error the page can show. */
function notFound(cause: unknown): never {
	if (cause instanceof Error && /not found/i.test(cause.message)) error(404, cause.message);
	throw cause;
}

/** The household's list, synced from the plan. */
export const getShop = query(async (): Promise<ShopView> => {
	return AppFactory.getShopController().getShop(requireActor(), new Date(), timeZone());
});

/** Ticks or unticks one item. The page shows the tick at once, so nothing is refreshed. */
export const toggleItem = command(toggleInput, async ({ itemId, checked }): Promise<void> => {
	await AppFactory.getShopController().toggleItem(requireActor(), itemId, checked).catch(notFound);
});

/** Adds an item by hand. */
export const addItem = command(addInput, async (input): Promise<void> => {
	await AppFactory.getShopController().addItem(requireActor(), input);
	getShop().refresh();
});

/** Removes an item that was added by hand. */
export const removeItem = command(itemInput, async ({ itemId }): Promise<void> => {
	await AppFactory.getShopController().removeItem(requireActor(), itemId).catch(notFound);
	getShop().refresh();
});

/** "Got everything": the ticked items, or the whole list, came home. */
export const gotEverything = command(gotInput, async ({ ideas }): Promise<GotEverythingResult> => {
	const result = await AppFactory.getShopController()
		.gotEverything(requireActor(), new Date(), timeZone(), ideas)
		.catch(notFound);
	getShop().refresh();
	return result;
});

/** "Snap the receipt": uploads the photo and starts reading it. */
export const snapReceipt = form(photoInput, async ({ receipt }): Promise<{ receiptId: string }> => {
	return AppFactory.getShopController().snapReceipt(requireActor(), receipt);
});

/** The receipt being read, and once read, what came home. The page refreshes it to poll. */
export const getReceiptResult = query(z.uuid(), async (receiptId): Promise<ReceiptResult> => {
	return AppFactory.getShopController()
		.getReceiptResult(requireActor(), receiptId, timeZone())
		.catch(notFound);
});

/** "Looks right": settles the list against the receipt. */
export const confirmWhatCameHome = command(
	receiptInput,
	async ({ receiptId }): Promise<ConfirmResult> => {
		const result = await AppFactory.getShopController()
			.confirmWhatCameHome(requireActor(), receiptId)
			.catch(notFound);
		getShop().refresh();
		return result;
	}
);
