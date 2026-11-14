import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTables, teardownTestDb } from '../helpers/testDb';
import { UserRepository } from '../../src/lib/repositories/UserRepositories';
import { HouseholdRepository } from '../../src/lib/repositories/HouseholdRepository';
import { CupboardItemRepository } from '../../src/lib/repositories/CupboardItemRepository';
import { ShoppingListRepository } from '../../src/lib/repositories/ShoppingListRepositories';

describe('HouseholdRepository (DB)', () => {
	let householdRepo: HouseholdRepository;
	let cupboardRepo: CupboardItemRepository;
	let shoppingListRepo: ShoppingListRepository;
	let joinerId: string;
	let inviterHouseholdId: string;
	let joinerHouseholdId: string;

	beforeEach(async () => {
		const db = await setupTestDb();
		await cleanTables();
		const userRepo = new UserRepository(db);
		householdRepo = new HouseholdRepository(db);
		cupboardRepo = new CupboardItemRepository(db);
		shoppingListRepo = new ShoppingListRepository(db);

		const inviter = await userRepo.create({
			email: 'inviter@example.com',
			name: 'Ada Lovelace',
			authProviderId: 'oauth-inviter'
		});
		const joiner = await userRepo.create({
			email: 'joiner@example.com',
			name: 'Grace Hopper',
			authProviderId: 'oauth-joiner'
		});
		joinerId = joiner.id;

		inviterHouseholdId = (await householdRepo.createHousehold({ name: "Ada's kitchen" })).id;
		await householdRepo.createMember({
			householdId: inviterHouseholdId,
			userId: inviter.id,
			displayName: 'Ada'
		});
		joinerHouseholdId = (await householdRepo.createHousehold({ name: "Grace's kitchen" })).id;
		await householdRepo.createMember({
			householdId: joinerHouseholdId,
			userId: joinerId,
			displayName: 'Grace'
		});
	});

	afterAll(async () => {
		await teardownTestDb();
	});

	describe('members', () => {
		it('finds a created member by user id', async () => {
			const member = await householdRepo.findMemberByUserId(joinerId);

			expect(member?.householdId).toBe(joinerHouseholdId);
		});

		it('gives a new member every role by default', async () => {
			const member = await householdRepo.findMemberByUserId(joinerId);

			expect(member?.roles).toEqual({ plans: true, shops: true, cooks: true });
		});
	});

	describe('moving a member with their data', () => {
		it('moves a cupboard item into the new household', async () => {
			const item = await cupboardRepo.create({
				userId: joinerId,
				householdId: joinerHouseholdId,
				itemName: 'flour'
			});

			await householdRepo.moveMemberWithData(joinerId, joinerHouseholdId, inviterHouseholdId);

			expect((await cupboardRepo.findById(item.id))?.householdId).toBe(inviterHouseholdId);
		});

		it('moves a shopping list into the new household', async () => {
			const list = await shoppingListRepo.create({
				userId: joinerId,
				householdId: joinerHouseholdId,
				name: 'Weekly shop'
			});

			await householdRepo.moveMemberWithData(joinerId, joinerHouseholdId, inviterHouseholdId);

			expect((await shoppingListRepo.findById(list.id))?.householdId).toBe(inviterHouseholdId);
		});

		it('re-points the membership to the new household', async () => {
			await householdRepo.moveMemberWithData(joinerId, joinerHouseholdId, inviterHouseholdId);

			expect((await householdRepo.findMemberByUserId(joinerId))?.householdId).toBe(
				inviterHouseholdId
			);
		});

		it('deletes the emptied household', async () => {
			await householdRepo.moveMemberWithData(joinerId, joinerHouseholdId, inviterHouseholdId);

			expect(await householdRepo.findHouseholdById(joinerHouseholdId)).toBeNull();
		});
	});

	describe('createSoloHousehold', () => {
		let loneUserId: string;

		beforeEach(async () => {
			const db = await setupTestDb();
			const lone = await new UserRepository(db).create({
				email: 'lone@example.com',
				name: 'Lin Lone',
				authProviderId: 'oauth-lone'
			});
			loneUserId = lone.id;
		});

		it('gives a user exactly one membership when two first requests race', async () => {
			await Promise.all([
				householdRepo.createSoloHousehold("Lin's kitchen", {
					userId: loneUserId,
					displayName: 'Lin'
				}),
				householdRepo.createSoloHousehold("Lin's kitchen", {
					userId: loneUserId,
					displayName: 'Lin'
				})
			]);
			const member = await householdRepo.findMemberByUserId(loneUserId);
			expect(await householdRepo.listMembers(member!.householdId)).toHaveLength(1);
		});

		it('returns the same household to both racing requests', async () => {
			const [a, b] = await Promise.all([
				householdRepo.createSoloHousehold("Lin's kitchen", {
					userId: loneUserId,
					displayName: 'Lin'
				}),
				householdRepo.createSoloHousehold("Lin's kitchen", {
					userId: loneUserId,
					displayName: 'Lin'
				})
			]);
			expect(a.householdId).toBe(b.householdId);
		});
	});
});
