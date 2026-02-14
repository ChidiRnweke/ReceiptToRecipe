import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { setupTestDb, cleanTables, teardownTestDb } from "../helpers/testDb";
import {
  UserRepository,
  UserPreferencesRepository,
} from "../../src/lib/repositories/UserRepositories";

describe("UserPreferencesRepository (DB)", () => {
  let db: any;
  let userRepo: UserRepository;
  let prefsRepo: UserPreferencesRepository;
  let userId: string;

  beforeEach(async () => {
    db = await setupTestDb();
    await cleanTables();
    userRepo = new UserRepository(db);
    prefsRepo = new UserPreferencesRepository(db);

    const user = await userRepo.create({
      email: "prefs@example.com",
      name: "Prefs User",
      authProviderId: "oauth-prefs",
    });
    userId = user.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("create", () => {
    it("should create preferences with default values", async () => {
      const prefs = await prefsRepo.create({ userId });

      expect(prefs.userId).toBe(userId);
      expect(prefs.defaultServings).toBe(2);
      expect(prefs.allergies).toEqual([]);
      expect(prefs.dietaryRestrictions).toEqual([]);
      expect(prefs.cuisinePreferences).toEqual([]);
      expect(prefs.excludedIngredients).toEqual([]);
      expect(prefs.caloricGoal).toBeNull();
      expect(prefs.createdAt).toBeInstanceOf(Date);
    });

    it("should create preferences with custom values", async () => {
      const prefs = await prefsRepo.create({
        userId,
        allergies: ["peanuts", "shellfish"],
        dietaryRestrictions: ["vegetarian"],
        cuisinePreferences: ["Italian", "Japanese"],
        excludedIngredients: ["cilantro"],
        caloricGoal: 2000,
        defaultServings: 4,
      });

      expect(prefs.allergies).toEqual(["peanuts", "shellfish"]);
      expect(prefs.dietaryRestrictions).toEqual(["vegetarian"]);
      expect(prefs.cuisinePreferences).toEqual(["Italian", "Japanese"]);
      expect(prefs.excludedIngredients).toEqual(["cilantro"]);
      expect(prefs.caloricGoal).toBe(2000);
      expect(prefs.defaultServings).toBe(4);
    });
  });

  describe("findByUserId", () => {
    it("should find preferences for a user", async () => {
      await prefsRepo.create({
        userId,
        allergies: ["dairy"],
      });

      const found = await prefsRepo.findByUserId(userId);

      expect(found).not.toBeNull();
      expect(found!.userId).toBe(userId);
      expect(found!.allergies).toEqual(["dairy"]);
    });

    it("should return null when no preferences exist", async () => {
      const found = await prefsRepo.findByUserId(userId);
      expect(found).toBeNull();
    });
  });

  describe("update", () => {
    it("should update specific preference fields", async () => {
      await prefsRepo.create({ userId });

      const updated = await prefsRepo.update(userId, {
        allergies: ["gluten"],
        defaultServings: 6,
      });

      expect(updated.allergies).toEqual(["gluten"]);
      expect(updated.defaultServings).toBe(6);
      // Untouched fields should remain at defaults
      expect(updated.dietaryRestrictions).toEqual([]);
      expect(updated.cuisinePreferences).toEqual([]);
    });

    it("should set updatedAt to a new timestamp", async () => {
      const created = await prefsRepo.create({ userId });
      const originalUpdatedAt = created.updatedAt;

      // Small delay to ensure timestamp difference
      await new Promise((r) => setTimeout(r, 10));

      const updated = await prefsRepo.update(userId, { defaultServings: 8 });

      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });
  });
});
