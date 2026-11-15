import { OpenRouter } from '@openrouter/sdk';
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
import { structureByRules } from './recipes/cookbookRules';

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
  "servings": integer,
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
		const minutes = typeof step.minutes === 'number' ? Math.round(step.minutes) : null;
		const verb = normalizeVerb(said);
		if (verb) return { verb, text, minutes };
		const own = splitVerb(said ? `${said} ${text}` : text);
		return { verb: own.verb, text: own.text || text, minutes };
	});
}

/** Structures a page with one model call through OpenRouter; the answer is checked by zod. */
export class OpenRouterCookbookStructurer implements ICookbookStructurer {
	readonly kind = 'model' as const;
	private client: OpenRouter;

	constructor(
		apiKey: string,
		private model: string
	) {
		this.client = new OpenRouter({ apiKey });
	}

	async structure(title: string, sections: WikibooksSections): Promise<CookbookStructure> {
		const completion = await this.client.chat.send({
			chatGenerationParams: {
				model: this.model,
				messages: [{ role: 'user', content: structurePrompt(title, sections) }],
				responseFormat: { type: 'json_object' },
				stream: false
			}
		});
		if (!completion || !('choices' in completion) || completion.choices.length === 0) {
			throw new Error('The model gave no answer');
		}
		const content = completion.choices[0].message.content;
		const text =
			typeof content === 'string'
				? content
				: Array.isArray(content)
					? content
							.filter((part) => part.type === 'text')
							.map((part) => part.text)
							.join('')
					: '';
		if (!text) throw new Error('The model gave an empty answer');
		const answer = JSON.parse(text) as Record<string, unknown>;
		// Tags outside the vocabulary are dropped, as for other model answers; the rest must fit.
		const tags = Array.isArray(answer.tags) ? answer.tags.filter(isRecipeTag) : [];
		return cookbookStructureSchema.parse({ ...answer, tags, steps: inVocabulary(answer.steps) });
	}
}
