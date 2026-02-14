import type {
  IProductNormalizer,
  NormalizedProductInfo,
} from "../../src/lib/services/interfaces/IProductNormalizer";

/**
 * Mock implementation of IProductNormalizer for testing
 */
export class MockProductNormalizer implements IProductNormalizer {
  private mocks = new Map<string, NormalizedProductInfo>();
  private defaultInfo: NormalizedProductInfo = {
    normalizedName: "Unknown Product",
    productGroup: "Other",
    category: "other",
  };

  async normalizeProduct(rawName: string): Promise<NormalizedProductInfo> {
    return (
      this.mocks.get(rawName) || {
        ...this.defaultInfo,
        normalizedName: rawName,
      }
    );
  }

  // Test helpers
  setMock(rawName: string, info: NormalizedProductInfo): void {
    this.mocks.set(rawName, info);
  }

  setDefaultInfo(info: NormalizedProductInfo): void {
    this.defaultInfo = info;
  }

  clear(): void {
    this.mocks.clear();
  }
}
