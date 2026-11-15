import type {
	PhotoBytes,
	PhotoVerdict,
	PictureCandidate,
	PictureSubject,
	RecipePictureResult
} from '$lib/models/recipes';

/** Gives every recipe a picture: a good photo when there is one, otherwise a generated one. */
export interface IRecipePictureService {
	/**
	 * Whether a photo is good enough to be a dish's picture: at least `MIN_PHOTO_PIXELS` on its
	 * longer side, and scored `KEEP_PHOTO_SCORE` or more by the photo judge.
	 */
	judgePhoto(
		photo: PhotoBytes,
		dish: Pick<PictureSubject, 'title' | 'description'>
	): Promise<PhotoVerdict>;
	/**
	 * Gives the recipe its picture and stores it: the candidate photo when the judge keeps it,
	 * otherwise a picture generated in the house style. A failure marks the picture FAILED and
	 * is rethrown.
	 */
	ensure(
		subject: PictureSubject,
		candidate?: PictureCandidate | null
	): Promise<RecipePictureResult>;
	/** Runs `ensure` on the job queue. A failure is logged, and the picture is marked FAILED. */
	queue(subject: PictureSubject, candidate?: PictureCandidate | null): void;
	/**
	 * Gives a picture to recipes that have none, one at a time, oldest first. Returns how many
	 * got one. A recipe that fails is skipped.
	 */
	fillMissing(limit?: number): Promise<{ filled: number; failed: number }>;
}
