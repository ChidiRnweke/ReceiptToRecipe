import type { PageServerLoad, Actions } from "./$types";
import { AppFactory } from "$lib/factories";
import { fail, redirect } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return { user: null };
  }

  const userId = locals.user.id;
  const dashboardService = AppFactory.getDashboardService();
  const dashboardData = await dashboardService.getDashboardData(userId);

  return {
    user: locals.user,
    ...dashboardData,
  };
};

export const actions: Actions = {
  toggleIngredient: async ({ locals, request }) => {
    if (!locals.user) {
      throw redirect(302, "/login");
    }

    const data = await request.formData();
    const ingredientName = data.get("ingredientName")?.toString();

    if (!ingredientName) {
      return fail(400, { error: "Ingredient name is required" });
    }

    try {
      const listController = AppFactory.getShoppingListController();
      const list = await listController.getActiveList(locals.user.id);

      // Check if item exists
      const existingItem = list.items.find((i) => i.name === ingredientName);

      if (existingItem) {
        await listController.removeItem(locals.user.id, existingItem.id);
        return { success: true, removed: ingredientName };
      } else {
        await listController.addItem(locals.user.id, list.id, {
          name: ingredientName,
          quantity: "1",
          unit: "",
        });
        return { success: true, added: ingredientName };
      }
    } catch (error) {
      return fail(500, {
        error: error instanceof Error ? error.message : "Failed to update list",
      });
    }
  },
};
