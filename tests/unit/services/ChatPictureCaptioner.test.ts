import { describe, expect, it } from 'vitest';
import { ChatPictureCaptioner } from '../../../src/lib/services/ChatPictureCaptioner';
import type { ChatFetch } from '../../../src/lib/services/CookbookStructurers';
import { PICTURE_CAPTION_INSTRUCTIONS } from '../../../src/lib/services/recipes/pictureStyle';

interface SentRequest {
	url: string;
	headers: Record<string, string>;
	body: {
		model: string;
		messages: { role: string; content: string }[];
		reasoning_effort?: string;
	};
}

/** A chat server that records each request and gives the same answer every time. */
function recordingServer(answer: { status: number; body: unknown }): {
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
		return Response.json(answer.body, { status: answer.status });
	};
	return { fetch, sent };
}

const CAPTION =
	'A golden banana loaf, sliced, with a cracked, browned top and crumbs on the board.';
const ANSWER = { status: 200, body: { choices: [{ message: { content: ` ${CAPTION}\n` } }] } };

const CAKE = {
	title: 'Banana Cake',
	description: 'A moist cake for overripe bananas.',
	ingredients: Array.from({ length: 20 }, (_, i) => `ingredient ${i + 1}`),
	lastSteps: ['Mix.', 'Pour into the tin.', 'Bake for 40 minutes and cool on a rack.']
};

function captioner(fetch: ChatFetch, options: { apiKey?: string; reasoningEffort?: string } = {}) {
	return new ChatPictureCaptioner({
		baseUrl: 'https://openrouter.ai/api/v1/',
		model: 'google/gemini-3.1-flash-lite',
		apiKey: options.apiKey ?? '',
		reasoningEffort: options.reasoningEffort,
		fetch
	});
}

describe('ChatPictureCaptioner', () => {
	describe('request', () => {
		it('posts to the chat completions endpoint of the base URL', async () => {
			const { fetch, sent } = recordingServer(ANSWER);
			await captioner(fetch).caption(CAKE);
			expect(sent[0].url).toBe('https://openrouter.ai/api/v1/chat/completions');
		});

		it('asks the configured model', async () => {
			const { fetch, sent } = recordingServer(ANSWER);
			await captioner(fetch).caption(CAKE);
			expect(sent[0].body.model).toBe('google/gemini-3.1-flash-lite');
		});

		it('sends the caption instructions as the system message', async () => {
			const { fetch, sent } = recordingServer(ANSWER);
			await captioner(fetch).caption(CAKE);
			expect(sent[0].body.messages[0]).toEqual({
				role: 'system',
				content: PICTURE_CAPTION_INSTRUCTIONS
			});
		});

		it('sends the dish with at most 15 ingredients and the last 2 steps', async () => {
			const { fetch, sent } = recordingServer(ANSWER);
			await captioner(fetch).caption(CAKE);
			expect(JSON.parse(sent[0].body.messages[1].content)).toEqual({
				title: 'Banana Cake',
				description: 'A moist cake for overripe bananas.',
				ingredients: CAKE.ingredients.slice(0, 15),
				last_steps: ['Pour into the tin.', 'Bake for 40 minutes and cool on a rack.']
			});
		});

		it('cuts a long description to 400 characters', async () => {
			const { fetch, sent } = recordingServer(ANSWER);
			await captioner(fetch).caption({ ...CAKE, description: 'x'.repeat(900) });
			expect(JSON.parse(sent[0].body.messages[1].content).description).toHaveLength(400);
		});

		it('sends the key as a bearer token', async () => {
			const { fetch, sent } = recordingServer(ANSWER);
			await captioner(fetch, { apiKey: 'sk-or-test' }).caption(CAKE);
			expect(sent[0].headers.Authorization).toBe('Bearer sk-or-test');
		});

		it('sends no key to a server that needs none', async () => {
			const { fetch, sent } = recordingServer(ANSWER);
			await captioner(fetch).caption(CAKE);
			expect(sent[0].headers.Authorization).toBeUndefined();
		});

		it('passes the reasoning effort when set', async () => {
			const { fetch, sent } = recordingServer(ANSWER);
			await captioner(fetch, { reasoningEffort: 'none' }).caption(CAKE);
			expect(sent[0].body.reasoning_effort).toBe('none');
		});
	});

	describe('answer', () => {
		it('returns the caption without surrounding space', async () => {
			const { fetch } = recordingServer(ANSWER);
			expect(await captioner(fetch).caption(CAKE)).toBe(CAPTION);
		});

		it('drops a thinking block before the caption', async () => {
			const { fetch } = recordingServer({
				status: 200,
				body: { choices: [{ message: { content: `<think>cake?</think>${CAPTION}` } }] }
			});
			expect(await captioner(fetch).caption(CAKE)).toBe(CAPTION);
		});

		it('fails on an empty answer', async () => {
			const { fetch } = recordingServer({ status: 200, body: { choices: [] } });
			await expect(captioner(fetch).caption(CAKE)).rejects.toThrow('empty');
		});

		it('fails with the server status on an error', async () => {
			const { fetch } = recordingServer({ status: 402, body: { error: { message: 'No credit' } } });
			await expect(captioner(fetch).caption(CAKE)).rejects.toThrow('402: No credit');
		});
	});
});
