import { describe, it, expect, beforeEach } from 'vitest';
import {
	MockJobQueue,
	MockRecipeIngredientRepository,
	MockRecipeRepository,
	MockStorageService
} from '../../mocks';
import { createPictures, FakePhotoJudge, pngOfSize } from '../../fakes/pictures';
import { InMemoryCookbookRecipeRepository } from '../../fakes/InMemoryCookbookRecipeRepository';
import type { PictureCandidate, PictureSubject } from '../../../src/lib/models/recipes';
import { SeedPictureGenerator } from '../../../src/lib/services/SeedPictureGenerator';
import { RecipePictureService } from '../../../src/lib/services/RecipePictureService';
import { cookbookRow, cookbookStructure } from '../../fakes/cookbook';
import { HOUSE_PICTURE_STYLE_VERSION } from '../../../src/lib/services/recipes/pictureStyle';

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('RecipePictureService', () => {
	let recipes: MockRecipeRepository;
	let ingredients: MockRecipeIngredientRepository;
	let pictures: ReturnType<typeof createPictures>;
	let subject: PictureSubject;

	const dishPhoto = (width = 1200, height = 900): PictureCandidate => ({
		photo: { data: pngOfSize(width, height), contentType: 'image/png' },
		source: 'SNAPPED'
	});

	async function addRecipe(title: string, imageUrl: string | null = null) {
		return recipes.create({
			userId: 'user-1',
			householdId: 'household-1',
			title,
			instructions: 'Cook it.',
			imageUrl
		});
	}

	beforeEach(async () => {
		recipes = new MockRecipeRepository();
		ingredients = new MockRecipeIngredientRepository();
		pictures = createPictures(recipes, ingredients);
		const recipe = await addRecipe('Spinach & feta frittata');
		subject = {
			id: recipe.id,
			title: recipe.title,
			description: 'Eggs and potato under the grill',
			ingredients: ['eggs', 'potato', 'spinach', 'feta']
		};
	});

	describe('judging a photo', () => {
		it('keeps a photo the judge scores 4', async () => {
			pictures.judge.answer = { score: 4, reason: 'Good, slightly dark.' };

			const verdict = await pictures.service.judgePhoto(dishPhoto().photo, subject);

			expect(verdict.keep).toBe(true);
		});

		it('does not keep a photo the judge scores 3', async () => {
			pictures.judge.answer = { score: 3, reason: 'Dull.' };

			const verdict = await pictures.service.judgePhoto(dishPhoto().photo, subject);

			expect(verdict.keep).toBe(false);
		});

		it('does not keep a photo under 800 px', async () => {
			const verdict = await pictures.service.judgePhoto(dishPhoto(640, 480).photo, subject);

			expect(verdict.keep).toBe(false);
		});

		it('does not ask the judge about a photo under 800 px', async () => {
			await pictures.service.judgePhoto(dishPhoto(640, 480).photo, subject);

			expect(pictures.judge.asked).toHaveLength(0);
		});

		it('keeps a tall photo that is 800 px on its longer side', async () => {
			const verdict = await pictures.service.judgePhoto(dishPhoto(600, 800).photo, subject);

			expect(verdict.keep).toBe(true);
		});

		it('does not keep bytes that are not an image', async () => {
			const verdict = await pictures.service.judgePhoto(
				{ data: new Uint8Array([1, 2, 3]), contentType: 'image/png' },
				subject
			);

			expect(verdict.keep).toBe(false);
		});
	});

	describe('ensuring a picture', () => {
		it('keeps a good photo of the dish', async () => {
			const picture = await pictures.service.ensure(subject, dishPhoto());

			expect(picture.imageSource).toBe('SNAPPED');
		});

		it('stores a kept photo that is not stored yet', async () => {
			const picture = await pictures.service.ensure(subject, dishPhoto());

			expect(pictures.storage.getStored(picture.imageUrl.replace('mock://', ''))?.length).toBe(
				pngOfSize(1200, 900).length
			);
		});

		it('keeps the stored address of a photo that is already stored', async () => {
			const picture = await pictures.service.ensure(subject, {
				...dishPhoto(),
				url: '/uploads/recipes/snap.jpg'
			});

			expect(picture.imageUrl).toBe('/uploads/recipes/snap.jpg');
		});

		it('generates a picture for a poor photo', async () => {
			pictures.judge.answer = { score: 2, reason: 'Mostly the packaging.' };

			const picture = await pictures.service.ensure(subject, dishPhoto());

			expect(picture.imageSource).toBe('GENERATED');
		});

		it('generates a picture when there is no photo', async () => {
			const picture = await pictures.service.ensure(subject);

			expect(picture.imageSource).toBe('GENERATED');
		});

		it('asks for the picture in the house style', async () => {
			await pictures.service.ensure(subject);

			expect(pictures.generator.prompts[0]).toContain('Overhead');
		});

		it('names the dish in the prompt', async () => {
			await pictures.service.ensure(subject);

			expect(pictures.generator.prompts[0]).toContain('Spinach & feta frittata');
		});

		it('draws the picture from the stored caption', async () => {
			await pictures.service.ensure({ ...subject, caption: 'A puffed golden frittata.' });

			expect(pictures.generator.prompts[0]).toMatch(/^A puffed golden frittata\. /);
		});

		it('does not ask for a caption when one is stored', async () => {
			await pictures.service.ensure({ ...subject, caption: 'A puffed golden frittata.' });

			expect(pictures.captioner.asked).toHaveLength(0);
		});

		it('asks the captioner for a caption when none is stored', async () => {
			await pictures.service.ensure(subject);

			expect(pictures.captioner.asked.map((dish) => dish.title)).toEqual([
				'Spinach & feta frittata'
			]);
		});

		it('draws the picture from the written caption', async () => {
			await pictures.service.ensure(subject);

			expect(pictures.generator.prompts[0]).toContain(
				'A served plate of Spinach & feta frittata, browned at the edges.'
			);
		});

		it('does not list the ingredients in the prompt', async () => {
			await pictures.service.ensure(subject);

			expect(pictures.generator.prompts[0]).not.toContain('potato');
		});

		it('still makes a picture when the captioner fails', async () => {
			pictures.captioner.failWith = new Error('402 No credit');

			const picture = await pictures.service.ensure(subject);

			expect(picture.imageSource).toBe('GENERATED');
		});

		it('stores a generated picture instead of keeping its data URL', async () => {
			const picture = await pictures.service.ensure(subject);

			expect(picture.imageUrl.startsWith('data:')).toBe(false);
		});

		it('saves the picture on the recipe', async () => {
			const picture = await pictures.service.ensure(subject);

			expect((await recipes.findById(subject.id))?.imageUrl).toBe(picture.imageUrl);
		});

		it('marks the picture done', async () => {
			await pictures.service.ensure(subject);

			expect((await recipes.findById(subject.id))?.imageStatus).toBe('DONE');
		});

		it('generated pictures carry no credit', async () => {
			await pictures.service.ensure(subject);

			expect((await recipes.findById(subject.id))?.imageCredit).toBeNull();
		});

		it('keeps the credit of a stand-in seed photo', async () => {
			const credit = {
				author: 'Jane Cook',
				licence: 'CC BY-SA 4.0',
				licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
				sourceUrl: 'https://commons.wikimedia.org/wiki/File:Frittata.jpg'
			};
			const service = new RecipePictureService(
				recipes,
				ingredients,
				new SeedPictureGenerator({
					'spinach-feta-frittata': {
						...credit,
						dish: 'Spinach & feta frittata',
						file: 'spinach-feta-frittata.webp',
						title: 'File:Frittata.jpg'
					}
				}),
				new FakePhotoJudge(),
				new MockStorageService(),
				new MockJobQueue(),
				new InMemoryCookbookRecipeRepository()
			);

			await service.ensure(subject);

			expect((await recipes.findById(subject.id))?.imageCredit).toEqual(credit);
		});

		it('marks the picture failed when generation fails', async () => {
			pictures.generator.failWith = new Error('401 Missing Authentication header');

			await pictures.service.ensure(subject).catch(() => undefined);

			expect((await recipes.findById(subject.id))?.imageStatus).toBe('FAILED');
		});

		it('passes the failure on', async () => {
			pictures.generator.failWith = new Error('401 Missing Authentication header');

			await expect(pictures.service.ensure(subject)).rejects.toThrow('401');
		});

		it('gives a queued recipe its picture once the job runs', async () => {
			pictures.service.queue(subject);
			await settled();

			expect((await recipes.findById(subject.id))?.imageSource).toBe('GENERATED');
		});
	});

	describe('filling missing pictures after start', () => {
		it('gives a picture to a recipe without one', async () => {
			await pictures.service.fillMissing();

			expect((await recipes.findById(subject.id))?.imageUrl).not.toBeNull();
		});

		it('skips a recipe that already has a picture', async () => {
			const pictured = await addRecipe('Shakshuka', '/seed/recipes/shakshuka.webp');

			await pictures.service.fillMissing();

			expect((await recipes.findById(pictured.id))?.imageUrl).toBe('/seed/recipes/shakshuka.webp');
		});

		it('asks for one picture per recipe without one', async () => {
			await addRecipe('Shakshuka', '/seed/recipes/shakshuka.webp');
			await addRecipe('Bean chili');

			await pictures.service.fillMissing();

			expect(pictures.generator.prompts).toHaveLength(2);
		});

		it('shows the captioner the ingredients of each recipe', async () => {
			await ingredients.createMany([
				{
					recipeId: subject.id,
					name: 'eggs',
					quantity: '6',
					unit: '',
					unitType: 'COUNT',
					orderIndex: 0
				}
			]);

			await pictures.service.fillMissing();

			expect(pictures.captioner.asked[0].ingredients).toEqual(['eggs']);
		});

		it('stops after three failures in a row', async () => {
			for (const title of ['Bean chili', 'Dal', 'Minestrone', 'Ratatouille'])
				await addRecipe(title);
			pictures.generator.failWith = new Error('401');

			await pictures.service.fillMissing();

			expect(pictures.generator.prompts).toHaveLength(3);
		});
	});

	describe('pictures for the shared cookbook', () => {
		async function addCatalogRecipe(title: string) {
			return pictures.cookbook.upsert(cookbookRow(cookbookStructure(title, ['red lentil'])));
		}

		it('generates a picture for a catalog recipe without one', async () => {
			const dal = await addCatalogRecipe('Red lentil dal');
			await pictures.service.fillCookbook({ limit: 10, standIns: false });
			expect((await pictures.cookbook.findById(dal.id))?.imageSource).toBe('GENERATED');
		});

		it('never keeps a photo for a catalog recipe', async () => {
			const dal = await addCatalogRecipe('Red lentil dal');
			const picture = await pictures.service.ensure(
				{
					id: dal.id,
					title: 'Red lentil dal',
					description: null,
					ingredients: [],
					target: 'cookbook'
				},
				dishPhoto()
			);
			expect(picture.imageSource).toBe('GENERATED');
		});

		it('leaves the household recipes alone', async () => {
			await addCatalogRecipe('Red lentil dal');
			await pictures.service.fillCookbook({ limit: 10, standIns: false });
			expect((await recipes.findById(subject.id))?.imageUrl).toBeNull();
		});

		it('skips a catalog recipe that has a picture, so a second run continues', async () => {
			await addCatalogRecipe('Red lentil dal');
			await pictures.service.fillCookbook({ limit: 10, standIns: false });
			expect((await pictures.service.fillCookbook({ limit: 10, standIns: false })).filled).toBe(0);
		});

		it('replaces a seed stand-in when asked to', async () => {
			const dal = await addCatalogRecipe('Red lentil dal');
			await pictures.cookbook.updatePicture(dal.id, {
				imageUrl: '/seed/recipes/dal.webp',
				imageSource: 'COMMONS'
			});
			await pictures.service.fillCookbook({ limit: 10, standIns: true });
			expect((await pictures.cookbook.findById(dal.id))?.imageSource).toBe('GENERATED');
		});

		it('stops after 3 failures in a row', async () => {
			for (const title of ['A', 'B', 'C', 'D']) await addCatalogRecipe(title);
			pictures.generator.failWith = new Error('401');
			expect((await pictures.service.fillCookbook({ limit: 10, standIns: false })).failed).toBe(3);
		});

		it('keeps the written caption on the catalog recipe', async () => {
			const dal = await addCatalogRecipe('Red lentil dal');
			await pictures.service.fillCookbook({ limit: 10, standIns: false });
			expect((await pictures.cookbook.findById(dal.id))?.recipe.pictureCaption).toBe(
				'A served plate of Red lentil dal, browned at the edges.'
			);
		});

		it('draws a catalog picture from its stored caption', async () => {
			const dal = await addCatalogRecipe('Red lentil dal');
			await pictures.cookbook.updatePictureCaption(dal.id, 'A bowl of golden dal.');
			await pictures.service.fillCookbook({ limit: 10, standIns: false });
			expect(pictures.generator.prompts[0]).toMatch(/^A bowl of golden dal\. /);
		});

		it('records the house style of a generated picture', async () => {
			const dal = await addCatalogRecipe('Red lentil dal');
			await pictures.service.fillCookbook({ limit: 10, standIns: false });
			expect((await pictures.cookbook.findById(dal.id))?.recipe.pictureStyle).toBe(
				HOUSE_PICTURE_STYLE_VERSION
			);
		});
	});

	describe('regenerating the shared cookbook pictures', () => {
		async function addPictured(title: string, pictureStyle?: number) {
			const row = await pictures.cookbook.upsert(
				cookbookRow(cookbookStructure(title, ['red lentil']))
			);
			await pictures.cookbook.updatePicture(row.id, {
				imageUrl: `mock://recipes/${row.id}-old.png`,
				imageSource: 'GENERATED',
				...(pictureStyle === undefined ? {} : { pictureStyle })
			});
			return row;
		}

		const regenerate = () =>
			pictures.service.fillCookbook({ limit: 10, standIns: false, regenerate: true });

		it('makes again a picture of an older style', async () => {
			const dal = await addPictured('Red lentil dal');
			await regenerate();
			expect((await pictures.cookbook.findById(dal.id))?.imageUrl).not.toBe(
				`mock://recipes/${dal.id}-old.png`
			);
		});

		it('leaves a picture of the current style alone', async () => {
			await addPictured('Red lentil dal', HOUSE_PICTURE_STYLE_VERSION);
			expect((await regenerate()).filled).toBe(0);
		});

		it('only redoes the older pictures', async () => {
			await addPictured('Red lentil dal', HOUSE_PICTURE_STYLE_VERSION);
			await addPictured('Bean chili');
			await addPictured('Minestrone', 1);
			expect((await regenerate()).filled).toBe(2);
		});

		it('continues where a stopped run ended', async () => {
			await addPictured('Red lentil dal');
			await addPictured('Bean chili');
			await pictures.service.fillCookbook({ limit: 1, standIns: false, regenerate: true });
			expect((await regenerate()).filled).toBe(1);
		});

		it('draws a first try without a seed', async () => {
			await addPictured('Red lentil dal');
			await regenerate();
			expect(pictures.generator.seeds).toEqual([undefined]);
		});

		it('draws a retry with a seed from the page and the try', async () => {
			const dal = await addPictured('Red lentil dal');
			await pictures.cookbook.upsert({
				...cookbookRow({ ...dal.recipe, pictureAttempt: 2 }, dal.pageId)
			});
			await regenerate();
			expect(pictures.generator.seeds).toEqual([dal.pageId * 10 + 2]);
		});
	});
});
