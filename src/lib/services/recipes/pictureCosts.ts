/**
 * What one recipe picture costs with each image model of the picture bake-off, in USD, as
 * estimated from OpenRouter's prices before the bake-off ran. The bake-off records what OpenRouter
 * actually charged (`usage.cost`); update these once it has run with a working key.
 * Kept free of app imports, so the scripts can read it with plain Node.
 */
export interface PictureCostEstimate {
	/** The bake-off variant, e.g. `gpt-5-image-mini-low`. */
	variant: string;
	model: string;
	low: number;
	high: number;
}

export const PICTURE_COST_ESTIMATES: readonly PictureCostEstimate[] = [
	{ variant: 'gpt-5-image-mini-low', model: 'openai/gpt-5-image-mini', low: 0.002, high: 0.002 },
	{ variant: 'gpt-5-image-mini-medium', model: 'openai/gpt-5-image-mini', low: 0.009, high: 0.009 },
	{
		variant: 'gemini-3.1-flash-lite-image',
		model: 'google/gemini-3.1-flash-lite-image',
		low: 0.02,
		high: 0.04
	},
	{
		variant: 'gemini-2.5-flash-image',
		model: 'google/gemini-2.5-flash-image',
		low: 0.04,
		high: 0.04
	}
];

/** The cost range of `count` pictures with `model`, or null for a model not in the bake-off. */
export function spendEstimate(
	model: string,
	count: number
): { low: number; high: number; perPicture: { low: number; high: number } } | null {
	const rows = PICTURE_COST_ESTIMATES.filter((row) => row.model === model);
	if (rows.length === 0) return null;
	const low = Math.min(...rows.map((row) => row.low));
	const high = Math.max(...rows.map((row) => row.high));
	return { low: low * count, high: high * count, perPicture: { low, high } };
}
