import type { PictureSubject } from '$lib/models/recipes';
import type { ChatFetch } from './CookbookStructurers';
import type { IPictureCaptioner } from './interfaces/IPictureCaptioner';
import { PICTURE_CAPTION_INSTRUCTIONS, pictureCaptionInput } from './recipes/pictureStyle';

export interface ChatPictureCaptionerOptions {
	/** Any OpenAI-compatible API, e.g. OpenRouter's or a server on this machine. */
	baseUrl: string;
	model: string;
	/** Empty for a server that needs no key. */
	apiKey: string;
	/** Sent as `reasoning_effort` when set, e.g. `none` to stop a thinking model from thinking. */
	reasoningEffort?: string | null;
	fetch?: ChatFetch;
}

interface ChatAnswer {
	choices?: { message?: { content?: unknown } }[];
	error?: { message?: string } | string;
}

/** Writes a picture caption with one call to an OpenAI-compatible chat completions endpoint. */
export class ChatPictureCaptioner implements IPictureCaptioner {
	private readonly baseUrl: string;
	private readonly fetch: ChatFetch;

	constructor(private options: ChatPictureCaptionerOptions) {
		this.baseUrl = options.baseUrl.replace(/\/+$/, '');
		this.fetch = options.fetch ?? ((url, init) => fetch(url, init));
	}

	async caption(
		dish: Pick<PictureSubject, 'title' | 'description' | 'ingredients' | 'lastSteps'>
	): Promise<string> {
		const response = await this.fetch(`${this.baseUrl}/chat/completions`, {
			method: 'POST',
			headers: {
				...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
				'Content-Type': 'application/json',
				'X-Title': 'ReceiptToRecipe picture captions'
			},
			body: JSON.stringify({
				model: this.options.model,
				messages: [
					{ role: 'system', content: PICTURE_CAPTION_INSTRUCTIONS },
					{ role: 'user', content: pictureCaptionInput(dish) }
				],
				...(this.options.reasoningEffort ? { reasoning_effort: this.options.reasoningEffort } : {}),
				stream: false
			})
		});
		const body = (await response.json().catch(() => ({}))) as ChatAnswer;
		if (!response.ok) {
			const reason = typeof body.error === 'string' ? body.error : body.error?.message;
			throw new Error(
				`The caption model answered ${response.status}: ${reason ?? response.statusText}`
			);
		}
		const caption = textOf(body.choices?.[0]?.message?.content)
			.replace(/<think>[\s\S]*?<\/think>/g, '')
			.trim();
		if (!caption) throw new Error('The caption model gave an empty answer');
		return caption;
	}
}

/** A message's text, whether the server sends a string or a list of parts. */
function textOf(content: unknown): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.filter((part): part is { type: 'text'; text: string } => part?.type === 'text')
		.map((part) => part.text)
		.join('');
}
