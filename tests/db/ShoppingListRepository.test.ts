import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { setupTestDb, cleanTables, teardownTestDb } from "../helpers/testDb";
import {
  ShoppingListItemRepository,
  ShoppingListRepository,
} from "../../src/lib/repositories/ShoppingListRepositories";
import { UserRepository } from "../../src/lib/repositories/UserRepositories";

describe("ShoppingListRepository (DB)", () => {
  let db: any;
  let userRepo: UserRepository;
  let listRepo: ShoppingListRepository;
  let itemRepo: ShoppingListItemRepository;
  let userId: string;

  beforeEach(async () => {
    db = await setupTestDb();
    await cleanTables();

    userRepo = new UserRepository(db);
    listRepo = new ShoppingListRepository(db);
    itemRepo = new ShoppingListItemRepository(db);

    const user = await userRepo.create({
      email: "test@example.com",
      authProviderId: "google-123",
      name: "Test User",
    });
    userId = user.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  // ─── ShoppingListRepository ────────────────────────────────────────

  describe("create", () => {
    it("should create a list with isActive defaulting to true", async () => {
      const list = await listRepo.create({ userId, name: "Groceries" });

      expect(list.id).toBeDefined();
      expect(list.userId).toBe(userId);
      expect(list.name).toBe("Groceries");
      expect(list.isActive).toBe(true);
      expect(list.createdAt).toBeInstanceOf(Date);
    });

    it("should create an inactive list when specified", async () => {
      const list = await listRepo.create({
        userId,
        name: "Old List",
        isActive: false,
      });
      expect(list.isActive).toBe(false);
    });
  });

  describe("findById", () => {
    it("should find a list by ID", async () => {
      const created = await listRepo.create({ userId, name: "Find Me" });
      const found = await listRepo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe("Find Me");
    });

    it("should return null for non-existent ID", async () => {
      const found = await listRepo.findById(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(found).toBeNull();
    });
  });

  describe("findByIdWithItems", () => {
    it("should return list with items sorted by orderIndex", async () => {
      const list = await listRepo.create({ userId, name: "With Items" });

      // Insert items in non-sequential order
      await itemRepo.create({
        shoppingListId: list.id,
        name: "Bananas",
        orderIndex: 2,
      });
      await itemRepo.create({
        shoppingListId: list.id,
        name: "Apples",
        orderIndex: 0,
      });
      await itemRepo.create({
        shoppingListId: list.id,
        name: "Oranges",
        orderIndex: 1,
      });

      const found = await listRepo.findByIdWithItems(list.id);

      expect(found).not.toBeNull();
      expect(found!.items.length).toBe(3);
      expect(found!.items[0].name).toBe("Apples");
      expect(found!.items[1].name).toBe("Oranges");
      expect(found!.items[2].name).toBe("Bananas");
    });

    it("should return empty items array for list with no items", async () => {
      const list = await listRepo.create({ userId, name: "Empty" });
      const found = await listRepo.findByIdWithItems(list.id);

      expect(found).not.toBeNull();
      expect(found!.items).toEqual([]);
    });

    it("should return null for non-existent list", async () => {
      const found = await listRepo.findByIdWithItems(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(found).toBeNull();
    });
  });

  describe("findActiveByUserId", () => {
    it("should return the active list for a user", async () => {
      await listRepo.create({ userId, name: "Active List", isActive: true });
      await listRepo.create({ userId, name: "Inactive", isActive: false });

      const found = await listRepo.findActiveByUserId(userId);

      expect(found).not.toBeNull();
      expect(found!.name).toBe("Active List");
      expect(found!.isActive).toBe(true);
    });

    it("should return null when no active list exists", async () => {
      await listRepo.create({ userId, name: "Inactive", isActive: false });

      const found = await listRepo.findActiveByUserId(userId);
      expect(found).toBeNull();
    });

    it("should include items sorted by orderIndex", async () => {
      const list = await listRepo.create({
        userId,
        name: "Active",
        isActive: true,
      });
      await itemRepo.create({
        shoppingListId: list.id,
        name: "B",
        orderIndex: 1,
      });
      await itemRepo.create({
        shoppingListId: list.id,
        name: "A",
        orderIndex: 0,
      });

      const found = await listRepo.findActiveByUserId(userId);

      expect(found!.items[0].name).toBe("A");
      expect(found!.items[1].name).toBe("B");
    });
  });

  describe("findByUserId", () => {
    it("should return all lists for a user sorted by createdAt descending", async () => {
      const first = await listRepo.create({ userId, name: "First" });
      const second = await listRepo.create({ userId, name: "Second" });
      const third = await listRepo.create({ userId, name: "Third" });

      const lists = await listRepo.findByUserId(userId);

      expect(lists.length).toBe(3);
      // Most recent first
      expect(lists[0].name).toBe("Third");
      expect(lists[1].name).toBe("Second");
      expect(lists[2].name).toBe("First");
    });

    it("should return empty array for user with no lists", async () => {
      const lists = await listRepo.findByUserId(userId);
      expect(lists).toEqual([]);
    });

    it("should not return lists from other users", async () => {
      const otherUser = await userRepo.create({
        email: "other@example.com",
        name: "Other",
        authProviderId: "oauth-other",
      });

      await listRepo.create({ userId, name: "My List" });
      await listRepo.create({ userId: otherUser.id, name: "Their List" });

      const myLists = await listRepo.findByUserId(userId);
      expect(myLists.length).toBe(1);
      expect(myLists[0].name).toBe("My List");
    });
  });

  describe("update", () => {
    it("should update a list name", async () => {
      const list = await listRepo.create({ userId, name: "Original" });
      const updated = await listRepo.update(list.id, { name: "Updated" });

      expect(updated.name).toBe("Updated");
      expect(updated.id).toBe(list.id);
    });

    it("should deactivate a list", async () => {
      const list = await listRepo.create({ userId, name: "Active" });
      const updated = await listRepo.update(list.id, { isActive: false });

      expect(updated.isActive).toBe(false);
    });
  });

  describe("delete", () => {
    it("should delete a list", async () => {
      const list = await listRepo.create({ userId, name: "Delete Me" });
      await listRepo.delete(list.id);

      const found = await listRepo.findById(list.id);
      expect(found).toBeNull();
    });
  });

  describe("deactivateAllByUserId", () => {
    it("should deactivate all lists for a user", async () => {
      await listRepo.create({ userId, name: "List 1", isActive: true });
      await listRepo.create({ userId, name: "List 2", isActive: true });

      await listRepo.deactivateAllByUserId(userId);

      const lists = await listRepo.findByUserId(userId);
      expect(lists.every((l) => l.isActive === false)).toBe(true);
    });

    it("should not affect other users lists", async () => {
      const otherUser = await userRepo.create({
        email: "other2@example.com",
        name: "Other",
        authProviderId: "oauth-other2",
      });

      await listRepo.create({ userId, name: "My List", isActive: true });
      await listRepo.create({
        userId: otherUser.id,
        name: "Their List",
        isActive: true,
      });

      await listRepo.deactivateAllByUserId(userId);

      const otherLists = await listRepo.findActiveByUserId(otherUser.id);
      expect(otherLists).not.toBeNull();
      expect(otherLists!.isActive).toBe(true);
    });
  });

  // ─── ShoppingListItemRepository ────────────────────────────────────

  describe("ShoppingListItemRepository", () => {
    let listId: string;

    beforeEach(async () => {
      const list = await listRepo.create({ userId, name: "Item Test List" });
      listId = list.id;
    });

    describe("create", () => {
      it("should create an item with defaults", async () => {
        const item = await itemRepo.create({
          shoppingListId: listId,
          name: "Milk",
        });

        expect(item.id).toBeDefined();
        expect(item.name).toBe("Milk");
        expect(item.shoppingListId).toBe(listId);
        expect(item.checked).toBe(false);
        expect(item.orderIndex).toBe(0);
        expect(item.quantity).toBeNull();
        expect(item.unit).toBeNull();
        expect(item.notes).toBeNull();
      });

      it("should create an item with all fields", async () => {
        const item = await itemRepo.create({
          shoppingListId: listId,
          name: "Chicken",
          quantity: "1.5",
          unit: "kg",
          notes: "Free range",
          orderIndex: 5,
          checked: true,
        });

        expect(item.name).toBe("Chicken");
        expect(item.quantity).toBe("1.500");
        expect(item.unit).toBe("kg");
        expect(item.notes).toBe("Free range");
        expect(item.orderIndex).toBe(5);
        expect(item.checked).toBe(true);
      });
    });

    describe("createMany", () => {
      it("should create multiple items at once", async () => {
        const items = await itemRepo.createMany([
          { shoppingListId: listId, name: "Apples" },
          { shoppingListId: listId, name: "Bananas" },
          { shoppingListId: listId, name: "Oranges" },
        ]);

        expect(items.length).toBe(3);
        expect(items.map((i) => i.name).sort()).toEqual([
          "Apples",
          "Bananas",
          "Oranges",
        ]);
      });

      it("should return empty array for empty input", async () => {
        const items = await itemRepo.createMany([]);
        expect(items).toEqual([]);
      });
    });

    describe("findById", () => {
      it("should find an item by ID", async () => {
        const created = await itemRepo.create({
          shoppingListId: listId,
          name: "Find Me",
        });
        const found = await itemRepo.findById(created.id);

        expect(found).not.toBeNull();
        expect(found!.name).toBe("Find Me");
      });

      it("should return null for non-existent ID", async () => {
        const found = await itemRepo.findById(
          "00000000-0000-0000-0000-000000000000",
        );
        expect(found).toBeNull();
      });
    });

    describe("findByListId", () => {
      it("should return items sorted by orderIndex", async () => {
        await itemRepo.create({
          shoppingListId: listId,
          name: "C",
          orderIndex: 2,
        });
        await itemRepo.create({
          shoppingListId: listId,
          name: "A",
          orderIndex: 0,
        });
        await itemRepo.create({
          shoppingListId: listId,
          name: "B",
          orderIndex: 1,
        });

        const items = await itemRepo.findByListId(listId);

        expect(items.length).toBe(3);
        expect(items[0].name).toBe("A");
        expect(items[1].name).toBe("B");
        expect(items[2].name).toBe("C");
      });

      it("should return empty array for list with no items", async () => {
        const items = await itemRepo.findByListId(listId);
        expect(items).toEqual([]);
      });
    });

    describe("findCheckedByListId", () => {
      it("should return only checked items", async () => {
        await itemRepo.create({
          shoppingListId: listId,
          name: "Checked",
          checked: true,
        });
        await itemRepo.create({
          shoppingListId: listId,
          name: "Unchecked",
          checked: false,
        });
        await itemRepo.create({
          shoppingListId: listId,
          name: "Also Checked",
          checked: true,
        });

        const checked = await itemRepo.findCheckedByListId(listId);

        expect(checked.length).toBe(2);
        expect(checked.every((i) => i.checked === true)).toBe(true);
      });

      it("should return empty array when no items are checked", async () => {
        await itemRepo.create({ shoppingListId: listId, name: "Unchecked" });

        const checked = await itemRepo.findCheckedByListId(listId);
        expect(checked).toEqual([]);
      });
    });

    describe("update", () => {
      it("should update an item", async () => {
        const item = await itemRepo.create({
          shoppingListId: listId,
          name: "Original",
        });
        const updated = await itemRepo.update(item.id, {
          name: "Updated",
          checked: true,
        });

        expect(updated.name).toBe("Updated");
        expect(updated.checked).toBe(true);
      });
    });

    describe("delete", () => {
      it("should delete an item", async () => {
        const item = await itemRepo.create({
          shoppingListId: listId,
          name: "Delete Me",
        });
        await itemRepo.delete(item.id);

        const found = await itemRepo.findById(item.id);
        expect(found).toBeNull();
      });
    });

    describe("deleteCheckedByListId", () => {
      it("should delete only checked items from a list", async () => {
        await itemRepo.create({
          shoppingListId: listId,
          name: "Keep",
          checked: false,
        });
        await itemRepo.create({
          shoppingListId: listId,
          name: "Remove 1",
          checked: true,
        });
        await itemRepo.create({
          shoppingListId: listId,
          name: "Remove 2",
          checked: true,
        });

        await itemRepo.deleteCheckedByListId(listId);

        const remaining = await itemRepo.findByListId(listId);
        expect(remaining.length).toBe(1);
        expect(remaining[0].name).toBe("Keep");
      });

      it("should not affect items in other lists", async () => {
        const otherList = await listRepo.create({ userId, name: "Other List" });
        await itemRepo.create({
          shoppingListId: listId,
          name: "Check 1",
          checked: true,
        });
        await itemRepo.create({
          shoppingListId: otherList.id,
          name: "Check 2",
          checked: true,
        });

        await itemRepo.deleteCheckedByListId(listId);

        const otherItems = await itemRepo.findCheckedByListId(otherList.id);
        expect(otherItems.length).toBe(1);
      });
    });

    describe("getMaxOrderIndex", () => {
      it("should return the max order index as a number", async () => {
        await itemRepo.create({
          shoppingListId: listId,
          name: "Item 1",
          orderIndex: 0,
        });

        const maxOrder = await itemRepo.getMaxOrderIndex(listId);

        expect(typeof maxOrder).toBe("number");
        expect(maxOrder).toBe(0);
        expect(maxOrder + 1).toBe(1);
        expect(maxOrder + 1).not.toBe("01");
      });

      it("should return -1 for a list with no items", async () => {
        const maxOrder = await itemRepo.getMaxOrderIndex(listId);

        expect(typeof maxOrder).toBe("number");
        expect(maxOrder).toBe(-1);
        expect(maxOrder + 1).toBe(0);
      });

      it("should return the highest order index across multiple items", async () => {
        await itemRepo.create({
          shoppingListId: listId,
          name: "A",
          orderIndex: 0,
        });
        await itemRepo.create({
          shoppingListId: listId,
          name: "B",
          orderIndex: 5,
        });
        await itemRepo.create({
          shoppingListId: listId,
          name: "C",
          orderIndex: 3,
        });

        const maxOrder = await itemRepo.getMaxOrderIndex(listId);
        expect(maxOrder).toBe(5);
      });
    });

    describe("updateOrderIndex", () => {
      it("should update the order index of an item", async () => {
        const item = await itemRepo.create({
          shoppingListId: listId,
          name: "Move Me",
          orderIndex: 0,
        });
        await itemRepo.updateOrderIndex(item.id, 10);

        const found = await itemRepo.findById(item.id);
        expect(found!.orderIndex).toBe(10);
      });
    });
  });
});
