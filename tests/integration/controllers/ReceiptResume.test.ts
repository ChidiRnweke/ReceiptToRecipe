import { describe, it, expect, beforeEach } from 'vitest';
import { createShop, shopper } from '../../fakes/shop';

type Shop = ReturnType<typeof createShop>;

/** A receipt a restart left behind: its row and photo exist, but no job reads it. */
async function leftBehind(shop: Shop, status: 'QUEUED' | 'PROCESSING', photo = true) {
	const key = `receipts/${status.toLowerCase()}.jpg`;
	if (photo)
		await shop.storage.upload(
			Buffer.from('photo'),
			`${status.toLowerCase()}.jpg`,
			'image/jpeg',
			'receipts'
		);
	return shop.receipts.create({
		userId: shopper.userId,
		householdId: shopper.householdId,
		imageUrl: `mock://${key}`,
		status
	});
}

async function settle() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('resumePendingReceipts', () => {
	let shop: Shop;

	beforeEach(() => {
		shop = createShop();
	});

	it('reads a receipt that was still queued', async () => {
		const receipt = await leftBehind(shop, 'QUEUED');
		await shop.receiptController.resumePendingReceipts();
		await settle();
		expect((await shop.receipts.findById(receipt.id))?.status).toBe('DONE');
	});

	it('reads a receipt that was being read', async () => {
		const receipt = await leftBehind(shop, 'PROCESSING');
		await shop.receiptController.resumePendingReceipts();
		await settle();
		expect((await shop.receipts.findById(receipt.id))?.status).toBe('DONE');
	});

	it('leaves a receipt that is already read alone', async () => {
		const done = await shop.receipts.create({
			userId: shopper.userId,
			householdId: shopper.householdId,
			imageUrl: 'mock://receipts/done.jpg',
			status: 'DONE'
		});
		expect(await shop.receiptController.resumePendingReceipts()).not.toContain(done.id);
	});

	it('marks a receipt whose photo is gone as failed', async () => {
		const receipt = await leftBehind(shop, 'QUEUED', false);
		await shop.receiptController.resumePendingReceipts();
		expect((await shop.receipts.findById(receipt.id))?.status).toBe('FAILED');
	});
});
