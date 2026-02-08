import type { LayoutServerLoad } from "./$types";
import { AppFactory } from "$lib/factories";
import { ShoppingListController } from "$lib/controllers";

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return {
      user: null,
      workflowCounts: null,
    };
  }

  const userId = locals.user.id;

  // Fetch counts for the workflow nav using repositories
  const receiptRepo = AppFactory.getReceiptRepository();
  const recipeRepo = AppFactory.getRecipeRepository();

  const [receiptCount, recipeCount] = await Promise.all([
    receiptRepo.countByUserId(userId),
    recipeRepo.countByUserId(userId),
  ]);

  const listController = new ShoppingListController();
  let shoppingItems = 0;
  try {
    const activeList = await listController.getActiveList(userId);
    shoppingItems = activeList.items?.filter((i) => !i.checked).length || 0;
  } catch {
    // No active list
  }

  return {
    user: locals.user,
    workflowCounts: {
      receipts: receiptCount,
      recipes: recipeCount,
      shoppingItems,
    },
  };
};
