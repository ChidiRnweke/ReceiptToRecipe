import type { IImageGenerator, GeneratedImage } from './interfaces';
import { DEFAULT_IMAGE_MODEL, OPENROUTER_BASE_URL } from './recipes/imageGeneratorChoice';

/** The part of `fetch` the generator uses, so tests can hand it a fake. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface SmartImageGeneratorOptions {
	/**
	 * The resolution tier (`768`, `1K`, `1.5K`, `2K`, `4K`). FLUX refuses pixel sizes such as
	 * `1024x768`; `1K` at 4:3 gives 1184×880.
	 */
	size?: string;
	/** The recipe cards are 4:3. */
	aspectRatio?: string;
	/** Any OpenAI-compatible images API; OpenRouter by default. */
	baseUrl?: string;
	fetch?: FetchLike;
}

interface ImagesResponse {
	data?: { b64_json?: string; url?: string; media_type?: string }[];
	usage?: { cost?: number };
	error?: { message?: string };
}

/**
 * Generates images through an OpenAI-compatible images endpoint (`<base>/images/generations`),
 * OpenRouter's by default. Image-only models such as FLUX refuse chat completions; this endpoint
 * serves them and Gemini's image model. The answer may carry the image as `b64_json` or as a
 * `url`, which is downloaded, so the picture is always stored by the app.
 */
export class SmartImageGenerator implements IImageGenerator {
	private readonly size: string;
	private readonly aspectRatio: string;
	private readonly baseUrl: string;
	private readonly fetch: FetchLike;

	/** `apiKey` may be empty for a server that needs none, such as one on this machine. */
	constructor(
		private readonly apiKey: string,
		private readonly model: string = DEFAULT_IMAGE_MODEL,
		options: SmartImageGeneratorOptions = {}
	) {
		this.size = options.size ?? '1K';
		this.aspectRatio = options.aspectRatio ?? '4:3';
		this.baseUrl = (options.baseUrl ?? OPENROUTER_BASE_URL).replace(/\/+$/, '');
		this.fetch = options.fetch ?? ((url, init) => fetch(url, init));
	}

	async generateImage(prompt: string): Promise<GeneratedImage> {
		const response = await this.fetch(`${this.baseUrl}/images/generations`, {
			method: 'POST',
			headers: {
				...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
				'Content-Type': 'application/json',
				'X-Title': 'ReceiptToRecipe'
			},
			body: JSON.stringify({
				model: this.model,
				prompt,
				n: 1,
				size: this.size,
				aspect_ratio: this.aspectRatio
			})
		});
		const body = (await response.json().catch(() => ({}))) as ImagesResponse;
		if (!response.ok) {
			const reason = body.error?.message ?? response.statusText;
			throw new Error(`Failed to generate image with ${this.model}: ${response.status} ${reason}`);
		}

		const image = body.data?.[0];
		const url = image?.b64_json
			? `data:${image.media_type ?? 'image/png'};base64,${image.b64_json}`
			: image?.url
				? await this.download(image.url)
				: null;
		if (!url) throw new Error(`Failed to generate image with ${this.model}: no image in response`);
		return typeof body.usage?.cost === 'number' ? { url, cost: body.usage.cost } : { url };
	}

	/** The image at `url` as a data URL, so it is stored like a `b64_json` answer. */
	private async download(url: string): Promise<string> {
		if (url.startsWith('data:')) return url;
		const response = await this.fetch(url, { method: 'GET' });
		if (!response.ok) {
			throw new Error(`Failed to download the image from ${this.model}: ${response.status}`);
		}
		const type = response.headers.get('content-type')?.split(';')[0] || 'image/png';
		const bytes = Buffer.from(await response.arrayBuffer());
		return `data:${type};base64,${bytes.toString('base64')}`;
	}
}
