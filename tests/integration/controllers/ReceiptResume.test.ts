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

describe('reading a receipt again after a crash', () => {
	let shop: Shop;
	let receiptId: string;

	/** The receipt is read, then a crash before its DONE leaves it PROCESSING, and it is read again. */
	async function readTwice() {
		await shop.receiptController.resumePendingReceipts();
		await settle();
		await shop.receipts.update(receiptId, { status: 'PROCESSING' });
		await shop.receiptController.resumePendingReceipts();
		await settle();
	}

	function events(kind: 'BOUGHT' | 'SHOP_DONE') {
		return shop.events
			.all(shopper.householdId)
			.filter((event) => event.kind === kind && event.actorUserId === shopper.userId);
	}

	beforeEach(async () => {
		shop = createShop();
		shop.extractor.setDefaultData({
			items: [
				{ name: 'spinach', quantity: '300g', price: '2.00' },
				{ name: 'milk', quantity: '1l', price: '1.00' }
			],
			storeName: 'Corner Shop',
			total: '3.00'
		});
		receiptId = (await leftBehind(shop, 'PROCESSING')).id;
	});

	it('keeps one set of lines', async () => {
		await readTwice();
		expect((await shop.receiptItems.findByReceiptId(receiptId)).length).toBe(2);
	});

	it('records one BOUGHT per line', async () => {
		await readTwice();
		expect(events('BOUGHT').length).toBe(2);
	});

	it('closes the shop once', async () => {
		await readTwice();
		expect(events('SHOP_DONE').length).toBe(1);
	});

	it('counts each line in the purchase history once', async () => {
		await readTwice();
		const spinach = shop.history.getAll().find((entry) => entry.itemName === 'spinach');
		expect(spinach?.purchaseCount).toBe(1);
	});

	it('replaces lines a crash left half saved, with their BOUGHT events', async () => {
		const [half] = await shop.receiptItems.createMany([
			{
				receiptId,
				rawName: 'spinach',
				normalizedName: 'spinach',
				quantity: '300',
				unit: 'g',
				unitType: 'WEIGHT'
			}
		]);
		await shop.kitchen.recordBought(
			shopper,
			[{ name: 'spinach', quantity: 300, unit: 'g', receiptItemId: half.id }],
			new Date(),
			'receipt'
		);
		await shop.receiptController.resumePendingReceipts();
		await settle();
		expect(events('BOUGHT').length).toBe(2);
	});
});
