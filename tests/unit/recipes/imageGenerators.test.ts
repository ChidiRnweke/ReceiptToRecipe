import { describe, expect, it } from 'vitest';
import { chooseImageGenerator } from '../../../src/lib/services/recipes/imageGeneratorChoice';
import { pictureRunNotice, spendEstimate } from '../../../src/lib/services/recipes/pictureCosts';

describe('chooseImageGenerator', () => {
	it('uses OpenRouter when there is a key and no setting', () => {
		expect(chooseImageGenerator({ setting: '', apiKey: 'k' })).toBe('openrouter');
	});

	it('uses the seed photos without a key', () => {
		expect(chooseImageGenerator({ setting: undefined, apiKey: '' })).toBe('seed');
	});

	it('uses the seed photos with IMAGE_GENERATOR=seed, even with a key', () => {
		expect(chooseImageGenerator({ setting: 'seed', apiKey: 'k' })).toBe('seed');
	});
});

describe('spendEstimate', () => {
	it('prices FLUX 3 Image Klein at the measured $0.009 a picture', () => {
		expect(spendEstimate('black-forest-labs/flux-3-image-klein', 1000)?.high).toBeCloseTo(9);
	});
});

describe('pictureRunNotice', () => {
	it('does not count a seed-photo run as spending money', () => {
		expect(pictureRunNotice('seed', 3).costsMoney).toBe(false);
	});

	it('counts an OpenRouter run as spending money', () => {
		expect(pictureRunNotice('black-forest-labs/flux-3-image-klein', 3).costsMoney).toBe(true);
	});

	it('gives an OpenRouter run’s spend estimate', () => {
		expect(pictureRunNotice('black-forest-labs/flux-3-image-klein', 100).message).toContain(
			'about $0.90–$0.90'
		);
	});

	it('names another server instead of guessing its price', () => {
		expect(
			pictureRunNotice('flux-3-image-klein', 100, 'http://localhost:8189/v1').message
		).toContain('at http://localhost:8189/v1');
	});
});
