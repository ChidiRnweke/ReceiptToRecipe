import type {
  IPantryService,
  PantryItem,
} from "../../src/lib/services/interfaces/IPantryService";
import {
  calculateStockConfidencePure,
  calculateDepletionDatePure,
  getShelfLifePure,
} from "../../src/lib/services/pantryCalculations";

/**
 * Mock implementation of IPantryService for testing
 * Uses pure calculation functions
 */
export class MockPantryService implements IPantryService {
  calculateStockConfidence(
    lastPurchased: Date,
    avgFrequencyDays: number | null,
    category: string | null,
    quantity?: number,
  ): number {
    const now = new Date();
    const daysSincePurchase = Math.floor(
      (now.getTime() - lastPurchased.getTime()) / (1000 * 60 * 60 * 24),
    );
    const estimatedLifespan = avgFrequencyDays || this.getShelfLife(category);
    return calculateStockConfidencePure(
      daysSincePurchase,
      estimatedLifespan,
      quantity || 1,
    );
  }

  calculateDepletionDate(
    lastPurchased: Date,
    avgFrequencyDays: number | null,
    category: string | null,
  ): Date {
    const lifespan = avgFrequencyDays || this.getShelfLife(category);
    return calculateDepletionDatePure(lastPurchased, lifespan);
  }

  getShelfLife(category: string | null): number {
    return getShelfLifePure(category);
  }
}
