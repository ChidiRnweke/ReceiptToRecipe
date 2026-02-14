import { redirect, fail } from "@sveltejs/kit";
import type { PageServerLoad, Actions } from "./$types";
import { AppFactory } from "$lib/factories";
import { TasteProfileController } from "$lib/controllers";
import type { DietType, AllergySeverity, PreferenceLevel } from "$services";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, "/login");

  const controller = new TasteProfileController(
    AppFactory.getTasteProfileService(),
  );
  const profile = await controller.getProfile(locals.user.id);

  return {
    profile,
  };
};

export const actions: Actions = {
  setDiet: async ({ locals, request }) => {
    if (!locals.user) return fail(401);
    const data = await request.formData();
    const dietTypeRaw = data.get("dietType")?.toString();

    // Handle "null" string from form if any
    const finalDiet =
      dietTypeRaw === "null" || !dietTypeRaw ? null : (dietTypeRaw as DietType);

    try {
      const controller = new TasteProfileController(
        AppFactory.getTasteProfileService(),
      );
      await controller.setDietType(locals.user.id, finalDiet);
      return { success: true };
    } catch (e) {
      return fail(500, { error: "Failed to set diet type" });
    }
  },

  addAllergy: async ({ locals, request }) => {
    if (!locals.user) return fail(401);
    const data = await request.formData();
    const allergen = data.get("allergen")?.toString();
    const severity = data.get("severity")?.toString() as AllergySeverity;

    if (!allergen) return fail(400, { error: "Allergen required" });

    try {
      const controller = new TasteProfileController(
        AppFactory.getTasteProfileService(),
      );
      await controller.addAllergy(
        locals.user.id,
        allergen,
        severity || "avoid",
      );
      return { success: true };
    } catch (e) {
      return fail(500, { error: "Failed to add allergy" });
    }
  },

  removeAllergy: async ({ locals, request }) => {
    if (!locals.user) return fail(401);
    const data = await request.formData();
    const allergen = data.get("allergen")?.toString();

    if (!allergen) return fail(400);

    try {
      const controller = new TasteProfileController(
        AppFactory.getTasteProfileService(),
      );
      await controller.removeAllergy(locals.user.id, allergen);
      return { success: true };
    } catch (e) {
      return fail(500);
    }
  },

  setIngredientPref: async ({ locals, request }) => {
    if (!locals.user) return fail(401);
    const data = await request.formData();
    const ingredient = data.get("ingredient")?.toString();
    const preference = data.get("preference")?.toString() as PreferenceLevel;

    if (!ingredient || !preference) return fail(400);

    try {
      const controller = new TasteProfileController(
        AppFactory.getTasteProfileService(),
      );
      await controller.setIngredientPreference(
        locals.user.id,
        ingredient,
        preference,
      );
      return { success: true };
    } catch (e) {
      return fail(500);
    }
  },

  removeIngredientPref: async ({ locals, request }) => {
    if (!locals.user) return fail(401);
    const data = await request.formData();
    const ingredient = data.get("ingredient")?.toString();

    if (!ingredient) return fail(400);

    try {
      const controller = new TasteProfileController(
        AppFactory.getTasteProfileService(),
      );
      await controller.removeIngredientPreference(locals.user.id, ingredient);
      return { success: true };
    } catch (e) {
      return fail(500);
    }
  },

  setCuisinePref: async ({ locals, request }) => {
    if (!locals.user) return fail(401);
    const data = await request.formData();
    const cuisine = data.get("cuisine")?.toString();
    const preference = data.get("preference")?.toString() as PreferenceLevel;

    if (!cuisine || !preference) return fail(400);

    try {
      const controller = new TasteProfileController(
        AppFactory.getTasteProfileService(),
      );
      await controller.setCuisinePreference(
        locals.user.id,
        cuisine,
        preference,
      );
      return { success: true };
    } catch (e) {
      return fail(500);
    }
  },
};
