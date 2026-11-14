import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTables, teardownTestDb, createHouseholdFor } from '../helpers/testDb';
import { UserRepository } from '../../src/lib/repositories/UserRepositories';
import { CupboardItemRepository } from '../../src/lib/repositories/CupboardItemRepository';

describe('CupboardItemRepository (DB)', () => {
	let userRepo: UserRepository;
	let cupboardRepo: CupboardItemRepository;
	let userId: string;
	let otherUserId: string;
	let householdId: string;
	let otherHouseholdId: string;

	beforeEach(async () => {
		const db = await setupTestDb();
		await cleanTables();
		userRepo = new UserRepository(db);
		cupboardRepo = new CupboardItemRepository(db);

		const user = await userRepo.create({
			email: 'cupboard-test@example.com',
			name: 'Cupboard Test User',
			authProviderId: 'oauth-cupboard-1'
		});
		userId = user.id;

		const otherUser = await userRepo.create({
			email: 'other-cupboard@example.com',
			name: 'Other User',
			authProviderId: 'oauth-cupboard-2'
		});
		otherUserId = otherUser.id;

		householdId = await createHouseholdFor(userId);
		otherHouseholdId = await createHouseholdFor(otherUserId, 'Other kitchen');
	});

	afterAll(async () => {
		await teardownTestDb();
	});

	describe('create', () => {
		it('should create a cupboard item with minimal fields', async () => {
			const item = await cupboardRepo.create({
				userId,
				householdId,
				itemName: 'salt'
			});

			expect(item.id).toBeDefined();
			expect(item.userId).toBe(userId);
			expect(item.itemName).toBe('salt');
			expect(item.quantity).toBeNull();
			expect(item.unit).toBeNull();
			expect(item.category).toBeNull();
			expect(item.shelfLifeDays).toBeNull();
			expect(item.isDepleted).toBe(false);
			expect(item.notes).toBeNull();
			expect(item.addedDate).toBeInstanceOf(Date);
			expect(item.createdAt).toBeInstanceOf(Date);
			expect(item.updatedAt).toBeInstanceOf(Date);
		});

		it('stores the household the item belongs to', async () => {
			const item = await cupboardRepo.create({ userId, householdId, itemName: 'salt' });
			expect(item.householdId).toBe(householdId);
		});

		it('should create a cupboard item with all fields', async () => {
			const addedDate = new Date('2025-06-01');
			const item = await cupboardRepo.create({
				userId,
				householdId,
				itemName: 'organic flour',
				quantity: '2',
				unit: 'kg',
				category: 'pantry',
				addedDate,
				shelfLifeDays: 180,
				notes: 'from farmers market'
			});

			expect(item.itemName).toBe('organic flour');
			expect(item.quantity).toBe('2.000');
			expect(item.unit).toBe('kg');
			expect(item.category).toBe('pantry');
			expect(item.shelfLifeDays).toBe(180);
			expect(item.notes).toBe('from farmers market');
			expect(Math.abs(item.addedDate.getTime() - addedDate.getTime())).toBeLessThan(1000);
		});
	});

	describe('findById', () => {
		it('should find an existing item', async () => {
			const created = await cupboardRepo.create({
				userId,
				householdId,
				itemName: 'pepper'
			});

			const found = await cupboardRepo.findById(created.id);
			expect(found).not.toBeNull();
			expect(found!.id).toBe(created.id);
			expect(found!.itemName).toBe('pepper');
		});

		it('should return null for non-existent id', async () => {
			const found = await cupboardRepo.findById('00000000-0000-0000-0000-000000000000');
			expect(found).toBeNull();
		});
	});

	describe('findByHouseholdId', () => {
		it('should return only non-depleted items for the household', async () => {
			await cupboardRepo.create({ userId, householdId, itemName: 'salt' });
			await cupboardRepo.create({ userId, householdId, itemName: 'pepper' });
			const depleted = await cupboardRepo.create({ userId, householdId, itemName: 'sugar' });
			await cupboardRepo.markDepleted(depleted.id);

			// Other household's item
			await cupboardRepo.create({
				userId: otherUserId,
				householdId: otherHouseholdId,
				itemName: 'flour'
			});

			const items = await cupboardRepo.findByHouseholdId(householdId);

			expect(items.length).toBe(2);
			const names = items.map((i) => i.itemName);
			expect(names).toContain('salt');
			expect(names).toContain('pepper');
			expect(names).not.toContain('sugar');
			expect(names).not.toContain('flour');
		});

		it('should return items ordered by addedDate descending', async () => {
			await cupboardRepo.create({
				userId,
				householdId,
				itemName: 'old item',
				addedDate: new Date('2025-01-01')
			});
			await cupboardRepo.create({
				userId,
				householdId,
				itemName: 'new item',
				addedDate: new Date('2025-06-01')
			});

			const items = await cupboardRepo.findByHouseholdId(householdId);

			expect(items.length).toBe(2);
			expect(items[0].itemName).toBe('new item');
			expect(items[1].itemName).toBe('old item');
		});

		it('excludes items that belong to another household', async () => {
			await cupboardRepo.create({
				userId: otherUserId,
				householdId: otherHouseholdId,
				itemName: 'flour'
			});

			const items = await cupboardRepo.findByHouseholdId(householdId);
			expect(items).toEqual([]);
		});

		it('includes items any member of the household added', async () => {
			await cupboardRepo.create({ userId: otherUserId, householdId, itemName: 'flour' });

			const items = await cupboardRepo.findByHouseholdId(householdId);
			expect(items.map((item) => item.itemName)).toEqual(['flour']);
		});

		it('should return empty array for household with no items', async () => {
			const items = await cupboardRepo.findByHouseholdId(householdId);
			expect(items).toEqual([]);
		});
	});

	describe('findByHouseholdAndItem', () => {
		it('should find an active item by household and name', async () => {
			await cupboardRepo.create({ userId, householdId, itemName: 'olive oil' });

			const found = await cupboardRepo.findByHouseholdAndItem(householdId, 'olive oil');
			expect(found).not.toBeNull();
			expect(found!.itemName).toBe('olive oil');
		});

		it('should not find depleted items', async () => {
			const item = await cupboardRepo.create({ userId, householdId, itemName: 'butter' });
			await cupboardRepo.markDepleted(item.id);

			const found = await cupboardRepo.findByHouseholdAndItem(householdId, 'butter');
			expect(found).toBeNull();
		});

		it('should not find items from other households', async () => {
			await cupboardRepo.create({
				userId: otherUserId,
				householdId: otherHouseholdId,
				itemName: 'eggs'
			});

			const found = await cupboardRepo.findByHouseholdAndItem(householdId, 'eggs');
			expect(found).toBeNull();
		});

		it('should return null for non-existent item', async () => {
			const found = await cupboardRepo.findByHouseholdAndItem(householdId, 'nonexistent');
			expect(found).toBeNull();
		});
	});

	describe('update', () => {
		it('should update specified fields', async () => {
			const created = await cupboardRepo.create({
				userId,
				householdId,
				itemName: 'flour',
				quantity: '1',
				category: 'pantry'
			});

			const updated = await cupboardRepo.update(created.id, {
				quantity: '5',
				category: 'bakery',
				shelfLifeDays: 60,
				notes: 'whole wheat'
			});

			expect(updated.quantity).toBe('5.000');
			expect(updated.category).toBe('bakery');
			expect(updated.shelfLifeDays).toBe(60);
			expect(updated.notes).toBe('whole wheat');
			// Item name should remain unchanged
			expect(updated.itemName).toBe('flour');
			// updatedAt should be newer
			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
		});

		it('should allow updating the item name', async () => {
			const created = await cupboardRepo.create({
				userId,
				householdId,
				itemName: 'typo item'
			});

			const updated = await cupboardRepo.update(created.id, {
				itemName: 'corrected item'
			});

			expect(updated.itemName).toBe('corrected item');
		});
	});

	describe('markDepleted', () => {
		it('should set isDepleted to true', async () => {
			const created = await cupboardRepo.create({
				userId,
				householdId,
				itemName: 'milk'
			});

			const depleted = await cupboardRepo.markDepleted(created.id);

			expect(depleted.isDepleted).toBe(true);
			expect(depleted.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
		});

		it('should hide item from findByHouseholdId', async () => {
			const created = await cupboardRepo.create({ userId, householdId, itemName: 'eggs' });

			await cupboardRepo.markDepleted(created.id);

			const items = await cupboardRepo.findByHouseholdId(householdId);
			expect(items.length).toBe(0);
		});
	});

	describe('delete', () => {
		it('should permanently remove the item', async () => {
			const created = await cupboardRepo.create({
				userId,
				householdId,
				itemName: 'to delete'
			});

			await cupboardRepo.delete(created.id);

			const found = await cupboardRepo.findById(created.id);
			expect(found).toBeNull();
		});

		it('should not throw when deleting non-existent item', async () => {
			await expect(
				cupboardRepo.delete('00000000-0000-0000-0000-000000000000')
			).resolves.not.toThrow();
		});
	});

	describe('countByHouseholdId', () => {
		it('should return 0 for household with no items', async () => {
			const count = await cupboardRepo.countByHouseholdId(householdId);
			expect(count).toBe(0);
		});

		it('should count only non-depleted items for the household', async () => {
			await cupboardRepo.create({ userId, householdId, itemName: 'salt' });
			await cupboardRepo.create({ userId, householdId, itemName: 'pepper' });
			const depleted = await cupboardRepo.create({ userId, householdId, itemName: 'sugar' });
			await cupboardRepo.markDepleted(depleted.id);

			// Other user
			await cupboardRepo.create({
				userId: otherUserId,
				householdId: otherHouseholdId,
				itemName: 'flour'
			});

			const count = await cupboardRepo.countByHouseholdId(householdId);
			expect(count).toBe(2);
		});
	});
});
