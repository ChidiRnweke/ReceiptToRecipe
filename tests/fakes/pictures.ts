import type { PhotoBytes, PictureSubject } from '../../src/lib/models/recipes';
import type { IPhotoJudge, PhotoScore } from '../../src/lib/services/interfaces/IPhotoJudge';
import type {
	IRecipeIngredientRepository,
	IRecipeRepository
} from '../../src/lib/repositories/interfaces/IRecipeRepositories';
import { RecipePictureService } from '../../src/lib/services/RecipePictureService';
import { MockImageGenerator, MockJobQueue, MockStorageService } from '../mocks';
import { InMemoryCookbookRecipeRepository } from './InMemoryCookbookRecipeRepository';

/** Scores every photo the same, as a vision model that likes or dislikes what it sees. */
export class FakePhotoJudge implements IPhotoJudge {
	readonly asked: { photo: PhotoBytes; dish: Pick<PictureSubject, 'title' | 'description'> }[] = [];

	constructor(
		public answer: PhotoScore = { score: 5, reason: 'An appetising photo of the dish.' }
	) {}

	async score(
		photo: PhotoBytes,
		dish: Pick<PictureSubject, 'title' | 'description'>
	): Promise<PhotoScore> {
		this.asked.push({ photo, dish });
		return this.answer;
	}
}

/** The header of a PNG of the given size; enough for the size check. */
export function pngOfSize(width: number, height: number): Uint8Array {
	const bytes = new Uint8Array(33);
	bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
	new DataView(bytes.buffer).setUint32(16, width);
	new DataView(bytes.buffer).setUint32(20, height);
	return bytes;
}

/**
 * The real picture service over fakes. The job queue runs jobs at once unless `runJobs` is
 * false, so a test sees the picture as soon as the operation returns.
 */
export function createPictures(
	recipes: IRecipeRepository,
	ingredients: IRecipeIngredientRepository,
	options: { runJobs?: boolean; cookbook?: InMemoryCookbookRecipeRepository } = {}
) {
	const generator = new MockImageGenerator();
	const judge = new FakePhotoJudge();
	const storage = new MockStorageService();
	const jobs = new MockJobQueue(options.runJobs ?? true);
	const cookbook = options.cookbook ?? new InMemoryCookbookRecipeRepository();
	const service = new RecipePictureService(
		recipes,
		ingredients,
		generator,
		judge,
		storage,
		jobs,
		cookbook
	);
	return { service, generator, judge, storage, jobs, cookbook };
}
