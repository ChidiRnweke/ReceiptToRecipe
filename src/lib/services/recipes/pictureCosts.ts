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

/** About how long the local FLUX worker takes per 1024×768 picture on an M5 Pro, in seconds. */
export const LOCAL_SECONDS_PER_PICTURE = 30;

/** A duration as people read it: `45 s`, `12 min`, `2 h 5 min`. */
export function readableDuration(seconds: number): string {
	if (seconds < 60) return `${Math.round(seconds)} s`;
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes} min`;
	const rest = minutes % 60;
	return `${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ''}`;
}

/**
 * What a picture run prints before it starts: the cost of `count` pictures with `model` (`seed`
 * for the stand-in photos, `local` for FLUX on this machine), or how long the local run takes.
 * `costsMoney` says whether the run spends money, so the script gives a moment to stop it.
 */
export function pictureRunNotice(
	model: string,
	count: number
): { message: string; costsMoney: boolean } {
	if (model === 'seed') {
		return {
			message: `${count} picture(s) from the committed seed photos (stand-ins): $0.`,
			costsMoney: false
		};
	}
	if (model === 'local') {
		return {
			message: `${count} picture(s) with FLUX on this machine: $0, about ${readableDuration(count * LOCAL_SECONDS_PER_PICTURE)} (~${LOCAL_SECONDS_PER_PICTURE} s each, plus loading the model).`,
			costsMoney: false
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
