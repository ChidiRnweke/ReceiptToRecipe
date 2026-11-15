/**
 * Household domain types.
 *
 * A household is the shared kitchen: receipts, recipes, cupboard, shopping lists and the meal
 * plan belong to it. Every user belongs to exactly one household.
 */

export interface MemberRoles {
	plans: boolean;
	shops: boolean;
	cooks: boolean;
}

/** The signed-in person acting on behalf of their household. */
export type Actor = {
	userId: string;
	householdId: string;
	memberId: string;
	displayName: string;
	roles: MemberRoles;
	/** The household's IANA time zone; local days and weekdays are counted in it. */
	timeZone: string;
};

export interface Household {
	id: string;
	name: string;
	/** IANA time zone, e.g. `Europe/Brussels`. Background work counts local days in it. */
	timeZone: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface NewHousehold {
	name: string;
}

export interface HouseholdMember {
	id: string;
	householdId: string;
	userId: string;
	displayName: string;
	color: string | null;
	roles: MemberRoles;
	joinedAt: Date;
}

export interface NewHouseholdMember {
	householdId: string;
	userId: string;
	displayName: string;
	color?: string | null;
	roles?: Partial<MemberRoles>;
}

export interface HouseholdInvite {
	id: string;
	householdId: string;
	token: string;
	createdBy: string;
	expiresAt: Date;
	usedAt: Date | null;
	usedBy: string | null;
	createdAt: Date;
}

export interface NewHouseholdInvite {
	householdId: string;
	token: string;
	createdBy: string;
	expiresAt: Date;
}

/** The time zone a household starts with until a member sets its own. */
export const DEFAULT_TIME_ZONE = 'Europe/Brussels';

/** True when `timeZone` is an IANA time zone this runtime knows, such as `Europe/Brussels`. */
export function isValidTimeZone(timeZone: string): boolean {
	if (!timeZone) return false;
	try {
		new Intl.DateTimeFormat('en', { timeZone });
		return true;
	} catch {
		return false;
	}
}

/** Invites expire one week after they are created. */
export const INVITE_LIFETIME_DAYS = 7;

export class HouseholdInviteError extends Error {
	constructor(
		public readonly reason: 'not_found' | 'expired' | 'used',
		message: string
	) {
		super(message);
		this.name = 'HouseholdInviteError';
	}
}

/**
 * Something one member did that the others should hear about, such as "Sam got the shopping".
 * EATING_OUT also tells Tonight that the household is out today.
 */
export type HouseholdEventKind = 'SHOP_DONE' | 'PLANNED' | 'EATING_OUT' | 'COOKED' | 'JOINED';

export interface HouseholdEventPayload {
	/** SHOP_DONE from "Got everything": the shop's id in the kitchen log, so undo can find it. */
	shopId?: string;
	/** SHOP_DONE from a receipt. */
	receiptId?: string;
	/** PLANNED: the first and the last local day that got meals. */
	from?: number;
	to?: number;
	/** EATING_OUT: the local day the household is out. */
	day?: number;
	/** COOKED: the dish. */
	title?: string;
	[key: string]: unknown;
}

export interface HouseholdEvent {
	id: string;
	householdId: string;
	actorUserId: string | null;
	kind: HouseholdEventKind;
	payload: HouseholdEventPayload;
	createdAt: Date;
}

export interface NewHouseholdEvent {
	householdId: string;
	actorUserId: string | null;
	kind: HouseholdEventKind;
	payload?: HouseholdEventPayload;
	createdAt: Date;
}

const HOUSEHOLD_EVENT_KINDS: readonly HouseholdEventKind[] = [
	'SHOP_DONE',
	'PLANNED',
	'EATING_OUT',
	'COOKED',
	'JOINED'
];

export function isHouseholdEventKind(kind: string): kind is HouseholdEventKind {
	return (HOUSEHOLD_EVENT_KINDS as readonly string[]).includes(kind);
}
