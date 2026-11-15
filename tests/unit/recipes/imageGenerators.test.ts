import { describe, expect, it } from 'vitest';
import { chooseImageGenerator } from '../../../src/lib/services/recipes/imageGeneratorChoice';
import {
	pictureRunNotice,
	readableDuration,
	spendEstimate
} from '../../../src/lib/services/recipes/pictureCosts';
import { seedOf } from '../../../src/lib/services/LocalFluxImageGenerator';

describe('chooseImageGenerator', () => {
	it('uses OpenRouter when there is a key and no setting', () => {
		expect(chooseImageGenerator({ setting: '', apiKey: 'k', production: true })).toBe('openrouter');
	});

	it('uses the seed photos without a key', () => {
		expect(chooseImageGenerator({ setting: undefined, apiKey: '', production: false })).toBe(
			'seed'
		);
	});

	it('uses the seed photos with IMAGE_GENERATOR=seed, even with a key', () => {
		expect(chooseImageGenerator({ setting: 'seed', apiKey: 'k', production: false })).toBe('seed');
	});

	it('runs FLUX locally with IMAGE_GENERATOR=local, even without a key', () => {
		expect(chooseImageGenerator({ setting: 'local', apiKey: '', production: false })).toBe('local');
	});

	it('refuses the local generator in production', () => {
		expect(() => chooseImageGenerator({ setting: 'local', apiKey: 'k', production: true })).toThrow(
			'not available in production'
		);
	});
});

describe('spendEstimate', () => {
	it('prices FLUX 3 Image Klein at the measured $0.009 a picture', () => {
		expect(spendEstimate('black-forest-labs/flux-3-image-klein', 1000)?.high).toBeCloseTo(9);
	});
});

describe('pictureRunNotice', () => {
	it('gives a local run’s duration at about 30 s a picture', () => {
		expect(pictureRunNotice('local', 120).message).toContain('about 1 h');
	});

	it('does not count a local run as spending money', () => {
		expect(pictureRunNotice('local', 120).costsMoney).toBe(false);
	});

	it('counts an OpenRouter run as spending money', () => {
		expect(pictureRunNotice('black-forest-labs/flux-3-image-klein', 3).costsMoney).toBe(true);
	});

	it('gives an OpenRouter run’s spend estimate', () => {
		expect(pictureRunNotice('black-forest-labs/flux-3-image-klein', 100).message).toContain(
			'about $0.90–$0.90'
		);
	});
});

describe('readableDuration', () => {
	it('gives seconds under a minute', () => {
		expect(readableDuration(45)).toBe('45 s');
	});

	it('gives minutes under an hour', () => {
		expect(readableDuration(90)).toBe('2 min');
	});

	it('gives hours and minutes', () => {
		expect(readableDuration(7500)).toBe('2 h 5 min');
	});

	it('leaves out zero minutes', () => {
		expect(readableDuration(3600)).toBe('1 h');
	});
});

describe('seedOf', () => {
	it('gives the same prompt the same seed', () => {
		expect(seedOf('a frittata')).toBe(seedOf('a frittata'));
	});

	it('gives different prompts different seeds', () => {
		expect(seedOf('a frittata')).not.toBe(seedOf('a risotto'));
	});
});
