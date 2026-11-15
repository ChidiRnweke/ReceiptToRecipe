import type { ImageCredit } from '$lib/models/recipes';

/** One committed seed picture, as listed in `static/seed/recipes/credits.json`. */
export interface SeedPicture extends ImageCredit {
	dish: string;
	file: string;
	/** The Commons file title, e.g. `File:Shakshuka.jpg`. */
	title: string;
}

export type SeedPictureCatalog = Record<string, SeedPicture>;

/** Where the seed pictures are served from. */
export const SEED_PICTURE_PATH = '/seed/recipes';

const IGNORED = new Set(['and', 'with', 'the', 'for', 'plate', 'finished']);

function words(text: string): string[] {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.split(/[^a-z]+/)
		.filter((word) => word.length > 2 && !IGNORED.has(word))
		.map((word) => word.replace(/(es|s)$/, ''));
}

function hash(text: string): number {
	return [...text].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
}

/**
 * The seed picture that best fits a dish: the one whose dish name shares the most words with
 * the text, e.g. "Spinach & feta frittata" for "A finished plate of feta frittata". Without a
 * shared word, the text picks one at random but always the same one.
 */
export function pickSeedPicture(catalog: SeedPictureCatalog, text: string): SeedPicture {
	const entries = Object.values(catalog);
	if (entries.length === 0) throw new Error('There are no seed pictures');
	const wanted = new Set(words(text));
	let best: SeedPicture | null = null;
	let bestScore = 0;
	for (const entry of entries) {
		const score = words(entry.dish).filter((word) => wanted.has(word)).length;
		if (score > bestScore) {
			best = entry;
			bestScore = score;
		}
	}
	return best ?? entries[hash(text) % entries.length];
}

/** The credit to show for a seed picture. */
export function seedPictureCredit(picture: SeedPicture): ImageCredit {
	return {
		author: picture.author,
		licence: picture.licence,
		licenceUrl: picture.licenceUrl,
		sourceUrl: picture.sourceUrl
	};
}
