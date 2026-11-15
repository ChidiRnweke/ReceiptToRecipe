import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	ChatCookbookStructurer,
	jsonObjectIn,
	type ChatFetch
} from '../../../src/lib/services/CookbookStructurers';
import { parseWikibooksRecipe } from '../../../src/lib/services/recipes/wikibooks';
import type { WikibooksSections } from '../../../src/lib/models/recipes';
import { cookbookStructure } from '../../fakes/cookbook';

interface SentRequest {
	url: string;
	headers: Record<string, string>;
	body: Record<string, unknown>;
}

/** A chat server that records each request and answers with the next of `answers`. */
function recordingServer(answers: { status: number; body: unknown }[]): {
	fetch: ChatFetch;
	sent: SentRequest[];
} {
	const sent: SentRequest[] = [];
	const fetch: ChatFetch = async (url, init) => {
		sent.push({
			url,
			headers: init.headers as Record<string, string>,
			body: JSON.parse(String(init.body))
		});
		const answer = answers[Math.min(sent.length, answers.length) - 1];
		return Response.json(answer.body, { status: answer.status });
	};
	return { fetch, sent };
}

function chat(content: string) {
	return { status: 200, body: { choices: [{ message: { content } }] } };
}

const RECIPE = JSON.stringify(cookbookStructure('Beef Stroganoff', ['beef', 'onion']));
const REFUSED = {
	status: 400,
	body: { error: "'response_format.type' must be 'json_schema' or 'text'" }
};

function sections(): WikibooksSections {
	const wikitext = readFileSync(
		join(__dirname, '../../fixtures/wikibooks/beef-stroganoff.wikitext'),
		'utf8'
	);
	const parsed = parseWikibooksRecipe(wikitext);
	if (!parsed.ok) throw new Error(parsed.reason);
	return parsed.sections;
}

function structurer(fetch: ChatFetch, apiKey = '') {
	return new ChatCookbookStructurer({
		baseUrl: 'http://localhost:1234/v1/',
		model: 'qwen3.8-27b-splash',
		apiKey,
		fetch
	});
}

describe('ChatCookbookStructurer', () => {
	describe('request', () => {
		it('posts to the chat completions endpoint of the base URL', async () => {
			const { fetch, sent } = recordingServer([chat(RECIPE)]);
			await structurer(fetch).structure('Beef Stroganoff', sections());
			expect(sent[0].url).toBe('http://localhost:1234/v1/chat/completions');
		});

		it('asks the configured model', async () => {
			const { fetch, sent } = recordingServer([chat(RECIPE)]);
			await structurer(fetch).structure('Beef Stroganoff', sections());
			expect(sent[0].body.model).toBe('qwen3.8-27b-splash');
		});

		it('asks for a JSON object', async () => {
			const { fetch, sent } = recordingServer([chat(RECIPE)]);
			await structurer(fetch).structure('Beef Stroganoff', sections());
			expect(sent[0].body.response_format).toEqual({ type: 'json_object' });
		});

		it('sends the reasoning effort it was given', async () => {
			const { fetch, sent } = recordingServer([chat(RECIPE)]);
			await new ChatCookbookStructurer({
				baseUrl: 'http://localhost:1234/v1',
				model: 'm',
				apiKey: '',
				reasoningEffort: 'none',
				fetch
			}).structure('Beef Stroganoff', sections());
			expect(sent[0].body.reasoning_effort).toBe('none');
		});

		it('sends no reasoning effort unless given one', async () => {
			const { fetch, sent } = recordingServer([chat(RECIPE)]);
			await structurer(fetch).structure('Beef Stroganoff', sections());
			expect(sent[0].body).not.toHaveProperty('reasoning_effort');
		});

		it('sends no Authorization header without a key', async () => {
			const { fetch, sent } = recordingServer([chat(RECIPE)]);
			await structurer(fetch).structure('Beef Stroganoff', sections());
			expect(sent[0].headers.Authorization).toBeUndefined();
		});

		it('authenticates with the key it was given', async () => {
			const { fetch, sent } = recordingServer([chat(RECIPE)]);
			await structurer(fetch, 'sk-test').structure('Beef Stroganoff', sections());
			expect(sent[0].headers.Authorization).toBe('Bearer sk-test');
		});
	});

	describe('a server that refuses the JSON setting', () => {
		it('asks again without it', async () => {
			const { fetch, sent } = recordingServer([REFUSED, chat(RECIPE)]);
			await structurer(fetch).structure('Beef Stroganoff', sections());
			expect(sent[1].body.response_format).toBeUndefined();
		});

		it('structures the page from the second answer', async () => {
			const { fetch } = recordingServer([REFUSED, chat(RECIPE)]);
			const recipe = await structurer(fetch).structure('Beef Stroganoff', sections());
			expect(recipe.title).toBe('Beef Stroganoff');
		});

		it('leaves the setting out of the next page’s request', async () => {
			const { fetch, sent } = recordingServer([REFUSED, chat(RECIPE)]);
			const pages = structurer(fetch);
			await pages.structure('Beef Stroganoff', sections());
			await pages.structure('Beef Stroganoff', sections());
			expect(sent).toHaveLength(3);
		});
	});

	describe('answer', () => {
		it('gives a page without servings the summary box’s, else 4', async () => {
			const answer = { ...JSON.parse(RECIPE), servings: null };
			const { fetch } = recordingServer([chat(JSON.stringify(answer))]);
			const recipe = await structurer(fetch).structure('Beef Stroganoff', {
				...sections(),
				servings: null
			});
			expect(recipe.servings).toBe(4);
		});

		it('drops a step time longer than a day instead of the page', async () => {
			const answer = JSON.parse(RECIPE);
			answer.steps[0].minutes = 4320;
			const { fetch } = recordingServer([chat(JSON.stringify(answer))]);
			const recipe = await structurer(fetch).structure('Beef Stroganoff', sections());
			expect(recipe.steps[0].minutes).toBeNull();
		});

		it('reads a recipe wrapped in a code fence', async () => {
			const { fetch } = recordingServer([chat('```json\n' + RECIPE + '\n```')]);
			const recipe = await structurer(fetch).structure('Beef Stroganoff', sections());
			expect(recipe.ingredients.map((ingredient) => ingredient.name)).toEqual(['beef', 'onion']);
		});

		it('fails when the answer does not fit the schema', async () => {
			const { fetch } = recordingServer([chat('{"title": "Beef Stroganoff"}')]);
			await expect(structurer(fetch).structure('Beef Stroganoff', sections())).rejects.toThrow();
		});

		it('fails with the server’s message when it refuses the request', async () => {
			const { fetch } = recordingServer([
				{ status: 500, body: { error: { message: 'no model' } } }
			]);
			await expect(structurer(fetch).structure('Beef Stroganoff', sections())).rejects.toThrow(
				'500: no model'
			);
		});
	});
});

describe('jsonObjectIn', () => {
	it('skips what a model thought aloud before the object', () => {
		expect(jsonObjectIn('<think>{maybe}</think>\n{"a": 1}')).toEqual({ a: 1 });
	});

	it('fails when there is no object', () => {
		expect(() => jsonObjectIn('I cannot help')).toThrow('no JSON object');
	});
});
