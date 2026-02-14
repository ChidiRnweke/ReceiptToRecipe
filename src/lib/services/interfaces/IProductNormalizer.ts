export interface NormalizedProductInfo {
	category: string;
	productGroup: string;
	normalizedName: string;
}

export interface IProductNormalizer {
	normalizeProduct(rawName: string): Promise<NormalizedProductInfo>;
}
