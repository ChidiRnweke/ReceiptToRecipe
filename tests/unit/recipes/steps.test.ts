import { describe, it, expect } from 'vitest';
import {
	formatInstructions,
	parseInstructions,
	stepsFromGenerated,
	verbFor
} from '../../../src/lib/services/recipes';

describe('parseInstructions', () => {
	it('makes one step per non-empty line', () => {
		const steps = parseInstructions('Chop the onion\n\nBoil the pasta\r\nServe');

		expect(steps.map((step) => step.position)).toEqual([0, 1, 2]);
	});

	it('strips a "Step 2:" prefix', () => {
		const [step] = parseInstructions('Step 2: Crack in the eggs.');

		expect(step.text).toBe('Crack in the eggs.');
	});

	it('strips a numbered "3." prefix', () => {
		const [step] = parseInstructions('3. Serve warm.');

		expect(step.text).toBe('Serve warm.');
	});

	it('keeps a number that is part of the step', () => {
		const [step] = parseInstructions('10 minutes before serving, warm the plates.');

		expect(step.text).toBe('10 minutes before serving, warm the plates.');
	});

	it('takes a vocabulary verb off the front as the verb', () => {
		const [step] = parseInstructions('Step 1: Sweat the onion, 5 min.');

		expect([step.verb, step.text]).toEqual(['Sweat', 'the onion, 5 min.']);
	});

	it('reads the verb whatever its case and punctuation', () => {
		const [step] = parseInstructions('SIMMER, covered, 10 min');

		expect(step.verb).toBe('Simmer');
	});

	it('reads "saute" without the accent as Sauté', () => {
		const [step] = parseInstructions('Saute the mushrooms.');

		expect(step.verb).toBe('Sauté');
	});

	it('leaves the verb empty when the first word is not in the vocabulary', () => {
		const [step] = parseInstructions('Whisk the eggs with the milk.');

		expect([step.verb, step.text]).toEqual([null, 'Whisk the eggs with the milk.']);
	});

	it('returns no steps for empty instructions', () => {
		expect(parseInstructions('  \n ')).toEqual([]);
	});
});

describe('verbFor', () => {
	it('names the vocabulary verb a step starts with', () => {
		expect(verbFor('Roast the squash at 220 °C.')).toBe('Roast');
	});

	it('ignores a step prefix', () => {
		expect(verbFor('Step 4: Rest the chicken.')).toBe('Rest');
	});

	it('is null for a verb outside the vocabulary', () => {
		expect(verbFor('Grate the cheese.')).toBeNull();
	});

	it('is null for a vocabulary word later in the sentence', () => {
		expect(verbFor('Let it simmer.')).toBeNull();
	});
});

describe('formatInstructions', () => {
	it('writes one line per step with the verb first', () => {
		const text = formatInstructions([
			{ position: 0, verb: 'Sweat', text: 'the onion.' },
			{ position: 1, verb: null, text: 'Crack in the eggs.' }
		]);

		expect(text).toBe('Sweat the onion.\nCrack in the eggs.');
	});

	it('orders the lines by position', () => {
		const text = formatInstructions([
			{ position: 1, verb: null, text: 'second' },
			{ position: 0, verb: null, text: 'first' }
		]);

		expect(text).toBe('first\nsecond');
	});

	it('round-trips through parseInstructions', () => {
		const steps = parseInstructions('Step 1: Bloom the cumin in oil.\nStep 2: Add the lentils.');

		expect(parseInstructions(formatInstructions(steps))).toEqual(steps);
	});
});

describe('stepsFromGenerated', () => {
	it('drops a verb outside the vocabulary into the sentence', () => {
		const [step] = stepsFromGenerated({
			instructions: '',
			steps: [{ verb: 'Whisk', text: 'the eggs.', minutes: null }]
		});

		expect([step.verb, step.text]).toEqual([null, 'Whisk the eggs.']);
	});

	it('removes a verb the model repeated at the start of the text', () => {
		const [step] = stepsFromGenerated({
			instructions: '',
			steps: [{ verb: 'Sear', text: 'Sear the tofu until crisp.', minutes: 8 }]
		});

		expect(step.text).toBe('the tofu until crisp.');
	});

	it('keeps the minutes of a step', () => {
		const [step] = stepsFromGenerated({
			instructions: '',
			steps: [{ verb: 'Simmer', text: 'the lentils.', minutes: 20 }]
		});

		expect(step.minutes).toBe(20);
	});

	it('parses the instructions when there are no steps', () => {
		const steps = stepsFromGenerated({ instructions: 'Step 1: Boil the rice.\nStep 2: Serve.' });

		expect(steps.map((step) => step.verb)).toEqual(['Boil', null]);
	});
});
