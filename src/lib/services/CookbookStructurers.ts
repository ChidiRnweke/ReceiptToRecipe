import {
	cookbookStructureSchema,
	isRecipeTag,
	RECIPE_TAGS,
	TECHNIQUE_VERBS,
	type CookbookStructure,
	type WikibooksSections
} from '$lib/models/recipes';
import type { ICookbookStructurer } from './interfaces/ICookbook';
import { normalizeVerb, splitVerb } from './recipes/steps';
import { servingsIn, structureByRules } from './recipes/cookbookRules';

/** Structures a page by rules only; no model call. */
export class RulesCookbookStructurer implements ICookbookStructurer {
	readonly kind = 'rules' as const;

	async structure(title: string, sections: WikibooksSections): Promise<CookbookStructure> {
		return cookbookStructureSchema.parse(structureByRules(title, sections));
	}
}

/** The instructions for the model; the page's text follows them. */
export function structurePrompt(title: string, sections: WikibooksSections): string {
	return `You turn a recipe page from the Wikibooks Cookbook into JSON for a home-cooking app.
Keep the recipe as written: do not add ingredients or steps. Answer with one JSON object:
{
  "title": string (the dish, short, no "Cookbook:"),
  "description": string (one or two sentences about the dish, from the page),
  "servings": integer (4 when the page gives none),
  "prepTime": integer minutes or null,
  "cookTime": integer minutes or null,
  "cuisine": string or null (e.g. "Filipino"),
  "ingredients": [{ "name": string (the ingredient only, e.g. "onion"), "quantity": number (0 when the page gives none, e.g. salt to taste), "unit": string (g, kg, ml, l, tsp, tbsp, cup, oz, lb, clove, pinch, can… or "" for a count), "optional": boolean, "notes": string or null (preparation such as "chopped", or "to taste") }],
  "steps": [{ "verb": one of ${JSON.stringify(TECHNIQUE_VERBS)} when the step starts with that technique, otherwise null, "text": the step without that verb, "minutes": integer or null }],
  "tags": any of ${JSON.stringify(RECIPE_TAGS)} that are true of the recipe
}
Convert amounts like "½" to 0.5 and ranges like "6–8" to their middle.

Page: ${title}
Servings in the summary box: ${sections.servings ?? 'not given'}
Time in the summary box: ${sections.time ?? 'not given'}
Cuisine in the summary box: ${sections.cuisine ?? 'not given'}
Categories: ${sections.categories.join('; ') || 'none'}
Description: ${sections.description || 'none'}

Ingredients:
${sections.ingredients.map((line) => `- ${line}`).join('\n')}

Procedure:
${sections.procedure.map((line, index) => `${index + 1}. ${line}`).join('\n')}`;
}

/** The longest step time the schema takes, in minutes. */
const MAX_STEP_MINUTES = 1440;

interface LooseStep {
	verb?: unknown;
	text?: unknown;
	minutes?: unknown;
}

/** Keeps a model's verb only when it is in the vocabulary; another verb stays in the sentence. */
function inVocabulary(steps: unknown): unknown {
	if (!Array.isArray(steps)) return steps;
	return (steps as LooseStep[]).map((step) => {
		const text = typeof step.text === 'string' ? step.text : '';
		const said = typeof step.verb === 'string' ? step.verb : null;
		// A step time past a day (e.g. "leave for 3 days" in minutes) is dropped, not the page.
		const minutes =
			typeof step.minutes === 'number' && step.minutes >= 0 && step.minutes <= MAX_STEP_MINUTES
				? Math.round(step.minutes)
				: null;
		const verb = normalizeVerb(said);
		if (verb) return { verb, text, minutes };
		const own = splitVerb(said ? `${said} ${text}` : text);
		return { verb: own.verb, text: own.text || text, minutes };
	});
}

/** The part of `fetch` the structurer uses, so tests can hand it a recording fake. */
export type ChatFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface ChatCookbookStructurerOptions {
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

/**
 * The JSON object in a model's answer. Some servers do not take `response_format`, and some
 * models wrap the object in a code fence or think aloud before it.
 */
export function jsonObjectIn(text: string): Record<string, unknown> {
	const answer = text.replace(/<think>[\s\S]*?<\/think>/g, '');
	const start = answer.indexOf('{');
	const end = answer.lastIndexOf('}');
	if (start === -1 || end < start) throw new Error('The model gave no JSON object');
	return JSON.parse(answer.slice(start, end + 1)) as Record<string, unknown>;
}

/**
 * Structures a page with one call to an OpenAI-compatible chat completions endpoint; the answer
 * is checked by zod. It asks for a JSON object, and asks again without that setting when the
 * server refuses it (some local servers accept only `json_schema` or `text`).
 */
export class ChatCookbookStructurer implements ICookbookStructurer {
	readonly kind = 'model' as const;
	private readonly baseUrl: string;
	private readonly fetch: ChatFetch;
	private jsonMode = true;

	constructor(private options: ChatCookbookStructurerOptions) {
		this.baseUrl = options.baseUrl.replace(/\/+$/, '');
		this.fetch = options.fetch ?? ((url, init) => fetch(url, init));
	}

	async structure(title: string, sections: WikibooksSections): Promise<CookbookStructure> {
		const prompt = structurePrompt(title, sections);
		let response = await this.send(prompt);
		if (response.status === 400 && this.jsonMode) {
			this.jsonMode = false;
			response = await this.send(prompt);
		}
		const body = (await response.json().catch(() => ({}))) as ChatAnswer;
		if (!response.ok) {
			const reason = typeof body.error === 'string' ? body.error : body.error?.message;
			throw new Error(`The model answered ${response.status}: ${reason ?? response.statusText}`);
		}
		const text = textOf(body.choices?.[0]?.message?.content);
		if (!text) throw new Error('The model gave an empty answer');
		const answer = jsonObjectIn(text);
		// Tags outside the vocabulary are dropped, as for other model answers; the rest must fit.
		const tags = Array.isArray(answer.tags) ? answer.tags.filter(isRecipeTag) : [];
		// A page that states no servings gets the rules' answer, as a rules-structured page does.
		const servings =
			typeof answer.servings === 'number' && answer.servings >= 1
				? Math.round(answer.servings)
				: (servingsIn(sections.servings) ?? 4);
		return cookbookStructureSchema.parse({
			...answer,
			servings,
			tags,
			steps: inVocabulary(answer.steps)
		});
	}

	private send(prompt: string): Promise<Response> {
		return this.fetch(`${this.baseUrl}/chat/completions`, {
			method: 'POST',
			headers: {
				...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
				'Content-Type': 'application/json',
				'X-Title': 'ReceiptToRecipe cookbook importer'
			},
			body: JSON.stringify({
				model: this.options.model,
				messages: [{ role: 'user', content: prompt }],
				...(this.jsonMode ? { response_format: { type: 'json_object' } } : {}),
				...(this.options.reasoningEffort ? { reasoning_effort: this.options.reasoningEffort } : {}),
				stream: false
			})
		});
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
