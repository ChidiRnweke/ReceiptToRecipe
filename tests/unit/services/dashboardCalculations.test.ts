import { describe, it, expect } from "vitest";
import { calculateListStatsPure } from "../../../src/lib/services/dashboardCalculations";
import type { ShoppingListItemDao } from "../../../src/lib/repositories/daos";

describe("calculateListStatsPure", () => {
  function makeItem(
    overrides: Partial<ShoppingListItemDao> = {},
  ): ShoppingListItemDao {
    return {
      id: "item-1",
      shoppingListId: "list-1",
      name: "Test Item",
      quantity: "1",
      unit: null,
      checked: false,
      fromRecipeId: null,
      notes: null,
      orderIndex: 0,
      createdAt: new Date(),
      ...overrides,
    };
  }

  it("should return null for empty array", () => {
    expect(calculateListStatsPure([])).toBeNull();
  });

  it("should return null for null/undefined items", () => {
    expect(calculateListStatsPure(null as any)).toBeNull();
    expect(calculateListStatsPure(undefined as any)).toBeNull();
  });

  it("should return correct stats when no items are checked", () => {
    const items = [
      makeItem(),
      makeItem({ id: "item-2" }),
      makeItem({ id: "item-3" }),
    ];
    const stats = calculateListStatsPure(items);

    expect(stats).toEqual({
      totalItems: 3,
      checkedItems: 0,
      completionPercent: 0,
    });
  });

  it("should return correct stats when all items are checked", () => {
    const items = [
      makeItem({ checked: true }),
      makeItem({ id: "item-2", checked: true }),
      makeItem({ id: "item-3", checked: true }),
    ];
    const stats = calculateListStatsPure(items);

    expect(stats).toEqual({
      totalItems: 3,
      checkedItems: 3,
      completionPercent: 100,
    });
  });

  it("should return correct stats for partial completion", () => {
    const items = [
      makeItem({ checked: true }),
      makeItem({ id: "item-2", checked: false }),
      makeItem({ id: "item-3", checked: true }),
      makeItem({ id: "item-4", checked: false }),
    ];
    const stats = calculateListStatsPure(items);

    expect(stats).toEqual({
      totalItems: 4,
      checkedItems: 2,
      completionPercent: 50,
    });
  });

  it("should round completion percentage", () => {
    const items = [
      makeItem({ checked: true }),
      makeItem({ id: "item-2", checked: false }),
      makeItem({ id: "item-3", checked: false }),
    ];
    const stats = calculateListStatsPure(items);

    // 1/3 = 33.33... → rounds to 33
    expect(stats).toEqual({
      totalItems: 3,
      checkedItems: 1,
      completionPercent: 33,
    });
  });

  it("should handle single item list", () => {
    const items = [makeItem({ checked: true })];
    const stats = calculateListStatsPure(items);

    expect(stats).toEqual({
      totalItems: 1,
      checkedItems: 1,
      completionPercent: 100,
    });
  });
});
