import type { PictureSubject } from '$lib/models/recipes';

/**
 * The one house style for generated recipe pictures: the app's overhead framing on a ceramic
 * plate over linen or a wooden board, asked for as a real photograph so the model does not
 * render a smooth, too-clean dish.
 */
export const HOUSE_PICTURE_STYLE =
	'Overhead food photograph, shot from directly above. The dish served on a matte ceramic plate or bowl, on cream linen or a light wooden board. A real photograph, not a render or illustration: natural window light from one side with soft real shadows, true-to-life muted colours, visible natural texture and small imperfections, slight film grain, as cooked and served in a home kitchen. No text, no labels, no watermarks, no hands, no people, no cutlery.';

/**
 * The version of the house style and prompt. A catalog picture records the version it was made
 * with, so `cookbook:pictures --regenerate` redoes the older ones. Raise it when the prompt
 * changes enough that stored pictures should be made again.
 */
export const HOUSE_PICTURE_STYLE_VERSION = 2;

/**
 * How the captioner is told to describe a dish. A caption of the served dish keeps the image
 * model from drawing the raw ingredients a list of them invites.
 */
export const PICTURE_CAPTION_INSTRUCTIONS =
	'You write the caption for an overhead food photograph of a finished dish, as it is served and about to be eaten. Describe only what the camera sees of the food: portion, shape, surface, colour, crust, sauce, garnish, and the plate, bowl or glass it is in. Never show raw ingredients, packaging, utensils or cooking steps unless the dish is served that way. Do not list ingredients. No cutlery. A drink is served in a glass; a sauce, dip or spread in a small bowl or with what it is eaten with. Mention real, slightly imperfect texture where it fits (crumbs, browned edges, cracks, drips). 50 words at most, one paragraph, no preamble.';

/** The most description, ingredients and steps the captioner is shown. */
const CAPTION_DESCRIPTION_CHARS = 400;
const CAPTION_INGREDIENTS = 15;
const CAPTION_STEPS = 2;

/** What the captioner is shown of a dish, as the JSON the caption instructions expect. */
export function pictureCaptionInput(
	subject: Pick<PictureSubject, 'title' | 'description' | 'ingredients' | 'lastSteps'>
): string {
	return JSON.stringify({
		title: subject.title.trim(),
		description: (subject.description ?? '').trim().slice(0, CAPTION_DESCRIPTION_CHARS),
		ingredients: subject.ingredients.slice(0, CAPTION_INGREDIENTS),
		last_steps: (subject.lastSteps ?? []).slice(-CAPTION_STEPS)
	});
}

/** The last steps of a method written one step per line, for the captioner. */
export function lastStepsOf(instructions: string): string[] {
	return instructions
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(-CAPTION_STEPS);
}

/**
 * The prompt that asks for a picture of one recipe in the house style: the scene caption of the
 * served dish, or the title alone when there is none. Ingredients are never listed, or the
 * model draws them raw beside the dish.
 */
export function recipePicturePrompt(subject: Pick<PictureSubject, 'title' | 'caption'>): string {
	const caption = subject.caption?.trim();
	const scene = caption || `A finished, served plate of ${subject.title.trim()}.`;
	return `${scene} ${HOUSE_PICTURE_STYLE}`;
}

/** The question the photo judge answers about a candidate photo. */
export function photoJudgePrompt(subject: Pick<PictureSubject, 'title' | 'description'>): string {
	const dish = subject.description?.trim()
		? `${subject.title.trim()} (${subject.description.trim()})`
		: subject.title.trim();
	return [
		`Would this photo work as the picture of the recipe "${dish}" in a cookbook app?`,
		'Score it from 1 to 5:',
		'5 = an appetising, sharp, well-lit photo of this finished dish, ready to eat;',
		'4 = a good photo of this finished dish with small flaws;',
		'3 = recognisably this dish, but dull, messy, dark or badly framed;',
		'2 = a different dish, raw ingredients, packaging, or mostly people, hands or text;',
		'1 = not food, a screenshot, a page of text, or unusable.',
		'Answer with JSON only: {"score": <1-5>, "reason": "<one short sentence>"}.'
	].join('\n');
}
