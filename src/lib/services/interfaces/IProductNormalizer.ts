export interface NormalizedProductInfo {
	category: string;
	productGroup: string;
	normalizedName: string;
	isFoodItem: boolean;
}

export interface IProductNormalizer {
	normalizeProduct(rawName: string): Promise<NormalizedProductInfo>;
}
