import type {
	IPurchaseHistoryRepository,
	IShoppingListItemRepository,
	IShoppingListRepository,
	ShoppingListItemDao
} from '$repositories';
import type { Actor } from '$lib/models/household';
import { normalizeItemKey } from '$lib/models/kitchen';
import type { ListItem, Purchase, ReconcilePlan, ShopList } from '$lib/models/shop';
import type { IShopService, NewManualItem } from './interfaces/IShopService';

const DAY_MS = 24 * 60 * 60 * 1000;

function toListItem(item: ShoppingListItemDao): ListItem {
	const quantity = item.quantity === null ? null : parseFloat(item.quantity);
	return {
		id: item.id,
		name: item.name,
		source: item.source,
		mergeKey: item.mergeKey,
		quantity: quantity !== null && Number.isFinite(quantity) ? quantity : null,
		unit: item.unit,
		checked: item.checked,
		heldUntil: item.heldUntil,
		forPlannedMealIds: item.forPlannedMealIds
	};
}

const amount = (quantity: number | null | undefined) =>
	quantity === null || quantity === undefined ? null : String(quantity);

export class ShopService implements IShopService {
	constructor(
		private listRepository: IShoppingListRepository,
		private itemRepository: IShoppingListItemRepository,
		private purchaseHistoryRepository: IPurchaseHistoryRepository
	) {}

	async getList(actor: Actor): Promise<ShopList> {
		const existing = await this.listRepository.findActiveByHouseholdId(actor.householdId);
		if (existing) return { id: existing.id, items: existing.items.map(toListItem) };
		const created = await this.listRepository.create({
			userId: actor.userId,
			householdId: actor.householdId,
			name: 'Shopping List',
			isActive: true
		});
		return { id: created.id, items: [] };
	}

	async applyPlan(list: ShopList, plan: ReconcilePlan): Promise<void> {
		await this.itemRepository.deleteMany(plan.remove);
		for (const { id, patch } of plan.update) {
			await this.itemRepository.update(id, {
				...patch,
				quantity: patch.quantity === undefined ? undefined : amount(patch.quantity)
			});
		}
		let order = (await this.itemRepository.getMaxOrderIndex(list.id)) + 1;
		await this.itemRepository.createNeeds(
			plan.create.map((item) => ({
				shoppingListId: list.id,
				name: item.name,
				quantity: amount(item.quantity),
				unit: item.unit,
				source: item.source,
				mergeKey: item.mergeKey,
				heldUntil: item.heldUntil,
				forPlannedMealIds: item.forPlannedMealIds,
				orderIndex: order++
			}))
		);
	}

	async setChecked(actor: Actor, itemId: string, checked: boolean): Promise<ListItem> {
		await this.ownItem(actor, itemId);
		return toListItem(await this.itemRepository.update(itemId, { checked }));
	}

	async addManual(actor: Actor, item: NewManualItem): Promise<ListItem> {
		const list = await this.getList(actor);
		const order = (await this.itemRepository.getMaxOrderIndex(list.id)) + 1;
		const created = await this.itemRepository.create({
			shoppingListId: list.id,
			name: item.name.trim(),
			quantity: amount(item.quantity),
			unit: item.unit ?? null,
			source: 'MANUAL',
			mergeKey: normalizeItemKey(item.name),
			orderIndex: order
		});
		return toListItem(created);
	}

	async removeManual(actor: Actor, itemId: string): Promise<void> {
		const item = await this.ownItem(actor, itemId);
		if (item.source !== 'MANUAL') throw new Error('Only items added by hand can be removed');
		await this.itemRepository.delete(itemId);
	}

	async removeItems(actor: Actor, itemIds: string[]): Promise<void> {
		for (const id of itemIds) await this.ownItem(actor, id);
		await this.itemRepository.deleteMany(itemIds);
	}

	async untick(actor: Actor, itemIds: string[]): Promise<void> {
		for (const id of itemIds) {
			await this.ownItem(actor, id);
			await this.itemRepository.update(id, { checked: false });
		}
	}

	async recordPurchases(actor: Actor, purchases: Purchase[], at: Date): Promise<void> {
		for (const purchase of purchases) {
			const existing = await this.purchaseHistoryRepository.findByHouseholdAndItem(
				actor.householdId,
				purchase.name
			);
			if (!existing) {
				await this.purchaseHistoryRepository.create({
					userId: actor.userId,
					householdId: actor.householdId,
					itemName: purchase.name,
					lastPurchased: at,
					purchaseCount: 1,
					avgQuantity: amount(purchase.quantity) ?? undefined,
					avgFrequencyDays: null
				});
				continue;
			}
			const daysSince = Math.floor((at.getTime() - existing.lastPurchased.getTime()) / DAY_MS);
			const frequency = existing.avgFrequencyDays
				? Math.round((existing.avgFrequencyDays + daysSince) / 2)
				: daysSince > 0
					? daysSince
					: existing.avgFrequencyDays;
			await this.purchaseHistoryRepository.update(existing.id, {
				lastPurchased: at,
				purchaseCount: existing.purchaseCount + 1,
				avgFrequencyDays: frequency
			});
		}
	}

	/** The item, when it is on a list of the actor's household. */
	private async ownItem(actor: Actor, itemId: string): Promise<ShoppingListItemDao> {
		const item = await this.itemRepository.findById(itemId);
		const list = item ? await this.listRepository.findById(item.shoppingListId) : null;
		if (!item || !list || list.householdId !== actor.householdId) {
			throw new Error('Item not found');
		}
		return item;
	}
}
