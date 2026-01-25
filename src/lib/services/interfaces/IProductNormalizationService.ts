export interface NormalizedProductInfo {
  category: string;
  productGroup: string;
  normalizedName: string;
}

export interface IProductNormalizationService {
  normalizeProduct(rawName: string): Promise<NormalizedProductInfo>;
}
