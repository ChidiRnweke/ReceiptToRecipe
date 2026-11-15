import type { IImageGenerator, GeneratedImage } from './interfaces';
import { DEFAULT_IMAGE_MODEL } from './recipes/imageGeneratorChoice';

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
	baseUrl?: string;
	fetch?: FetchLike;
}

interface ImagesResponse {
	data?: { b64_json?: string; url?: string; media_type?: string }[];
	usage?: { cost?: number };
	error?: { message?: string };
}

/**
 * Generates images through OpenRouter's images endpoint (`/api/v1/images/generations`). Image-only
 * models such as FLUX refuse chat completions; this endpoint serves them and Gemini's image model.
 */
export class SmartImageGenerator implements IImageGenerator {
	private readonly size: string;
	private readonly aspectRatio: string;
	private readonly baseUrl: string;
	private readonly fetch: FetchLike;

	constructor(
		private readonly apiKey: string,
		private readonly model: string = DEFAULT_IMAGE_MODEL,
		options: SmartImageGeneratorOptions = {}
	) {
		this.size = options.size ?? '1K';
		this.aspectRatio = options.aspectRatio ?? '4:3';
		this.baseUrl = options.baseUrl ?? 'https://openrouter.ai/api/v1';
		this.fetch = options.fetch ?? ((url, init) => fetch(url, init));
	}

	async generateImage(prompt: string): Promise<GeneratedImage> {
		const response = await this.fetch(`${this.baseUrl}/images/generations`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
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
			: image?.url;
		if (!url) throw new Error(`Failed to generate image with ${this.model}: no image in response`);
		return typeof body.usage?.cost === 'number' ? { url, cost: body.usage.cost } : { url };
	}
}
