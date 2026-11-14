import type {
	ListItem,
	ListItemPatch,
	NewListItem,
	ReconcilePlan,
	ShopNeedItem,
	ShopNeeds
} from '$lib/models/shop';

/** Amounts closer than this count as the same. */
const SAME_AMOUNT = 1e-6;

/** The identity of a plan or usual row: one per source, item, unit and hold. */
function identity(
	source: string,
	mergeKey: string | null,
	unit: string | null,
	held: boolean
): string {
	return `${source}|${mergeKey ?? ''}|${unit ?? ''}|${held ? 'held' : 'now'}`;
}

/** The rows the needs ask for. */
export function desiredItems(needs: ShopNeeds): NewListItem[] {
	const row = (
		item: ShopNeedItem,
		source: NewListItem['source'],
		heldUntil: Date | null
	): NewListItem => ({
		name: item.name,
		source,
		mergeKey: item.itemKey,
		quantity: item.quantity,
		unit: item.unit,
		heldUntil,
		forPlannedMealIds: item.mealIds
	});
	const held = needs.afterShop?.at ?? null;
	return [
		...needs.now.flatMap((group) => group.items.map((item) => row(item, 'PLAN', null))),
		...needs.usuals.map((item) => row(item, 'USUAL', null)),
		...needs.later.flatMap((group) =>
			group.items.map((item) => row(item, 'PLAN', held ?? new Date(0)))
		)
	];
}

function sameIds(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((id, i) => id === b[i]);
}

function patchFor(current: ListItem, wanted: NewListItem): ListItemPatch | null {
	const patch: ListItemPatch = {};
	if (current.name !== wanted.name) patch.name = wanted.name;
	const amountChanged =
		current.quantity === null || wanted.quantity === null
			? current.quantity !== wanted.quantity
			: Math.abs(current.quantity - wanted.quantity) > SAME_AMOUNT;
	if (amountChanged) patch.quantity = wanted.quantity;
	if ((current.heldUntil?.getTime() ?? null) !== (wanted.heldUntil?.getTime() ?? null)) {
		patch.heldUntil = wanted.heldUntil;
	}
	if (!sameIds(current.forPlannedMealIds, wanted.forPlannedMealIds)) {
		patch.forPlannedMealIds = wanted.forPlannedMealIds;
	}
	return Object.keys(patch).length ? patch : null;
}

/**
 * The changes that make the list's plan and usual rows match the needs. Applying the plan and
 * reconciling again gives an empty plan. Items a person added (MANUAL) or an agent added (AGENT)
 * are never touched, and neither is a ticked item: someone has it in the basket. A ticked row
 * also stands for its need, so ticking never brings the same item back.
 */
export function reconcileList(persisted: ListItem[], needs: ShopNeeds): ReconcilePlan {
	const wanted = new Map<string, NewListItem>();
	for (const item of desiredItems(needs)) {
		const key = identity(item.source, item.mergeKey, item.unit, item.heldUntil !== null);
		if (!wanted.has(key)) wanted.set(key, item);
	}

	const plan: ReconcilePlan = { create: [], update: [], remove: [] };
	const covered = new Set<string>();
	for (const item of persisted) {
		if (item.source !== 'PLAN' && item.source !== 'USUAL') continue;
		const key = identity(item.source, item.mergeKey, item.unit, item.heldUntil !== null);
		if (item.checked) {
			covered.add(key);
			continue;
		}
		const want = wanted.get(key);
		if (!want || covered.has(key)) {
			plan.remove.push(item.id);
			continue;
		}
		covered.add(key);
		const patch = patchFor(item, want);
		if (patch) plan.update.push({ id: item.id, patch });
	}
	for (const [key, item] of wanted) {
		if (!covered.has(key)) plan.create.push(item);
	}
	return plan;
}
