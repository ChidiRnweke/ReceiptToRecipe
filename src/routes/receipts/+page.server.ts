import { redirect, fail } from "@sveltejs/kit";
import type { PageServerLoad, Actions } from "./$types";
import { AppFactory } from "$lib/factories";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, "/login");
  }

  const receiptController = AppFactory.getReceiptController();
  const receipts = await receiptController.getUserReceipts(locals.user.id);

  // Get recipe counts for each receipt
  const receiptIds = receipts.map((r) => r.id);
  let recipeCounts: Record<string, number> = {};

  if (receiptIds.length > 0) {
    const recipeRepo = AppFactory.getRecipeRepository();
    const counts = await recipeRepo.countByReceiptIds(receiptIds);

    recipeCounts = Object.fromEntries(
      counts.map((c) => [c.receiptId, c.count])
    );
  }

  return {
    receipts,
    recipeCounts,
  };
};

export const actions: Actions = {
  addToShopping: async ({ locals, request }) => {
    if (!locals.user) {
      throw redirect(302, "/login");
    }

    const data = await request.formData();
    const receiptId = data.get("receiptId")?.toString();

    if (!receiptId) {
      return fail(400, { error: "Receipt ID is required" });
    }

    try {
      const listController = AppFactory.getShoppingListController();
      const list = await listController.getActiveList(locals.user.id);
      await listController.addReceiptItems(locals.user.id, list.id, receiptId);
      return { success: true, listId: list.id };
    } catch (err) {
      return fail(500, {
        error: err instanceof Error ? err.message : "Failed to add items",
      });
    }
  },

  delete: async ({ locals, request }) => {
    if (!locals.user) {
      throw redirect(302, "/login");
    }

    const data = await request.formData();
    const receiptId = data.get("id")?.toString();

    if (!receiptId) {
      return fail(400, { error: "Receipt ID is required" });
    }

    try {
      const receiptController = AppFactory.getReceiptController();
      await receiptController.deleteReceipt(receiptId, locals.user.id);
      return { success: true };
    } catch (err) {
      console.error("Delete error:", err);
      return fail(500, {
        error: err instanceof Error ? err.message : "Failed to delete receipt",
      });
    }
  },
};
