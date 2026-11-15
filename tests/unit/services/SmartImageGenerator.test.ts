import { describe, expect, it } from 'vitest';
import { SmartImageGenerator, type FetchLike } from '../../../src/lib/services/SmartImageGenerator';

interface SentRequest {
	url: string;
	headers: Record<string, string>;
	body: Record<string, unknown>;
}

/** A fetch that records what it was sent and answers with `status` and `body`. */
function fakeFetch(status: number, body: unknown): { fetch: FetchLike; sent: SentRequest[] } {
	const sent: SentRequest[] = [];
	const fetch: FetchLike = async (url, init) => {
		sent.push({
			url,
			headers: init.headers as Record<string, string>,
			body: JSON.parse(String(init.body))
		});
		return new Response(JSON.stringify(body), {
			status,
			headers: { 'Content-Type': 'application/json' }
		});
	};
	return { fetch, sent };
}

/** A server that answers the images endpoint with a `url` and serves the picture at that URL. */
function urlServer(): { fetch: FetchLike; fetched: string[] } {
	const fetched: string[] = [];
	const fetch: FetchLike = async (url) => {
		fetched.push(url);
		if (url.endsWith('/images/generations')) {
			return Response.json({ data: [{ url: 'http://localhost:8189/files/1.webp' }] });
		}
		return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/webp' } });
	};
	return { fetch, fetched };
}

const PICTURE = {
	data: [{ b64_json: 'iVBORw0KGgo=', media_type: 'image/png' }],
	usage: { cost: 0.009 }
};

describe('SmartImageGenerator', () => {
	describe('request', () => {
		it('posts to OpenRouter’s images endpoint', async () => {
			const { fetch, sent } = fakeFetch(200, PICTURE);
			await new SmartImageGenerator('key', 'black-forest-labs/flux-3-image-klein', {
				fetch
			}).generateImage('a frittata');
			expect(sent[0].url).toBe('https://openrouter.ai/api/v1/images/generations');
		});

		it('asks for one 1K picture at 4:3 of the prompt with the configured model', async () => {
			const { fetch, sent } = fakeFetch(200, PICTURE);
			await new SmartImageGenerator('key', 'black-forest-labs/flux-3-image-klein', {
				fetch
			}).generateImage('a frittata');
			expect(sent[0].body).toEqual({
				model: 'black-forest-labs/flux-3-image-klein',
				prompt: 'a frittata',
				n: 1,
				size: '1K',
				aspect_ratio: '4:3'
			});
		});

		it('sends the size it was given', async () => {
			const { fetch, sent } = fakeFetch(200, PICTURE);
			await new SmartImageGenerator('key', 'm', { fetch, size: '2K' }).generateImage('soup');
			expect(sent[0].body.size).toBe('2K');
		});

		it('authenticates with the API key', async () => {
			const { fetch, sent } = fakeFetch(200, PICTURE);
			await new SmartImageGenerator('sk-test', 'm', { fetch }).generateImage('soup');
			expect(sent[0].headers.Authorization).toBe('Bearer sk-test');
		});

		it('posts to the images endpoint of the base URL it was given', async () => {
			const { fetch, sent } = fakeFetch(200, PICTURE);
			await new SmartImageGenerator('', 'm', {
				fetch,
				baseUrl: 'http://localhost:8189/v1/'
			}).generateImage('soup');
			expect(sent[0].url).toBe('http://localhost:8189/v1/images/generations');
		});

		it('sends no Authorization header without an API key', async () => {
			const { fetch, sent } = fakeFetch(200, PICTURE);
			await new SmartImageGenerator('', 'm', { fetch }).generateImage('soup');
			expect(sent[0].headers.Authorization).toBeUndefined();
		});

		it('uses FLUX 3 Image Klein when no model is given', async () => {
			const { fetch, sent } = fakeFetch(200, PICTURE);
			await new SmartImageGenerator('key', undefined, { fetch }).generateImage('soup');
			expect(sent[0].body.model).toBe('black-forest-labs/flux-3-image-klein');
		});
	});

	describe('answer', () => {
		it('turns the base64 picture into a data URL of its media type', async () => {
			const { fetch } = fakeFetch(200, {
				data: [{ b64_json: 'AAAA', media_type: 'image/jpeg' }]
			});
			const image = await new SmartImageGenerator('key', 'm', { fetch }).generateImage('soup');
			expect(image.url).toBe('data:image/jpeg;base64,AAAA');
		});

		it('downloads a picture the server answers with as a URL', async () => {
			const { fetch } = urlServer();
			const image = await new SmartImageGenerator('', 'm', { fetch }).generateImage('soup');
			expect(image.url).toBe('data:image/webp;base64,AQID');
		});

		it('reports what OpenRouter charged', async () => {
			const { fetch } = fakeFetch(200, PICTURE);
			const image = await new SmartImageGenerator('key', 'm', { fetch }).generateImage('soup');
			expect(image.cost).toBe(0.009);
		});

		it('fails with OpenRouter’s error message when the request is refused', async () => {
			const { fetch } = fakeFetch(400, {
				error: { message: 'm is not a valid model ID' }
			});
			await expect(
				new SmartImageGenerator('key', 'm', { fetch }).generateImage('soup')
			).rejects.toThrow('400 m is not a valid model ID');
		});

		it('fails when the answer holds no picture', async () => {
			const { fetch } = fakeFetch(200, { data: [] });
			await expect(
				new SmartImageGenerator('key', 'm', { fetch }).generateImage('soup')
			).rejects.toThrow('no image in response');
		});
	});
});
