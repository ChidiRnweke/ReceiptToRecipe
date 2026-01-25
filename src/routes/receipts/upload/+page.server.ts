import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { ReceiptController } from "$lib/controllers";
import { AppFactory } from "$lib/factories";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, "/login");
  }
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) {
      throw redirect(302, "/login");
    }

    const data = await request.formData();
    const file = data.get("receipt") as File | null;

    if (!file || file.size === 0) {
      return fail(400, { error: "Please select a receipt image" });
    }

    if (!file.type.startsWith("image/")) {
      return fail(400, { error: "Please upload an image file" });
    }

    if (file.size > 10 * 1024 * 1024) {
      return fail(400, { error: "File size must be less than 10MB" });
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
      const receipt = await receiptController.uploadReceipt({
        userId: locals.user.id,
        file,
      });

      throw redirect(302, `/receipts/${receipt.id}`);
    } catch (error) {
      console.error("Upload error:", error);
      if (error instanceof Response) throw error;
      return fail(500, {
        error:
          error instanceof Error ? error.message : "Failed to upload receipt",
      });
    }
  },
};
