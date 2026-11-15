import type { PictureSubject } from '$lib/models/recipes';

/**
 * The one house style for generated recipe pictures. It matches the app's paper look: an
 * overhead photo in soft daylight, on a ceramic plate over linen or a wooden board.
 */
export const HOUSE_PICTURE_STYLE = [
	'Overhead food photograph, shot from directly above.',
	'Soft natural daylight from a window, gentle shadows.',
	'The dish served on a matte ceramic plate or bowl, on cream linen or a light wooden board.',
	'Muted, warm colours. Simple, homely and appetising, as cooked in a home kitchen.',
	'No text, no labels, no watermarks, no hands, no people, no cutlery in the way.'
].join(' ');

/** The prompt that asks for a picture of one recipe in the house style. */
export function recipePicturePrompt(
	subject: Pick<PictureSubject, 'title' | 'description' | 'ingredients'>
): string {
	const parts = [`A finished plate of ${subject.title.trim()}.`];
	const description = subject.description?.trim();
	if (description) parts.push(description.endsWith('.') ? description : `${description}.`);
	const main = subject.ingredients.slice(0, 4).filter((name) => name.trim());
	if (main.length) parts.push(`You can see ${main.join(', ')}.`);
	parts.push(HOUSE_PICTURE_STYLE);
	return parts.join(' ');
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
