import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTables, teardownTestDb } from '../helpers/testDb';
import { UserRepository } from '../../src/lib/repositories/UserRepositories';
import { CupboardItemRepository } from '../../src/lib/repositories/CupboardItemRepository';

describe('CupboardItemRepository (DB)', () => {
	let db: any;
	let userRepo: UserRepository;
	let cupboardRepo: CupboardItemRepository;
	let userId: string;
	let otherUserId: string;

	beforeEach(async () => {
		db = await setupTestDb();
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
	});

	afterAll(async () => {
		await teardownTestDb();
	});

	describe('create', () => {
		it('should create a cupboard item with minimal fields', async () => {
			const item = await cupboardRepo.create({
				userId,
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

		it('should create a cupboard item with all fields', async () => {
			const addedDate = new Date('2025-06-01');
			const item = await cupboardRepo.create({
				userId,
				itemName: 'organic flour',
				quantity: '2',
				unit: 'kg',
				category: 'pantry',
				addedDate,
				shelfLifeDays: 180,
				notes: 'from farmers market'
			});

			expect(item.itemName).toBe('organic flour');
			expect(item.quantity).toBe('2');
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

	describe('findByUserId', () => {
		it('should return only non-depleted items for the user', async () => {
			await cupboardRepo.create({ userId, itemName: 'salt' });
			await cupboardRepo.create({ userId, itemName: 'pepper' });
			const depleted = await cupboardRepo.create({ userId, itemName: 'sugar' });
			await cupboardRepo.markDepleted(depleted.id);

			// Other user's item
			await cupboardRepo.create({ userId: otherUserId, itemName: 'flour' });

			const items = await cupboardRepo.findByUserId(userId);

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
				itemName: 'old item',
				addedDate: new Date('2025-01-01')
			});
			await cupboardRepo.create({
				userId,
				itemName: 'new item',
				addedDate: new Date('2025-06-01')
			});

			const items = await cupboardRepo.findByUserId(userId);

			expect(items.length).toBe(2);
			expect(items[0].itemName).toBe('new item');
			expect(items[1].itemName).toBe('old item');
		});

		it('should return empty array for user with no items', async () => {
			const items = await cupboardRepo.findByUserId(userId);
			expect(items).toEqual([]);
		});
	});

	describe('findByUserAndItem', () => {
		it('should find an active item by user and name', async () => {
			await cupboardRepo.create({ userId, itemName: 'olive oil' });

			const found = await cupboardRepo.findByUserAndItem(userId, 'olive oil');
			expect(found).not.toBeNull();
			expect(found!.itemName).toBe('olive oil');
		});

		it('should not find depleted items', async () => {
			const item = await cupboardRepo.create({ userId, itemName: 'butter' });
			await cupboardRepo.markDepleted(item.id);

			const found = await cupboardRepo.findByUserAndItem(userId, 'butter');
			expect(found).toBeNull();
		});

		it('should not find items from other users', async () => {
			await cupboardRepo.create({ userId: otherUserId, itemName: 'eggs' });

			const found = await cupboardRepo.findByUserAndItem(userId, 'eggs');
			expect(found).toBeNull();
		});

		it('should return null for non-existent item', async () => {
			const found = await cupboardRepo.findByUserAndItem(userId, 'nonexistent');
			expect(found).toBeNull();
		});
	});

	describe('update', () => {
		it('should update specified fields', async () => {
			const created = await cupboardRepo.create({
				userId,
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

			expect(updated.quantity).toBe('5');
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
				itemName: 'milk'
			});

			const depleted = await cupboardRepo.markDepleted(created.id);

			expect(depleted.isDepleted).toBe(true);
			expect(depleted.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
		});

		it('should hide item from findByUserId', async () => {
			const created = await cupboardRepo.create({ userId, itemName: 'eggs' });

			await cupboardRepo.markDepleted(created.id);

			const items = await cupboardRepo.findByUserId(userId);
			expect(items.length).toBe(0);
		});
	});

	describe('delete', () => {
		it('should permanently remove the item', async () => {
			const created = await cupboardRepo.create({
				userId,
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

	describe('countByUserId', () => {
		it('should return 0 for user with no items', async () => {
			const count = await cupboardRepo.countByUserId(userId);
			expect(count).toBe(0);
		});

		it('should count only non-depleted items for the user', async () => {
			await cupboardRepo.create({ userId, itemName: 'salt' });
			await cupboardRepo.create({ userId, itemName: 'pepper' });
			const depleted = await cupboardRepo.create({ userId, itemName: 'sugar' });
			await cupboardRepo.markDepleted(depleted.id);

			// Other user
			await cupboardRepo.create({ userId: otherUserId, itemName: 'flour' });

			const count = await cupboardRepo.countByUserId(userId);
			expect(count).toBe(2);
		});
	});
});
