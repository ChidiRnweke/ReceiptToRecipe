import {
	KEEP_PHOTO_SCORE,
	MIN_PHOTO_PIXELS,
	type PhotoBytes,
	type PhotoVerdict,
	type PictureCandidate,
	type PictureSubject,
	type RecipePictureResult
} from '$lib/models/recipes';
import type { IRecipeIngredientRepository, IRecipeRepository } from '$repositories';
import type { IImageGenerator } from './interfaces/IImageGenerator';
import type { IJobQueue } from './interfaces/IJobQueue';
import type { IPhotoJudge } from './interfaces/IPhotoJudge';
import type { IRecipePictureService } from './interfaces/IRecipePictureService';
import type { IStorageService } from './interfaces/IStorageService';
import { imageSize } from './recipes/imageSize';
import { recipePicturePrompt } from './recipes/pictureStyle';

/** The folder recipe pictures are stored in. */
const PICTURE_FOLDER = 'recipes';

/** How many recipes one startup fill looks at. */
const FILL_LIMIT = 500;

/** The startup fill stops after this many failures in a row: the generator is likely down. */
const FILL_MAX_FAILURES_IN_A_ROW = 3;

const EXTENSIONS: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

/** The bytes in a `data:<type>;base64,<data>` URL, or null for any other URL. */
function fromDataUrl(url: string): PhotoBytes | null {
	const match = /^data:([^;,]+);base64,(.*)$/s.exec(url);
	if (!match) return null;
	return { contentType: match[1], data: Buffer.from(match[2], 'base64') };
}

export class RecipePictureService implements IRecipePictureService {
	constructor(
		private recipeRepository: IRecipeRepository,
		private recipeIngredientRepository: IRecipeIngredientRepository,
		private imageGenerator: IImageGenerator,
		private photoJudge: IPhotoJudge,
		private storageService: IStorageService,
		private jobQueue: IJobQueue
	) {}

	async judgePhoto(
		photo: PhotoBytes,
		dish: Pick<PictureSubject, 'title' | 'description'>
	): Promise<PhotoVerdict> {
		const size = imageSize(photo.data);
		if (!size) {
			return {
				keep: false,
				score: null,
				width: null,
				height: null,
				reason: 'Not a JPEG, PNG or WebP image.'
			};
		}
		if (Math.max(size.width, size.height) < MIN_PHOTO_PIXELS) {
			return {
				keep: false,
				score: null,
				...size,
				reason: `Smaller than ${MIN_PHOTO_PIXELS} px.`
			};
		}
		const { score, reason } = await this.photoJudge.score(photo, dish);
		return { keep: score >= KEEP_PHOTO_SCORE, score, ...size, reason };
	}

	async ensure(
		subject: PictureSubject,
		candidate: PictureCandidate | null = null
	): Promise<RecipePictureResult> {
		try {
			await this.recipeRepository.update(subject.id, { imageStatus: 'PROCESSING' });
			const picture =
				(candidate && (await this.keptPhoto(subject, candidate))) ??
				(await this.generated(subject));
			await this.recipeRepository.update(subject.id, { ...picture, imageStatus: 'DONE' });
			return picture;
		} catch (error) {
			await this.recipeRepository.update(subject.id, { imageStatus: 'FAILED' });
			throw error;
		}
	}

	queue(subject: PictureSubject, candidate: PictureCandidate | null = null): void {
		this.jobQueue
			.add({
				name: `recipe-picture:${subject.id}`,
				run: async () => {
					await this.ensure(subject, candidate);
				}
			})
			.catch((error: unknown) => {
				console.error(`The picture for recipe ${subject.id} failed:`, error);
			});
	}

	async fillMissing(limit = FILL_LIMIT): Promise<{ filled: number; failed: number }> {
		const recipes = await this.recipeRepository.findWithoutPicture(limit);
		let filled = 0;
		let failed = 0;
		let failedInARow = 0;
		for (const recipe of recipes) {
			const ingredients = await this.recipeIngredientRepository.findByRecipeId(recipe.id);
			try {
				await this.ensure({ ...recipe, ingredients: ingredients.map((row) => row.name) });
				filled += 1;
				failedInARow = 0;
			} catch (error) {
				console.error(`The picture for recipe ${recipe.id} failed:`, error);
				failed += 1;
				failedInARow += 1;
				if (failedInARow >= FILL_MAX_FAILURES_IN_A_ROW) break;
			}
		}
		return { filled, failed };
	}

	/** The candidate as the recipe's picture, stored, or null when the judge does not keep it. */
	private async keptPhoto(
		subject: PictureSubject,
		candidate: PictureCandidate
	): Promise<RecipePictureResult | null> {
		const verdict = await this.judgePhoto(candidate.photo, subject);
		if (!verdict.keep) return null;
		const imageUrl = candidate.url ?? (await this.store(subject.id, candidate.photo));
		return { imageUrl, imageSource: candidate.source, imageCredit: null };
	}

	private async generated(subject: PictureSubject): Promise<RecipePictureResult> {
		const image = await this.imageGenerator.generateImage(recipePicturePrompt(subject));
		const bytes = fromDataUrl(image.url);
		const imageUrl = bytes ? await this.store(subject.id, bytes) : image.url;
		// A stand-in generator may answer with someone else's photo; it then comes with its credit.
		return image.credit
			? { imageUrl, imageSource: 'COMMONS', imageCredit: image.credit }
			: { imageUrl, imageSource: 'GENERATED', imageCredit: null };
	}

	private async store(recipeId: string, photo: PhotoBytes): Promise<string> {
		const extension = EXTENSIONS[photo.contentType] ?? 'png';
		const upload = await this.storageService.upload(
			photo.data,
			`${recipeId}.${extension}`,
			photo.contentType,
			PICTURE_FOLDER
		);
		return upload.url;
	}
}
