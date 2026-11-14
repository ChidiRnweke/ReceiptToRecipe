import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { AppFactory } from '$lib/factories';

type RestorableItemInput = {
	name: string;
	quantity: string | null;
	unit: string | null;
	fromRecipeId: string | null;
	notes: string | null;
	checked: boolean;
};

function parseRestorableItem(raw: FormDataEntryValue | null): RestorableItemInput | null {
	if (!raw || typeof raw !== 'string') return null;

	try {
		const parsed = JSON.parse(raw) as Partial<RestorableItemInput>;
		if (!parsed || typeof parsed !== 'object') return null;
		if (typeof parsed.name !== 'string' || parsed.name.trim().length === 0) return null;

		return {
			name: parsed.name,
			quantity: typeof parsed.quantity === 'string' ? parsed.quantity : null,
			unit: typeof parsed.unit === 'string' ? parsed.unit : null,
			fromRecipeId: typeof parsed.fromRecipeId === 'string' ? parsed.fromRecipeId : null,
			notes: typeof parsed.notes === 'string' ? parsed.notes : null,
			checked: Boolean(parsed.checked)
		};
	} catch {
		return null;
	}
}

function parseRestorableItems(raw: FormDataEntryValue | null): RestorableItemInput[] | null {
	if (!raw || typeof raw !== 'string') return null;

	try {
		const parsed = JSON.parse(raw) as unknown[];
		if (!Array.isArray(parsed)) return null;

		const values: RestorableItemInput[] = [];
		for (const value of parsed) {
			const candidate = parseRestorableItem(JSON.stringify(value));
			if (candidate) values.push(candidate);
		}

		return values;
	} catch {
		return null;
	}
}

function itemFingerprint(item: RestorableItemInput): string {
	return [
		item.name.trim().toLowerCase(),
		(item.quantity ?? '').trim().toLowerCase(),
		(item.unit ?? '').trim().toLowerCase(),
		(item.fromRecipeId ?? '').trim().toLowerCase(),
		(item.notes ?? '').trim().toLowerCase(),
		item.checked ? 'checked' : 'unchecked'
	].join('::');
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.actor) {
		throw redirect(302, '/login');
	}

	const shoppingListController = AppFactory.getShoppingListController();
	const pantryController = AppFactory.getPantryController();

	const activeListPromise = shoppingListController.getActiveList(locals.actor);
	const userListsPromise = shoppingListController.getHouseholdLists(locals.actor);

	// Process other lists once we have both (to exclude active list)
	const otherListsPromise = Promise.all([activeListPromise, userListsPromise]).then(
		([activeList, lists]) => {
			return lists.filter((list) => list.id !== activeList?.id);
		}
	);

	// Build recipe map from all lists
	const recipeMapPromise = Promise.all([activeListPromise, userListsPromise]).then(
		async ([activeList, lists]) => {
			const recipeIds = new Set<string>();

			// From active list
			activeList?.items?.forEach((item) => {
				if (item.fromRecipeId) recipeIds.add(item.fromRecipeId);
			});

			// From other lists
			lists.forEach((list) => {
				list.items?.forEach((item) => {
					if (item.fromRecipeId) recipeIds.add(item.fromRecipeId);
				});
			});

			if (recipeIds.size === 0) return {};

			const recipeRepo = AppFactory.getRecipeRepository();
			const recipeList = await recipeRepo.findByIds(Array.from(recipeIds));
			return Object.fromEntries(recipeList.map((r) => [r.id, { id: r.id, title: r.title }]));
		}
	);

	// Non-critical data
	const recipeRepo = AppFactory.getRecipeRepository();
	const recipeCountPromise = recipeRepo.countByHouseholdId(locals.actor.householdId);
	const suggestionsPromise = shoppingListController.getSmartSuggestions(locals.actor);

	const pantryPromise = pantryController.getHouseholdPantry(locals.actor).then((pantry) => {
		const pantryLookup: Record<
			string,
			{ confidence: number; lastPurchased: Date; daysSincePurchase: number }
		> = {};
		for (const item of pantry) {
			if (item.stockConfidence >= 0.7) {
				pantryLookup[item.itemName.toLowerCase()] = {
					confidence: item.stockConfidence,
					lastPurchased: item.lastPurchased,
					daysSincePurchase: item.daysSincePurchase
				};
			}
		}
		return { pantry, pantryLookup };
	});

	return {
		// Everything is streamed now
		streamed: {
			activeList: activeListPromise,
			lists: otherListsPromise,
			suggestions: suggestionsPromise,
			recipeMap: recipeMapPromise,
			recipeCount: recipeCountPromise,
			pantryData: pantryPromise
		}
	};
};

export const actions: Actions = {
	restoreItem: async ({ request, locals }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const listId = data.get('listId')?.toString();
		const item = parseRestorableItem(data.get('item'));

		if (!listId || !item) {
			return fail(400, { error: 'List ID and restorable item are required' });
		}

		const shoppingListController = AppFactory.getShoppingListController();
		const userLists = await shoppingListController.getHouseholdLists(locals.actor);
		const targetList = userLists.find((list) => list.id === listId);

		if (!targetList) {
			return fail(403, { error: 'Shopping list not found' });
		}

		const shoppingListItemRepository = AppFactory.getShoppingListItemRepository();
		const existingItems = await shoppingListItemRepository.findByListId(listId);
		const existingFingerprints = new Set(
			existingItems.map((existing) =>
				itemFingerprint({
					name: existing.name,
					quantity: existing.quantity,
					unit: existing.unit,
					fromRecipeId: existing.fromRecipeId,
					notes: existing.notes,
					checked: existing.checked
				})
			)
		);

		if (existingFingerprints.has(itemFingerprint(item))) {
			return { success: true, idempotent: true };
		}

		const maxOrderIndex = await shoppingListItemRepository.getMaxOrderIndex(listId);
		const restoredItem = await shoppingListItemRepository.create({
			shoppingListId: listId,
			name: item.name,
			quantity: item.quantity,
			unit: item.unit,
			fromRecipeId: item.fromRecipeId,
			notes: item.notes,
			checked: item.checked,
			orderIndex: maxOrderIndex + 1
		});

		return { success: true, idempotent: false, restoredItemId: restoredItem.id };
	},

	restoreCheckedItems: async ({ request, locals }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const listId = data.get('listId')?.toString();
		const items = parseRestorableItems(data.get('items'));

		if (!listId || !items) {
			return fail(400, { error: 'List ID and restorable items are required' });
		}

		if (items.length === 0) {
			return { success: true, restoredCount: 0, idempotent: true };
		}

		const shoppingListController = AppFactory.getShoppingListController();
		const userLists = await shoppingListController.getHouseholdLists(locals.actor);
		const targetList = userLists.find((list) => list.id === listId);

		if (!targetList) {
			return fail(403, { error: 'Shopping list not found' });
		}

		const shoppingListItemRepository = AppFactory.getShoppingListItemRepository();
		const existingItems = await shoppingListItemRepository.findByListId(listId);
		const existingFingerprints = new Set(
			existingItems.map((existing) =>
				itemFingerprint({
					name: existing.name,
					quantity: existing.quantity,
					unit: existing.unit,
					fromRecipeId: existing.fromRecipeId,
					notes: existing.notes,
					checked: existing.checked
				})
			)
		);

		let nextOrderIndex = (await shoppingListItemRepository.getMaxOrderIndex(listId)) + 1;
		let restoredCount = 0;

		for (const item of items) {
			const fingerprint = itemFingerprint(item);
			if (existingFingerprints.has(fingerprint)) continue;

			await shoppingListItemRepository.create({
				shoppingListId: listId,
				name: item.name,
				quantity: item.quantity,
				unit: item.unit,
				fromRecipeId: item.fromRecipeId,
				notes: item.notes,
				checked: item.checked,
				orderIndex: nextOrderIndex++
			});

			existingFingerprints.add(fingerprint);
			restoredCount++;
		}

		return {
			success: true,
			restoredCount,
			idempotent: restoredCount === 0
		};
	},

	completeShopping: async ({ request, locals }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const listId = data.get('listId')?.toString();

		if (!listId) {
			return fail(400, { error: 'List ID is required' });
		}

		try {
			const shoppingListController = AppFactory.getShoppingListController();
			await shoppingListController.completeShopping(locals.actor, listId);
			return { success: true };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to complete shopping'
			});
		}
	},

	createList: async ({ request, locals }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const name = data.get('name')?.toString() || 'Shopping List';

		try {
			const shoppingListController = AppFactory.getShoppingListController();
			const list = await shoppingListController.createList(locals.actor, name);
			return { success: true, listId: list.id };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to create list'
			});
		}
	},

	generateRestock: async ({ locals }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		try {
			const shoppingListController = AppFactory.getShoppingListController();
			const list = await shoppingListController.createRestockList(
				locals.actor,
				AppFactory.getLlmService()
			);
			return { success: true, listId: list.id };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to generate restock list'
			});
		}
	},

	addItem: async ({ request, locals }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const listId = data.get('listId')?.toString();
		const name = data.get('name')?.toString().trim();
		const quantity = data.get('quantity')?.toString().trim();
		const unit = data.get('unit')?.toString().trim();
		const skipPantryCheck = data.get('skipPantryCheck') === 'true';

		if (!listId || !name) {
			return fail(400, { error: 'List ID and item name are required' });
		}

		try {
			// Check pantry for duplicates unless user explicitly wants to add anyway
			if (!skipPantryCheck) {
				const pantryCtrl = AppFactory.getPantryController();
				const pantry = await pantryCtrl.getHouseholdPantry(locals.actor);

				const nameLC = name.toLowerCase();
				const pantryMatch = pantry.find(
					(p) =>
						p.stockConfidence >= 0.7 &&
						(p.itemName.toLowerCase() === nameLC ||
							p.itemName.toLowerCase().includes(nameLC) ||
							nameLC.includes(p.itemName.toLowerCase()))
				);

				if (pantryMatch) {
					const daysAgo = pantryMatch.daysSincePurchase;
					const dateStr = pantryMatch.lastPurchased.toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric'
					});
					return {
						pantryWarning: true,
						warningMessage: `You might already have "${pantryMatch.itemName}" (bought ${dateStr}, ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago)`,
						matchedItem: pantryMatch.itemName,
						confidence: Math.round(pantryMatch.stockConfidence * 100),
						pendingItem: {
							name,
							quantity: quantity || '1',
							unit: unit || 'count',
							listId
						}
					};
				}
			}

			const shoppingListController = AppFactory.getShoppingListController();
			await shoppingListController.addItem(locals.actor, listId, {
				name,
				quantity: quantity || '1',
				unit: unit || 'count'
			});
			return { success: true };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to add item'
			});
		}
	},

	toggleItem: async ({ request, locals }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const itemId = data.get('itemId')?.toString();
		const checked = data.get('checked') === 'true';

		if (!itemId) {
			return fail(400, { error: 'Item ID is required' });
		}

		try {
			const shoppingListController = AppFactory.getShoppingListController();
			await shoppingListController.toggleItem(locals.actor, itemId, checked);
			return { success: true };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to update item'
			});
		}
	},

	deleteItem: async ({ request, locals }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const itemId = data.get('itemId')?.toString();

		if (!itemId) {
			return fail(400, { error: 'Item ID is required' });
		}

		try {
			const shoppingListController = AppFactory.getShoppingListController();
			await shoppingListController.removeItem(locals.actor, itemId);
			return { success: true };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to delete item'
			});
		}
	},

	deleteList: async ({ request, locals }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const listId = data.get('listId')?.toString();

		if (!listId) {
			return fail(400, { error: 'List ID is required' });
		}

		try {
			const shoppingListController = AppFactory.getShoppingListController();
			await shoppingListController.deleteList(listId, locals.actor);
			return { success: true };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to delete list'
			});
		}
	},

	generateFromRecipes: async ({ request, locals }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const recipeIdsStr = data.get('recipeIds')?.toString() || '';
		const listName = data.get('listName')?.toString() || 'Recipe Shopping List';

		const recipeIds = recipeIdsStr.split(',').filter(Boolean);

		if (recipeIds.length === 0) {
			return fail(400, { error: 'Please select at least one recipe' });
		}

		try {
			const shoppingListController = AppFactory.getShoppingListController();
			const list = await shoppingListController.generateFromRecipes(
				locals.actor,
				recipeIds,
				listName
			);
			return { success: true, listId: list.id };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to generate shopping list'
			});
		}
	},

	addSuggestion: async ({ request, locals }) => {
		if (!locals.actor) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const listId = data.get('listId')?.toString();
		const itemName = data.get('itemName')?.toString();
		const suggestedQuantity = data.get('suggestedQuantity')?.toString() || null;
		const avgFrequencyDays = data.get('avgFrequencyDays')
			? parseInt(data.get('avgFrequencyDays')!.toString())
			: null;
		const lastPurchased = data.get('lastPurchased')?.toString();
		const daysSinceLastPurchase = data.get('daysSinceLastPurchase')
			? parseInt(data.get('daysSinceLastPurchase')!.toString())
			: 0;

		if (!listId || !itemName || !lastPurchased) {
			return fail(400, { error: 'Missing suggestion data' });
		}

		try {
			const shoppingListController = AppFactory.getShoppingListController();
			await shoppingListController.addSuggestion(locals.actor, listId, {
				itemName,
				suggestedQuantity,
				avgFrequencyDays,
				lastPurchased: new Date(lastPurchased),
				daysSinceLastPurchase
			});
			return { success: true };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to add suggestion'
			});
		}
	}
};
