/**
 * What one recipe picture costs with each image model of the picture bake-off, in USD. The FLUX
 * row is what OpenRouter charged (`usage.cost`) for a 1024×768 picture; the others were estimated
 * from OpenRouter's prices before the bake-off ran. The bake-off records what OpenRouter actually
 * charged; update a row when a run measures it.
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
	{
		variant: 'flux-3-image-klein',
		model: 'black-forest-labs/flux-3-image-klein',
		low: 0.009,
		high: 0.009
	},
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

/**
 * What a picture run prints before it starts: the cost of `count` pictures with `model` (`seed`
 * for the stand-in photos) through OpenRouter, or, for another server (`baseUrl`), that its price
 * is not known here. `costsMoney` says whether the run may spend money, so the script gives a
 * moment to stop it.
 */
export function pictureRunNotice(
	model: string,
	count: number,
	baseUrl: string | null = null
): { message: string; costsMoney: boolean } {
	if (model === 'seed') {
		return {
			message: `${count} picture(s) from the committed seed photos (stand-ins): $0.`,
			costsMoney: false
		};
	}
	if (baseUrl) {
		return {
			message: `${count} picture(s) with ${model} at ${baseUrl}: its price is not known here.`,
			costsMoney: true
		};
	}
	const estimate = spendEstimate(model, count);
	return {
		message: estimate
			? `${count} picture(s) with ${model}: about $${estimate.low.toFixed(2)}–$${estimate.high.toFixed(2)} ($${estimate.perPicture.low}–$${estimate.perPicture.high} each, bake-off estimate).`
			: `${count} picture(s) with ${model}: no estimate for this model; see scripts/picture-bakeoff.ts.`,
		costsMoney: true
	};
}
