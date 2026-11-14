import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTables, teardownTestDb, createHouseholdFor } from '../helpers/testDb';
import { UserRepository } from '../../src/lib/repositories/UserRepositories';
import {
	ReceiptItemRepository,
	ReceiptRepository
} from '../../src/lib/repositories/ReceiptRepositories';

describe('ReceiptRepository (DB)', () => {
	let receipts: ReceiptRepository;
	let items: ReceiptItemRepository;
	let receiptId: string;

	const line = (name: string) => ({
		receiptId,
		rawName: name,
		normalizedName: name,
		quantity: '1',
		unit: 'count',
		unitType: 'COUNT' as const
	});

	beforeEach(async () => {
		const db = await setupTestDb();
		await cleanTables();
		receipts = new ReceiptRepository(db);
		items = new ReceiptItemRepository(db);
		const userId = (
			await new UserRepository(db).create({
				email: 'r@example.com',
				name: 'Receipt Test',
				authProviderId: 'oauth-r1'
			})
		).id;
		const householdId = await createHouseholdFor(userId);
		receiptId = (await receipts.create({ userId, householdId, imageUrl: 'mock://receipts/r.jpg' }))
			.id;
	});

	afterAll(async () => {
		await teardownTestDb();
	});

	describe('listSnapshot', () => {
		it('reads back the list kept with the receipt', async () => {
			const receipt = await receipts.findById(receiptId);
			const snapped = await receipts.create({
				userId: receipt!.userId,
				householdId: receipt!.householdId,
				imageUrl: 'mock://receipts/s.jpg',
				listSnapshot: [{ id: 'item-1', name: 'Spinach', itemKey: 'spinach' }]
			});
			expect((await receipts.findById(snapped.id))?.listSnapshot).toEqual([
				{ id: 'item-1', name: 'Spinach', itemKey: 'spinach' }
			]);
		});
	});

	describe('replaceForReceipt', () => {
		it('leaves only the new lines on the receipt', async () => {
			await items.createMany([line('spinach'), line('milk')]);
			await items.replaceForReceipt(receiptId, [line('spinach')]);
			const names = (await items.findByReceiptId(receiptId)).map((item) => item.normalizedName);
			expect(names).toEqual(['spinach']);
		});
	});

	describe('claimShopRecording', () => {
		it('grants the first claim', async () => {
			expect(await receipts.claimShopRecording(receiptId, new Date())).toBe(true);
		});

		it('refuses a second claim', async () => {
			await receipts.claimShopRecording(receiptId, new Date());
			expect(await receipts.claimShopRecording(receiptId, new Date())).toBe(false);
		});
	});
});
