import { describe, it, expect, beforeEach } from "vitest";
import { DashboardService } from "../../../src/lib/services/DashboardService";
import { ShoppingListController } from "../../../src/lib/controllers/ShoppingListController";
import {
  MockReceiptRepository,
  MockReceiptItemRepository,
  MockRecipeRepository,
  MockRecipeIngredientRepository,
  MockSavedRecipeRepository,
  MockShoppingListRepository,
  MockShoppingListItemRepository,
  MockPurchaseHistoryRepository,
  MockPantryService,
} from "../../mocks";

describe("DashboardService", () => {
  let service: DashboardService;

  // Repositories
  let receiptRepo: MockReceiptRepository;
  let receiptItemRepo: MockReceiptItemRepository;
  let recipeRepo: MockRecipeRepository;
  let recipeIngredientRepo: MockRecipeIngredientRepository;
  let savedRecipeRepo: MockSavedRecipeRepository;
  let shoppingListRepo: MockShoppingListRepository;
  let shoppingListItemRepo: MockShoppingListItemRepository;
  let purchaseHistoryRepo: MockPurchaseHistoryRepository;
  let pantryService: MockPantryService;

  let shoppingListController: ShoppingListController;

  const userId = "user-dash-1";

  beforeEach(() => {
    receiptRepo = new MockReceiptRepository();
    receiptItemRepo = new MockReceiptItemRepository();
    recipeRepo = new MockRecipeRepository();
    recipeIngredientRepo = new MockRecipeIngredientRepository();
    savedRecipeRepo = new MockSavedRecipeRepository();
    shoppingListRepo = new MockShoppingListRepository();
    shoppingListItemRepo = new MockShoppingListItemRepository();
    purchaseHistoryRepo = new MockPurchaseHistoryRepository();
    pantryService = new MockPantryService();

    // Wire repos
    receiptRepo.setItemRepository(receiptItemRepo);
    recipeRepo.setIngredientRepository(recipeIngredientRepo);
    shoppingListRepo.setItemRepository(shoppingListItemRepo);

    // Create a real ShoppingListController wired with mock repos
    shoppingListController = new ShoppingListController(
      shoppingListRepo,
      shoppingListItemRepo,
      purchaseHistoryRepo,
      recipeIngredientRepo,
      receiptItemRepo,
    );

    service = new DashboardService(
      receiptRepo,
      recipeRepo,
      savedRecipeRepo,
      shoppingListRepo,
      pantryService,
      purchaseHistoryRepo,
      receiptItemRepo,
      shoppingListController,
    );
  });

  describe("getDashboardData", () => {
    it("should return empty dashboard when user has no data", async () => {
      const data = await service.getDashboardData(userId);

      expect(data.metrics).toEqual({
        receipts: 0,
        recipes: 0,
        saved: 0,
        activeListItems: 0,
      });
      expect(data.recentReceipts).toEqual([]);
      expect(data.recentRecipes).toEqual([]);
      expect(data.suggestions).toEqual([]);
      expect(data.pantry).toEqual([]);
      expect(data.activeList).toBeNull();
    });

    it("should return correct receipt count and recent receipts", async () => {
      // Create 5 receipts
      const receipts = [];
      for (let i = 0; i < 5; i++) {
        receipts.push(
          await receiptRepo.create({
            userId,
            imageUrl: `https://example.com/receipt-${i}.jpg`,
            status: "DONE",
            storeName: `Store ${i}`,
          }),
        );
      }

      const data = await service.getDashboardData(userId);

      expect(data.metrics.receipts).toBe(5);
      // getDashboardData requests 3 recent receipts
      expect(data.recentReceipts).toHaveLength(3);
    });

    it("should return correct recipe count and recent recipes with ingredients", async () => {
      // Create 8 recipes with ingredients
      for (let i = 0; i < 8; i++) {
        const recipe = await recipeRepo.create({
          userId,
          title: `Recipe ${i}`,
          instructions: `Steps for recipe ${i}`,
          servings: 4,
        });
        await recipeIngredientRepo.createMany([
          {
            recipeId: recipe.id,
            name: `Ingredient A${i}`,
            quantity: "100",
            unit: "g",
            unitType: "WEIGHT",
            orderIndex: 0,
          },
        ]);
      }

      const data = await service.getDashboardData(userId);

      expect(data.metrics.recipes).toBe(8);
      // getDashboardData requests 6 recent recipes
      expect(data.recentRecipes).toHaveLength(6);
      // Each recipe should have ingredients
      expect(data.recentRecipes[0].ingredients).toHaveLength(1);
      expect(data.recentRecipes[0].ingredients[0].name).toContain(
        "Ingredient A",
      );
    });

    it("should return correct saved recipe count", async () => {
      // Create recipes and save some
      const r1 = await recipeRepo.create({
        userId,
        title: "Recipe 1",
        instructions: "Steps 1",
        servings: 2,
      });
      const r2 = await recipeRepo.create({
        userId,
        title: "Recipe 2",
        instructions: "Steps 2",
        servings: 2,
      });

      await savedRecipeRepo.create({ userId, recipeId: r1.id });
      await savedRecipeRepo.create({ userId, recipeId: r2.id });

      const data = await service.getDashboardData(userId);

      expect(data.metrics.saved).toBe(2);
    });

    it("should return active shopping list with items and stats", async () => {
      const list = await shoppingListRepo.create({
        userId,
        name: "Weekly Groceries",
        isActive: true,
      });
      await shoppingListItemRepo.createMany([
        {
          shoppingListId: list.id,
          name: "Milk",
          quantity: "1",
          unit: "gallon",
          checked: false,
          orderIndex: 0,
        },
        {
          shoppingListId: list.id,
          name: "Eggs",
          quantity: "12",
          unit: "count",
          checked: true,
          orderIndex: 1,
        },
        {
          shoppingListId: list.id,
          name: "Bread",
          quantity: "1",
          unit: "loaf",
          checked: false,
          orderIndex: 2,
        },
      ]);

      const data = await service.getDashboardData(userId);

      expect(data.activeList).not.toBeNull();
      expect(data.activeList!.id).toBe(list.id);
      expect(data.activeList!.name).toBe("Weekly Groceries");
      expect(data.activeList!.items).toHaveLength(3);
      expect(data.activeList!.stats).toEqual({
        totalItems: 3,
        checkedItems: 1,
        completionPercent: 33, // Math.round(1/3 * 100) = 33
      });
      expect(data.metrics.activeListItems).toBe(3);
    });

    it("should return null activeList when no active list exists", async () => {
      // Create an inactive list
      await shoppingListRepo.create({
        userId,
        name: "Old List",
        isActive: false,
      });

      const data = await service.getDashboardData(userId);

      expect(data.activeList).toBeNull();
      expect(data.metrics.activeListItems).toBe(0);
    });

    it("should return smart suggestions from purchase history", async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Create purchase history that qualifies for suggestions
      // Item must have avgFrequencyDays and daysSinceLastPurchase >= avgFrequencyDays * 0.8
      await purchaseHistoryRepo.create({
        userId,
        itemName: "Milk",
        lastPurchased: thirtyDaysAgo,
        purchaseCount: 5,
        avgQuantity: "1",
        avgFrequencyDays: 7, // 30 days since purchase, avg freq 7 days => well overdue
      });

      await purchaseHistoryRepo.create({
        userId,
        itemName: "Bread",
        lastPurchased: thirtyDaysAgo,
        purchaseCount: 3,
        avgQuantity: "2",
        avgFrequencyDays: 10,
      });

      const data = await service.getDashboardData(userId);

      // getDashboardData requests 5 suggestions
      expect(data.suggestions.length).toBeGreaterThanOrEqual(2);
      const itemNames = data.suggestions.map((s) => s.itemName);
      expect(itemNames).toContain("Milk");
      expect(itemNames).toContain("Bread");
    });

    it("should return pantry items from purchase history", async () => {
      const now = new Date();
      // Recent purchase => high confidence => included in pantry
      const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      await purchaseHistoryRepo.create({
        userId,
        itemName: "Butter",
        lastPurchased: recentDate,
        purchaseCount: 3,
        avgQuantity: "1",
        avgFrequencyDays: 14,
      });

      // Create a receipt item so the pantry controller can find category info
      const receipt = await receiptRepo.create({
        userId,
        imageUrl: "https://example.com/r.jpg",
        status: "DONE",
      });
      await receiptItemRepo.create({
        receiptId: receipt.id,
        rawName: "Butter",
        normalizedName: "butter",
        quantity: "1",
        unit: "pack",
        unitType: "COUNT",
        category: "dairy",
      });

      const data = await service.getDashboardData(userId);

      expect(data.pantry.length).toBeGreaterThanOrEqual(1);
      const butterItem = data.pantry.find((p) => p.itemName === "Butter");
      expect(butterItem).toBeDefined();
      expect(butterItem!.stockConfidence).toBeGreaterThan(0.2);
      expect(butterItem!.category).toBe("dairy");
    });

    it("should not include pantry items with low stock confidence", async () => {
      const now = new Date();
      // Very old purchase => low confidence => excluded
      const oldDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      await purchaseHistoryRepo.create({
        userId,
        itemName: "Ancient Spice",
        lastPurchased: oldDate,
        purchaseCount: 1,
        avgQuantity: "1",
        avgFrequencyDays: 30,
      });

      const data = await service.getDashboardData(userId);

      const found = data.pantry.find((p) => p.itemName === "Ancient Spice");
      expect(found).toBeUndefined();
    });

    it("should aggregate data from multiple sources correctly", async () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Set up receipts
      for (let i = 0; i < 4; i++) {
        await receiptRepo.create({
          userId,
          imageUrl: `https://example.com/r${i}.jpg`,
          status: "DONE",
        });
      }

      // Set up recipes
      for (let i = 0; i < 3; i++) {
        const recipe = await recipeRepo.create({
          userId,
          title: `Recipe ${i}`,
          instructions: `Steps ${i}`,
          servings: 2,
        });
        await recipeIngredientRepo.createMany([
          {
            recipeId: recipe.id,
            name: `Ing ${i}`,
            quantity: "100",
            unit: "g",
            unitType: "WEIGHT",
            orderIndex: 0,
          },
        ]);
      }

      // Save one recipe
      const allRecipes = await recipeRepo.findByUserId(userId);
      await savedRecipeRepo.create({ userId, recipeId: allRecipes[0].id });

      // Active shopping list with 2 items
      const list = await shoppingListRepo.create({
        userId,
        name: "Current List",
        isActive: true,
      });
      await shoppingListItemRepo.createMany([
        {
          shoppingListId: list.id,
          name: "Apples",
          checked: false,
          orderIndex: 0,
        },
        {
          shoppingListId: list.id,
          name: "Oranges",
          checked: true,
          orderIndex: 1,
        },
      ]);

      // Purchase history for suggestions
      await purchaseHistoryRepo.create({
        userId,
        itemName: "Coffee",
        lastPurchased: thirtyDaysAgo,
        purchaseCount: 10,
        avgQuantity: "1",
        avgFrequencyDays: 7,
      });

      // Recent purchase for pantry
      await purchaseHistoryRepo.create({
        userId,
        itemName: "Eggs",
        lastPurchased: fiveDaysAgo,
        purchaseCount: 5,
        avgQuantity: "12",
        avgFrequencyDays: 10,
      });

      const data = await service.getDashboardData(userId);

      // Verify all sections
      expect(data.metrics.receipts).toBe(4);
      expect(data.metrics.recipes).toBe(3);
      expect(data.metrics.saved).toBe(1);
      expect(data.metrics.activeListItems).toBe(2);

      expect(data.recentReceipts).toHaveLength(3); // capped at 3
      expect(data.recentRecipes).toHaveLength(3);
      expect(data.recentRecipes[0].ingredients).toHaveLength(1);

      expect(data.activeList).not.toBeNull();
      expect(data.activeList!.items).toHaveLength(2);
      expect(data.activeList!.stats).toEqual({
        totalItems: 2,
        checkedItems: 1,
        completionPercent: 50,
      });

      // Coffee should be suggested (30 days overdue on 7-day cycle)
      const coffeeSuggestion = data.suggestions.find(
        (s) => s.itemName === "Coffee",
      );
      expect(coffeeSuggestion).toBeDefined();

      // Eggs should appear in pantry (purchased 5 days ago with 10-day freq)
      const eggsPantry = data.pantry.find((p) => p.itemName === "Eggs");
      expect(eggsPantry).toBeDefined();
      expect(eggsPantry!.stockConfidence).toBeGreaterThan(0.2);
    });

    it("should not mix data from other users", async () => {
      const otherUserId = "user-other";

      // Create data for other user
      await receiptRepo.create({
        userId: otherUserId,
        imageUrl: "https://example.com/other.jpg",
        status: "DONE",
      });
      await recipeRepo.create({
        userId: otherUserId,
        title: "Other Recipe",
        instructions: "Other steps",
        servings: 2,
      });
      await shoppingListRepo.create({
        userId: otherUserId,
        name: "Other List",
        isActive: true,
      });

      const data = await service.getDashboardData(userId);

      expect(data.metrics.receipts).toBe(0);
      expect(data.metrics.recipes).toBe(0);
      expect(data.metrics.saved).toBe(0);
      expect(data.recentReceipts).toEqual([]);
      expect(data.recentRecipes).toEqual([]);
      expect(data.activeList).toBeNull();
    });

    it("should return active list stats as null when active list has no items", async () => {
      await shoppingListRepo.create({
        userId,
        name: "Empty List",
        isActive: true,
      });

      const data = await service.getDashboardData(userId);

      expect(data.activeList).not.toBeNull();
      expect(data.activeList!.items).toHaveLength(0);
      // calculateListStatsPure returns null for empty items
      expect(data.activeList!.stats).toBeNull();
      expect(data.metrics.activeListItems).toBe(0);
    });

    it("should return 100% completion when all items are checked", async () => {
      const list = await shoppingListRepo.create({
        userId,
        name: "Done List",
        isActive: true,
      });
      await shoppingListItemRepo.createMany([
        {
          shoppingListId: list.id,
          name: "Item A",
          checked: true,
          orderIndex: 0,
        },
        {
          shoppingListId: list.id,
          name: "Item B",
          checked: true,
          orderIndex: 1,
        },
      ]);

      const data = await service.getDashboardData(userId);

      expect(data.activeList!.stats).toEqual({
        totalItems: 2,
        checkedItems: 2,
        completionPercent: 100,
      });
    });

    it("should limit recent receipts to 3", async () => {
      for (let i = 0; i < 10; i++) {
        await receiptRepo.create({
          userId,
          imageUrl: `https://example.com/r${i}.jpg`,
          status: "DONE",
        });
      }

      const data = await service.getDashboardData(userId);

      expect(data.recentReceipts).toHaveLength(3);
    });

    it("should limit recent recipes to 6", async () => {
      for (let i = 0; i < 10; i++) {
        await recipeRepo.create({
          userId,
          title: `Recipe ${i}`,
          instructions: `Steps ${i}`,
          servings: 2,
        });
      }

      const data = await service.getDashboardData(userId);

      expect(data.recentRecipes).toHaveLength(6);
    });

    it("should limit smart suggestions to 5", async () => {
      const now = new Date();
      const longAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      // Create 10 items that all qualify for suggestion
      for (let i = 0; i < 10; i++) {
        await purchaseHistoryRepo.create({
          userId,
          itemName: `Item ${i}`,
          lastPurchased: longAgo,
          purchaseCount: 5,
          avgQuantity: "1",
          avgFrequencyDays: 7,
        });
      }

      const data = await service.getDashboardData(userId);

      expect(data.suggestions).toHaveLength(5);
    });

    it("should return pantry items sorted by stock confidence descending", async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      await purchaseHistoryRepo.create({
        userId,
        itemName: "Fresh Item",
        lastPurchased: oneDayAgo,
        purchaseCount: 3,
        avgQuantity: "1",
        avgFrequencyDays: 14,
      });

      await purchaseHistoryRepo.create({
        userId,
        itemName: "Older Item",
        lastPurchased: fiveDaysAgo,
        purchaseCount: 3,
        avgQuantity: "1",
        avgFrequencyDays: 14,
      });

      const data = await service.getDashboardData(userId);

      expect(data.pantry.length).toBeGreaterThanOrEqual(2);
      // First item should have higher confidence than second
      const freshIdx = data.pantry.findIndex(
        (p) => p.itemName === "Fresh Item",
      );
      const olderIdx = data.pantry.findIndex(
        (p) => p.itemName === "Older Item",
      );
      expect(freshIdx).toBeLessThan(olderIdx);
      expect(data.pantry[freshIdx].stockConfidence).toBeGreaterThanOrEqual(
        data.pantry[olderIdx].stockConfidence,
      );
    });
  });
});
