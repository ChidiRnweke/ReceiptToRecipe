export type UnitType = "WEIGHT" | "VOLUME" | "COUNT";

export interface NormalizedQuantity {
  value: number;
  unit: string; // Normalized: g, ml, count
  unitType: UnitType;
  originalValue: string;
}

export interface INormalizationService {
  /**
   * Normalize a quantity string to standard units
   * Weight -> grams (g)
   * Volume -> milliliters (ml)
   * Count -> count
   *
   * @param rawQuantity - Raw quantity string (e.g., "1lb", "16oz", "2 cups")
   * @returns Normalized quantity
   */
  normalizeQuantity(rawQuantity: string): NormalizedQuantity;

  /**
   * Normalize an ingredient name (lowercase, remove extra spaces, etc.)
   * @param rawName - Raw ingredient name
   * @returns Normalized name
   */
  normalizeName(rawName: string): string;

  /**
   * Check if two quantities can be compared (same unit type)
   * @param qty1 - First quantity
   * @param qty2 - Second quantity
   */
  areComparable(qty1: NormalizedQuantity, qty2: NormalizedQuantity): boolean;

  /**
   * Add two quantities (must be same unit type)
   * @param qty1 - First quantity
   * @param qty2 - Second quantity
   * @returns Combined quantity
   */
  add(qty1: NormalizedQuantity, qty2: NormalizedQuantity): NormalizedQuantity;

  /**
   * Scale a quantity by a factor
   * @param qty - Quantity to scale
   * @param factor - Scale factor
   */
  scale(qty: NormalizedQuantity, factor: number): NormalizedQuantity;

  /**
   * Convert a normalized quantity to a human-readable string
   * @param qty - Normalized quantity
   * @returns Human-readable string (e.g., "500g", "250ml", "3 count")
   */
  toDisplayString(qty: NormalizedQuantity): string;
}
