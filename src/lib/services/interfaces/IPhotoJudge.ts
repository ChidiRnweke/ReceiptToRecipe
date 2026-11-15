import type { PhotoBytes, PictureSubject } from '$lib/models/recipes';

/** How a vision model scored a photo as the picture of a dish. */
export interface PhotoScore {
	/** 1–5: 5 is an appetising photo of the finished dish. */
	score: number;
	reason: string;
}

/** Looks at a photo and says how well it shows a dish. */
export interface IPhotoJudge {
	score(
		photo: PhotoBytes,
		dish: Pick<PictureSubject, 'title' | 'description'>
	): Promise<PhotoScore>;
}
