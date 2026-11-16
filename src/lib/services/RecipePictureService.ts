import {
	KEEP_PHOTO_SCORE,
	MIN_PHOTO_PIXELS,
	type PhotoBytes,
	type PhotoVerdict,
	type PictureCandidate,
	type CookbookPicturesSummary,
	type PictureSubject,
	type RecipePictureResult
} from '$lib/models/recipes';
import type {
	CookbookPictureDao,
	ICookbookRecipeRepository,
	IRecipeIngredientRepository,
	IRecipeRepository
} from '$repositories';
import type { IImageGenerator } from './interfaces/IImageGenerator';
import type { IJobQueue } from './interfaces/IJobQueue';
import type { IPhotoJudge } from './interfaces/IPhotoJudge';
import type { IPictureCaptioner } from './interfaces/IPictureCaptioner';
import type { IRecipePictureService } from './interfaces/IRecipePictureService';
import type { IStorageService } from './interfaces/IStorageService';
import { imageSize } from './recipes/imageSize';
import { HOUSE_PICTURE_STYLE_VERSION, recipePicturePrompt } from './recipes/pictureStyle';

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

/**
 * The seed for a catalog picture: none on the first try, so the generator picks; on a retry
 * (`pictureAttempt` 1, 2, …), one from the page id and the try, so each retry draws anew.
 */
function retry(pageId: number, attempt: number): Pick<PictureSubject, 'seed'> {
	return attempt > 0 ? { seed: pageId * 10 + attempt } : {};
}

export class RecipePictureService implements IRecipePictureService {
	constructor(
		private recipeRepository: IRecipeRepository,
		private recipeIngredientRepository: IRecipeIngredientRepository,
		private imageGenerator: IImageGenerator,
		private photoJudge: IPhotoJudge,
		private storageService: IStorageService,
		private jobQueue: IJobQueue,
		private cookbookRepository: ICookbookRecipeRepository,
		/** Writes the scene caption when a recipe has none; without one, the title stands alone. */
		private captioner: IPictureCaptioner | null = null
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
			await this.save(subject, { imageStatus: 'PROCESSING' });
			// A cookbook page's photo is never a candidate: catalog recipes always get a generated one.
			const keep = subject.target === 'cookbook' ? null : candidate;
			const picture =
				(keep && (await this.keptPhoto(subject, keep))) ??
				(await this.generated(await this.captioned(subject)));
			// A generated picture records the house style it was made in, so a newer style redoes it.
			const style =
				picture.imageSource === 'GENERATED' ? { pictureStyle: HOUSE_PICTURE_STYLE_VERSION } : {};
			await this.save(subject, { ...picture, ...style, imageStatus: 'DONE' });
			return picture;
		} catch (error) {
			await this.save(subject, { imageStatus: 'FAILED' });
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

	async fillCookbook(options: {
		limit: number;
		standIns: boolean;
		regenerate?: boolean;
		onPicture?: (title: string, outcome: string) => void;
	}): Promise<CookbookPicturesSummary> {
		const recipes = options.regenerate
			? await this.cookbookRepository.findWithOlderPicture(
					options.limit,
					HOUSE_PICTURE_STYLE_VERSION
				)
			: await this.cookbookRepository.findWithoutPicture(options.limit, options.standIns);
		const summary: CookbookPicturesSummary = { filled: 0, failed: 0, stopped: false };
		let failedInARow = 0;
		for (const recipe of recipes) {
			try {
				await this.ensure({
					id: recipe.id,
					title: recipe.recipe.title,
					description: recipe.recipe.description || null,
					ingredients: recipe.recipe.ingredients.map((ingredient) => ingredient.name),
					lastSteps: recipe.recipe.steps
						.slice(-2)
						.map((step) => (step.verb ? `${step.verb} ${step.text}` : step.text)),
					caption: recipe.recipe.pictureCaption ?? null,
					...retry(recipe.pageId, recipe.recipe.pictureAttempt ?? 0),
					target: 'cookbook'
				});
				summary.filled += 1;
				failedInARow = 0;
				options.onPicture?.(recipe.title, 'done');
			} catch (error) {
				summary.failed += 1;
				failedInARow += 1;
				options.onPicture?.(recipe.title, `failed: ${(error as Error).message}`);
				if (failedInARow >= FILL_MAX_FAILURES_IN_A_ROW) {
					summary.stopped = true;
					break;
				}
			}
		}
		return summary;
	}

	/** Writes the picture fields to the household recipe or the catalog recipe. */
	private async save(subject: PictureSubject, picture: CookbookPictureDao): Promise<void> {
		if (subject.target === 'cookbook') {
			await this.cookbookRepository.updatePicture(subject.id, picture);
		} else {
			// Household recipes keep no style version: they are never regenerated in bulk.
			const columns = { ...picture };
			delete columns.pictureStyle;
			await this.recipeRepository.update(subject.id, columns);
		}
	}

	/**
	 * The subject with its scene caption: the stored one, else one the captioner writes, kept on a
	 * catalog recipe. When no caption can be written the picture is made from the title alone.
	 */
	private async captioned(subject: PictureSubject): Promise<PictureSubject> {
		if (subject.caption?.trim() || !this.captioner) return subject;
		try {
			const caption = await this.captioner.caption(subject);
			if (subject.target === 'cookbook') {
				await this.cookbookRepository.updatePictureCaption(subject.id, caption);
			}
			return { ...subject, caption };
		} catch (error) {
			console.warn(`No caption for recipe ${subject.id}; using its title:`, error);
			return subject;
		}
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
		const prompt = recipePicturePrompt(subject);
		const image =
			subject.seed === undefined
				? await this.imageGenerator.generateImage(prompt)
				: await this.imageGenerator.generateImage(prompt, { seed: subject.seed });
		const bytes = fromDataUrl(image.url);
		const name = subject.target === 'cookbook' ? `cookbook-${subject.id}` : subject.id;
		const imageUrl = bytes ? await this.store(name, bytes) : image.url;
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
