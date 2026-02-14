import { describe, it, expect } from "vitest";
import { formatCurrency } from "../../../src/lib/utils";

describe("utils", () => {
  describe("formatCurrency", () => {
    it("should format number as USD by default", () => {
      const result = formatCurrency(10.5);
      expect(result).toBe("$10.50");
    });

    it("should format string number as USD", () => {
      const result = formatCurrency("10.5");
      expect(result).toBe("$10.50");
    });

    it("should format integer as USD", () => {
      const result = formatCurrency(10);
      expect(result).toBe("$10.00");
    });

    it("should handle zero", () => {
      const result = formatCurrency(0);
      expect(result).toBe("$0.00");
    });

    it('should return "0.00" for invalid string input', () => {
      const result = formatCurrency("abc");
      expect(result).toBe("0.00");
    });

    it('should return "0.00" for NaN', () => {
      const result = formatCurrency(NaN);
      expect(result).toBe("0.00");
    });

    it("should format as EUR", () => {
      const result = formatCurrency(10.5, "EUR");
      expect(result).toBe("€10.50");
    });

    it("should format as GBP", () => {
      const result = formatCurrency(10.5, "GBP");
      expect(result).toBe("£10.50");
    });

    it("should convert € symbol to EUR", () => {
      const result = formatCurrency(10.5, "€");
      expect(result).toBe("€10.50");
    });

    it("should convert $ symbol to USD", () => {
      const result = formatCurrency(10.5, "$");
      expect(result).toBe("$10.50");
    });

    it("should convert £ symbol to GBP", () => {
      const result = formatCurrency(10.5, "£");
      expect(result).toBe("£10.50");
    });

    it("should handle large numbers", () => {
      const result = formatCurrency(1234567.89);
      expect(result).toBe("$1,234,567.89");
    });

    it("should handle negative numbers", () => {
      const result = formatCurrency(-10.5);
      expect(result).toBe("-$10.50");
    });

    it("should fallback gracefully for invalid currency code", () => {
      const result = formatCurrency(10.5, "INVALID");
      expect(result).toBe("INVALID 10.50");
    });
  });
});
