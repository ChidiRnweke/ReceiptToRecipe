import { OpenAIProvider } from '@openai/agents';
import OpenAI from 'openai';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Basil's models on OpenRouter: the OpenAI client pointed at OpenRouter's OpenAI-compatible API,
 * with chat-completions function calling, since OpenRouter has no Responses API for every model.
 */
export function openRouterModelProvider(
	apiKey: string,
	options: { baseURL?: string; appURL?: string } = {}
): OpenAIProvider {
	const client = new OpenAI({
		apiKey,
		baseURL: options.baseURL ?? OPENROUTER_BASE_URL,
		defaultHeaders: {
			'HTTP-Referer': options.appURL ?? 'http://localhost:5173',
			'X-OpenRouter-Title': 'Receipt2Recipe'
		}
	});
	return new OpenAIProvider({ openAIClient: client, useResponses: false });
}
