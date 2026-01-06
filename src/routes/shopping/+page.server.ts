import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ShoppingListController } from '$lib/controllers';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const shoppingListController = new ShoppingListController();

	const [lists, suggestions] = await Promise.all([
		shoppingListController.getUserLists(locals.user.id),
		shoppingListController.getSmartSuggestions(locals.user.id)
	]);

	return {
		lists,
		suggestions
	};
};

export const actions: Actions = {
	createList: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const name = data.get('name')?.toString() || 'Shopping List';

		try {
			const shoppingListController = new ShoppingListController();
			const list = await shoppingListController.createList(locals.user.id, name);
			return { success: true, listId: list.id };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to create list'
			});
		}
	},

	addItem: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const listId = data.get('listId')?.toString();
		const name = data.get('name')?.toString();
		const quantity = data.get('quantity')?.toString();
		const unit = data.get('unit')?.toString();

		if (!listId || !name) {
			return fail(400, { error: 'List ID and item name are required' });
		}

		try {
			const shoppingListController = new ShoppingListController();
			await shoppingListController.addItem(listId, {
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
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const itemId = data.get('itemId')?.toString();
		const checked = data.get('checked') === 'true';

		if (!itemId) {
			return fail(400, { error: 'Item ID is required' });
		}

		try {
			const shoppingListController = new ShoppingListController();
			await shoppingListController.toggleItem(itemId, checked);
			return { success: true };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to update item'
			});
		}
	},

	deleteItem: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const itemId = data.get('itemId')?.toString();

		if (!itemId) {
			return fail(400, { error: 'Item ID is required' });
		}

		try {
			const shoppingListController = new ShoppingListController();
			await shoppingListController.deleteItem(itemId);
			return { success: true };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to delete item'
			});
		}
	},

	deleteList: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/login');
		}

		const data = await request.formData();
		const listId = data.get('listId')?.toString();

		if (!listId) {
			return fail(400, { error: 'List ID is required' });
		}

		try {
			const shoppingListController = new ShoppingListController();
			await shoppingListController.deleteList(listId);
			return { success: true };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to delete list'
			});
		}
	},

	generateFromRecipes: async ({ request, locals }) => {
		if (!locals.user) {
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
			const shoppingListController = new ShoppingListController();
			const list = await shoppingListController.generateFromRecipes(
				locals.user.id,
				recipeIds,
				listName
			);
			return { success: true, listId: list.id };
		} catch (error) {
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to generate shopping list'
			});
		}
	}
};
