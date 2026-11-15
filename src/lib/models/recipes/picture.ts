/**
 * Recipe pictures: where a recipe's picture came from, whom to credit, and the rules for
 * keeping a photo instead of generating one.
 */

/** Where a recipe's picture came from. */
export const RECIPE_IMAGE_SOURCES = ['GENERATED', 'COMMONS', 'USER', 'SNAPPED'] as const;
export type RecipeImageSource = (typeof RECIPE_IMAGE_SOURCES)[number];

/**
 * Attribution for a photo that someone else took. Today only the committed seed photos from
 * Wikimedia Commons carry one; they stand in until the house style pictures are generated.
 */
export interface ImageCredit {
	author: string;
	/** Short licence name, e.g. `CC BY-SA 4.0` or `Public domain`. */
	licence: string;
	licenceUrl: string | null;
	/** The page the photo came from. */
	sourceUrl: string;
}

/** The bytes of a photo, as read from storage or downloaded. */
export interface PhotoBytes {
	data: Uint8Array;
	contentType: string;
}

/**
 * A member's own photo of the dish (from Snap) that may become the recipe's picture if it is
 * good enough. Photos from elsewhere, such as cookbook imports, are not candidates: those
 * recipes always get a generated picture.
 */
export interface PictureCandidate {
	photo: PhotoBytes;
	source: Extract<RecipeImageSource, 'SNAPPED' | 'USER'>;
	/** Where the photo is already stored. Without one, a kept photo is stored first. */
	url?: string;
}

/** The dish a picture is for. */
export interface PictureSubject {
	id: string;
	title: string;
	description: string | null;
	/** The main ingredients, most important first. */
	ingredients: string[];
}

/** A photo smaller than this, in pixels on its longer side, is never kept. */
export const MIN_PHOTO_PIXELS = 800;

/** A photo scored at least this (1–5) as an appetising picture of the finished dish is kept. */
export const KEEP_PHOTO_SCORE = 4;

export interface PhotoVerdict {
	keep: boolean;
	/** 1–5, or null when the photo was too small to be worth asking about. */
	score: number | null;
	width: number | null;
	height: number | null;
	reason: string;
}

/** The picture a recipe ended up with. */
export interface RecipePictureResult {
	imageUrl: string;
	imageSource: RecipeImageSource;
	imageCredit: ImageCredit | null;
}
