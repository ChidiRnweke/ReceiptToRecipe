import { redirect, fail } from "@sveltejs/kit";
import type { PageServerLoad, Actions } from "./$types";
import { ReceiptController, ShoppingListController } from "$lib/controllers";
import { AppFactory } from "$lib/factories";
import { db } from "$lib/db/client";
import { recipes } from "$lib/db/schema";
import { eq, sql, inArray } from "drizzle-orm";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, "/login");
  }

  const receiptController = new ReceiptController(
    AppFactory.getStorageService(),
    AppFactory.getOcrService(),
    AppFactory.getNormalizationService(),
    AppFactory.getProductNormalizationService(),
    AppFactory.getPantryService(),
    AppFactory.getJobQueue(),
  );
  const receipts = await receiptController.getUserReceipts(locals.user.id);

  // Get recipe counts for each receipt
  const receiptIds = receipts.map((r) => r.id);
  let recipeCounts: Record<string, number> = {};

  if (receiptIds.length > 0) {
    const counts = await db
      .select({
        sourceReceiptId: recipes.sourceReceiptId,
        count: sql<number>`count(*)`,
      })
      .from(recipes)
      .where(inArray(recipes.sourceReceiptId, receiptIds))
      .groupBy(recipes.sourceReceiptId);

    recipeCounts = Object.fromEntries(
      counts
        .filter((c) => c.sourceReceiptId)
        .map((c) => [c.sourceReceiptId!, c.count]),
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
      const listController = new ShoppingListController();
      const list = await listController.getActiveList(locals.user.id);
      await listController.addReceiptItems(list.id, receiptId);
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
      const receiptController = new ReceiptController(
        AppFactory.getStorageService(),
        AppFactory.getOcrService(),
        AppFactory.getNormalizationService(),
        AppFactory.getProductNormalizationService(),
        AppFactory.getPantryService(),
        AppFactory.getJobQueue(),
      );

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
