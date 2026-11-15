import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTables, teardownTestDb } from '../helpers/testDb';
import { UserRepository } from '../../src/lib/repositories/UserRepositories';
import { HouseholdRepository } from '../../src/lib/repositories/HouseholdRepository';
import { CupboardItemRepository } from '../../src/lib/repositories/CupboardItemRepository';
import { ShoppingListRepository } from '../../src/lib/repositories/ShoppingListRepositories';
import { HouseholdEventRepository } from '../../src/lib/repositories/HouseholdEventRepository';

/** When the joiner joins the inviter's household. */
const JOINED_AT = new Date('2026-11-14T12:00:00Z');

describe('HouseholdRepository (DB)', () => {
	let householdRepo: HouseholdRepository;
	let cupboardRepo: CupboardItemRepository;
	let shoppingListRepo: ShoppingListRepository;
	let eventRepo: HouseholdEventRepository;
	let userRepo: UserRepository;
	let joinerId: string;
	let inviterHouseholdId: string;
	let joinerHouseholdId: string;

	beforeEach(async () => {
		const db = await setupTestDb();
		await cleanTables();
		userRepo = new UserRepository(db);
		householdRepo = new HouseholdRepository(db);
		eventRepo = new HouseholdEventRepository(db);
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

	describe('time zone', () => {
		it('gives a new household the Brussels time zone', async () => {
			const household = await householdRepo.findHouseholdById(inviterHouseholdId);

			expect(household?.timeZone).toBe('Europe/Brussels');
		});

		it('stores a changed time zone', async () => {
			await householdRepo.updateTimeZone(inviterHouseholdId, 'America/New_York');

			const household = await householdRepo.findHouseholdById(inviterHouseholdId);
			expect(household?.timeZone).toBe('America/New_York');
		});
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

			await householdRepo.moveMemberWithData(
				joinerId,
				joinerHouseholdId,
				inviterHouseholdId,
				JOINED_AT
			);

			expect((await cupboardRepo.findById(item.id))?.householdId).toBe(inviterHouseholdId);
		});

		it('moves a shopping list into the new household', async () => {
			const list = await shoppingListRepo.create({
				userId: joinerId,
				householdId: joinerHouseholdId,
				name: 'Weekly shop'
			});

			await householdRepo.moveMemberWithData(
				joinerId,
				joinerHouseholdId,
				inviterHouseholdId,
				JOINED_AT
			);

			expect((await shoppingListRepo.findById(list.id))?.householdId).toBe(inviterHouseholdId);
		});

		it('re-points the membership to the new household', async () => {
			await householdRepo.moveMemberWithData(
				joinerId,
				joinerHouseholdId,
				inviterHouseholdId,
				JOINED_AT
			);

			expect((await householdRepo.findMemberByUserId(joinerId))?.householdId).toBe(
				inviterHouseholdId
			);
		});

		it('sets the join time to when the member joined', async () => {
			await householdRepo.moveMemberWithData(
				joinerId,
				joinerHouseholdId,
				inviterHouseholdId,
				JOINED_AT
			);

			expect((await householdRepo.findMemberByUserId(joinerId))?.joinedAt).toEqual(JOINED_AT);
		});

		describe('household events', () => {
			const before = new Date('2026-11-14T10:00:00Z');
			const since = new Date('2026-11-01T00:00:00Z');

			async function joinerShops() {
				return eventRepo.append({
					householdId: joinerHouseholdId,
					actorUserId: joinerId,
					kind: 'SHOP_DONE',
					payload: {},
					createdAt: before
				});
			}

			it('keeps an event in the old household that still has members', async () => {
				const flatmate = await userRepo.create({
					email: 'flatmate@example.com',
					name: 'Linus Flatmate',
					authProviderId: 'oauth-flatmate'
				});
				await householdRepo.createMember({
					householdId: joinerHouseholdId,
					userId: flatmate.id,
					displayName: 'Linus'
				});
				const event = await joinerShops();

				await householdRepo.moveMemberWithData(
					joinerId,
					joinerHouseholdId,
					inviterHouseholdId,
					JOINED_AT
				);

				expect((await eventRepo.listSince(joinerHouseholdId, since)).map((e) => e.id)).toEqual([
					event.id
				]);
			});

			it('does not move an event into the new household', async () => {
				await joinerShops();

				await householdRepo.moveMemberWithData(
					joinerId,
					joinerHouseholdId,
					inviterHouseholdId,
					JOINED_AT
				);

				expect(await eventRepo.listSince(inviterHouseholdId, since)).toEqual([]);
			});
		});

		it('deletes the emptied household', async () => {
			await householdRepo.moveMemberWithData(
				joinerId,
				joinerHouseholdId,
				inviterHouseholdId,
				JOINED_AT
			);

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
