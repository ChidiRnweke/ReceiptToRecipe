import { describe, it, expect } from 'vitest';
import { imageSize } from '../../../src/lib/services/recipes/imageSize';
import {
	pickSeedPicture,
	type SeedPictureCatalog
} from '../../../src/lib/services/recipes/seedPictures';
import { recipePicturePrompt } from '../../../src/lib/services/recipes/pictureStyle';
import { pngOfSize } from '../../fakes/pictures';

/** A baseline JPEG header: SOI, an APP0 segment, then SOF0 with height and width. */
function jpegOfSize(width: number, height: number): Uint8Array {
	return new Uint8Array([
		0xff,
		0xd8,
		0xff,
		0xe0,
		0x00,
		0x04,
		0x00,
		0x00,
		0xff,
		0xc0,
		0x00,
		0x11,
		0x08,
		height >> 8,
		height & 0xff,
		width >> 8,
		width & 0xff,
		0x03,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0
	]);
}

/** An extended WebP header (VP8X), which stores width − 1 and height − 1 in 24 bits. */
function webpOfSize(width: number, height: number): Uint8Array {
	const bytes = new Uint8Array(30);
	bytes.set(
		[...'RIFF'].map((c) => c.charCodeAt(0)),
		0
	);
	bytes.set(
		[...'WEBPVP8X'].map((c) => c.charCodeAt(0)),
		8
	);
	const w = width - 1;
	const h = height - 1;
	bytes.set(
		[w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff],
		24
	);
	return bytes;
}

describe('imageSize', () => {
	it('reads the size of a PNG', () => {
		expect(imageSize(pngOfSize(1200, 900))).toEqual({ width: 1200, height: 900 });
	});

	it('reads the size of a JPEG', () => {
		expect(imageSize(jpegOfSize(1024, 768))).toEqual({ width: 1024, height: 768 });
	});

	it('reads the size of a WebP', () => {
		expect(imageSize(webpOfSize(800, 600))).toEqual({ width: 800, height: 600 });
	});

	it('knows no size for bytes that are not an image', () => {
		expect(imageSize(new Uint8Array([1, 2, 3, 4]))).toBeNull();
	});
});

const credit = { author: 'A', licence: 'CC0', licenceUrl: null, sourceUrl: 'https://x' };
const catalog: SeedPictureCatalog = {
	shakshuka: { ...credit, dish: 'Shakshuka', file: 'shakshuka.webp', title: 'File:S.jpg' },
	'spinach-feta-frittata': {
		...credit,
		dish: 'Spinach & feta frittata',
		file: 'spinach-feta-frittata.webp',
		title: 'File:F.jpg'
	},
	'bean-chili': { ...credit, dish: 'Bean chili', file: 'bean-chili.webp', title: 'File:B.jpg' }
};

describe('pickSeedPicture', () => {
	it('picks the dish that shares a word with the prompt', () => {
		expect(pickSeedPicture(catalog, 'A finished plate of feta frittata.').file).toBe(
			'spinach-feta-frittata.webp'
		);
	});

	it('matches plurals to the dish name', () => {
		expect(pickSeedPicture(catalog, 'Three-bean chilis for the freezer').file).toBe(
			'bean-chili.webp'
		);
	});

	it('picks the same photo every time for a dish it does not know', () => {
		const first = pickSeedPicture(catalog, 'Lemon tart');

		expect(pickSeedPicture(catalog, 'Lemon tart')).toBe(first);
	});
});

describe('recipePicturePrompt', () => {
	it('leaves out hands and text', () => {
		expect(recipePicturePrompt({ title: 'Dal', description: null, ingredients: [] })).toMatch(
			/no hands/i
		);
	});
});
