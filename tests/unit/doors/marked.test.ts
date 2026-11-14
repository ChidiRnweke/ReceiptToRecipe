import { describe, it, expect } from 'vitest';
import { splitMarked } from '../../../src/lib/services/doors/marked';

describe('splitMarked', () => {
	it('marks the starred word and keeps the text around it', () => {
		expect(splitMarked("What's for *dinner*?")).toEqual([
			{ text: "What's for ", marked: false },
			{ text: 'dinner', marked: true },
			{ text: '?', marked: false }
		]);
	});

	it('returns plain text as one unmarked part', () => {
		expect(splitMarked('Recipes')).toEqual([{ text: 'Recipes', marked: false }]);
	});

	it('marks a starred word at the end without an empty trailing part', () => {
		expect(splitMarked('What needs eating *first*')).toEqual([
			{ text: 'What needs eating ', marked: false },
			{ text: 'first', marked: true }
		]);
	});

	it('keeps a lone asterisk as text', () => {
		expect(splitMarked('5 * 3')).toEqual([{ text: '5 * 3', marked: false }]);
	});

	it('marks more than one starred word', () => {
		expect(splitMarked('*Shop* and *cook*').filter((part) => part.marked).length).toBe(2);
	});
});
