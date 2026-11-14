import { eq, count } from 'drizzle-orm';
import type { Database } from '$db/client';
import * as schema from '$db/schema';
import type { IHouseholdRepository } from './interfaces';
import type {
	Household,
	HouseholdInvite,
	HouseholdMember,
	MemberRoles,
	NewHousehold,
	NewHouseholdInvite,
	NewHouseholdMember
} from '$lib/models/household';

/** Tables whose rows belong to a household and move with a joining member. */
const HOUSEHOLD_SCOPED_TABLES = [
	schema.receipts,
	schema.recipes,
	schema.shoppingLists,
	schema.plannedMeals,
	schema.purchaseHistory,
	schema.cupboardItems,
	schema.kitchenEvents
] as const;

export class HouseholdRepository implements IHouseholdRepository {
	constructor(private db: Database) {}

	async createHousehold(household: NewHousehold): Promise<Household> {
		const [created] = await this.db
			.insert(schema.households)
			.values({ name: household.name })
			.returning();
		return this.toHousehold(created);
	}

	async findHouseholdById(id: string): Promise<Household | null> {
		const row = await this.db.query.households.findFirst({
			where: eq(schema.households.id, id)
		});
		return row ? this.toHousehold(row) : null;
	}

	async findMemberByUserId(userId: string): Promise<HouseholdMember | null> {
		const row = await this.db.query.householdMembers.findFirst({
			where: eq(schema.householdMembers.userId, userId)
		});
		return row ? this.toMember(row) : null;
	}

	async findMemberById(id: string): Promise<HouseholdMember | null> {
		const row = await this.db.query.householdMembers.findFirst({
			where: eq(schema.householdMembers.id, id)
		});
		return row ? this.toMember(row) : null;
	}

	async listMembers(householdId: string): Promise<HouseholdMember[]> {
		const rows = await this.db.query.householdMembers.findMany({
			where: eq(schema.householdMembers.householdId, householdId),
			orderBy: [schema.householdMembers.joinedAt]
		});
		return rows.map((row) => this.toMember(row));
	}

	async createMember(member: NewHouseholdMember): Promise<HouseholdMember> {
		const [created] = await this.db
			.insert(schema.householdMembers)
			.values({
				householdId: member.householdId,
				userId: member.userId,
				displayName: member.displayName,
				color: member.color ?? null,
				plans: member.roles?.plans ?? true,
				shops: member.roles?.shops ?? true,
				cooks: member.roles?.cooks ?? true
			})
			.returning();
		return this.toMember(created);
	}

	/**
	 * Creates a household of one for a user who has none. Safe under concurrent first requests:
	 * if another request already made the membership, the new household is discarded and the
	 * existing membership is returned.
	 */
	async createSoloHousehold(
		name: string,
		member: Omit<NewHouseholdMember, 'householdId'>
	): Promise<HouseholdMember> {
		return this.db.transaction(async (tx) => {
			const [household] = await tx.insert(schema.households).values({ name }).returning();
			const [created] = await tx
				.insert(schema.householdMembers)
				.values({
					householdId: household.id,
					userId: member.userId,
					displayName: member.displayName,
					color: member.color ?? null
				})
				.onConflictDoNothing({ target: schema.householdMembers.userId })
				.returning();
			if (created) return this.toMember(created);

			await tx.delete(schema.households).where(eq(schema.households.id, household.id));
			const existing = await tx.query.householdMembers.findFirst({
				where: eq(schema.householdMembers.userId, member.userId)
			});
			if (!existing) throw new Error('Household membership could not be created');
			return this.toMember(existing);
		});
	}

	async updateMemberRoles(memberId: string, roles: MemberRoles): Promise<HouseholdMember> {
		const [updated] = await this.db
			.update(schema.householdMembers)
			.set({ plans: roles.plans, shops: roles.shops, cooks: roles.cooks })
			.where(eq(schema.householdMembers.id, memberId))
			.returning();
		return this.toMember(updated);
	}

	async createInvite(invite: NewHouseholdInvite): Promise<HouseholdInvite> {
		const [created] = await this.db
			.insert(schema.householdInvites)
			.values({
				householdId: invite.householdId,
				token: invite.token,
				createdBy: invite.createdBy,
				expiresAt: invite.expiresAt
			})
			.returning();
		return this.toInvite(created);
	}

	async findInviteByToken(token: string): Promise<HouseholdInvite | null> {
		const row = await this.db.query.householdInvites.findFirst({
			where: eq(schema.householdInvites.token, token)
		});
		return row ? this.toInvite(row) : null;
	}

	async markInviteUsed(inviteId: string, usedBy: string, usedAt: Date): Promise<HouseholdInvite> {
		const [updated] = await this.db
			.update(schema.householdInvites)
			.set({ usedBy, usedAt })
			.where(eq(schema.householdInvites.id, inviteId))
			.returning();
		return this.toInvite(updated);
	}

	async moveMemberWithData(
		userId: string,
		fromHouseholdId: string,
		toHouseholdId: string
	): Promise<void> {
		await this.db.transaction(async (tx) => {
			await tx
				.update(schema.householdMembers)
				.set({ householdId: toHouseholdId, joinedAt: new Date() })
				.where(eq(schema.householdMembers.userId, userId));

			const [{ remaining }] = await tx
				.select({ remaining: count() })
				.from(schema.householdMembers)
				.where(eq(schema.householdMembers.householdId, fromHouseholdId));

			// Someone still lives in the old kitchen: its data stays with them.
			if (remaining > 0) return;

			for (const table of HOUSEHOLD_SCOPED_TABLES) {
				await tx
					.update(table)
					.set({ householdId: toHouseholdId })
					.where(eq(table.householdId, fromHouseholdId));
			}

			await tx.delete(schema.households).where(eq(schema.households.id, fromHouseholdId));
		});
	}

	private toHousehold(row: typeof schema.households.$inferSelect): Household {
		return {
			id: row.id,
			name: row.name,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		};
	}

	private toMember(row: typeof schema.householdMembers.$inferSelect): HouseholdMember {
		return {
			id: row.id,
			householdId: row.householdId,
			userId: row.userId,
			displayName: row.displayName,
			color: row.color,
			roles: { plans: row.plans, shops: row.shops, cooks: row.cooks },
			joinedAt: row.joinedAt
		};
	}

	private toInvite(row: typeof schema.householdInvites.$inferSelect): HouseholdInvite {
		return {
			id: row.id,
			householdId: row.householdId,
			token: row.token,
			createdBy: row.createdBy,
			expiresAt: row.expiresAt,
			usedAt: row.usedAt,
			usedBy: row.usedBy,
			createdAt: row.createdAt
		};
	}
}
