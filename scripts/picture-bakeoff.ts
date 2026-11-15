/**
 * Picture bake-off: generates the same dishes in the house style with several image models
 * through OpenRouter, so we can choose the model for recipe pictures by looking at them.
 *
 *   npm run pictures:bakeoff [-- --dishes 3] [-- --only gemini-2.5-flash-image]
 *
 * Needs OPENROUTER_API_KEY. Writes artifacts/bakeoff/<variant>/<dish>.<ext>, plus
 * artifacts/bakeoff/index.html (a grid of dishes × variants with the cost OpenRouter reported)
 * and artifacts/bakeoff/results.json. Pictures that already exist are not generated again.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { recipePicturePrompt } from '../src/lib/services/recipes/pictureStyle.ts';
import { PICTURE_COST_ESTIMATES } from '../src/lib/services/recipes/pictureCosts.ts';

interface Variant {
	/** Folder name and column heading. */
	id: string;
	model: string;
	/** Extra request fields for this variant, e.g. an image quality. */
	extra?: Record<string, unknown>;
}

interface Dish {
	slug: string;
	title: string;
	description: string;
	ingredients: string[];
}

interface Result {
	variant: string;
	model: string;
	dish: string;
	file: string | null;
	/** USD, as OpenRouter reports it in `usage.cost`. */
	cost: number | null;
	seconds: number;
	error: string | null;
}

const VARIANTS: Variant[] = [
	// OpenAI image models take a quality. OpenRouter passes `image_config` through to the
	// provider; check the generated files if the two qualities look identical.
	{
		id: 'gpt-5-image-mini-low',
		model: 'openai/gpt-5-image-mini',
		extra: { image_config: { quality: 'low' } }
	},
	{
		id: 'gpt-5-image-mini-medium',
		model: 'openai/gpt-5-image-mini',
		extra: { image_config: { quality: 'medium' } }
	},
	{
		id: 'gemini-3.1-flash-lite-image',
		model: 'google/gemini-3.1-flash-lite-image',
		extra: { image_config: { aspect_ratio: '4:3' } }
	},
	{
		id: 'gemini-2.5-flash-image',
		model: 'google/gemini-2.5-flash-image',
		extra: { image_config: { aspect_ratio: '4:3' } }
	}
];

const DISHES: Dish[] = [
	{
		slug: 'spinach-feta-frittata',
		title: 'Spinach & feta frittata',
		description: 'Eggs, potato and spinach, finished under the grill',
		ingredients: ['eggs', 'potato', 'spinach', 'feta']
	},
	{
		slug: 'shakshuka',
		title: 'Shakshuka',
		description: 'Eggs poached in a pepper and tomato sauce',
		ingredients: ['eggs', 'tomatoes', 'peppers', 'feta']
	},
	{
		slug: 'spinach-chickpea-curry',
		title: 'Spinach & chickpea curry',
		description: 'Coconut curry with rice',
		ingredients: ['chickpeas', 'spinach', 'coconut milk', 'rice']
	},
	{
		slug: 'mushroom-risotto',
		title: 'Mushroom risotto',
		description: 'Creamy rice with golden mushrooms and parmesan',
		ingredients: ['rice', 'mushrooms', 'parmesan']
	},
	{
		slug: 'chicken-tacos',
		title: 'Chicken tacos',
		description: 'Seared chicken, peppers, coriander and lime',
		ingredients: ['tortillas', 'chicken thighs', 'peppers', 'coriander']
	},
	{
		slug: 'veg-lentil-soup',
		title: 'Veg & lentil soup',
		description: 'A thick soup of carrots, celery, potato and lentils',
		ingredients: ['red lentils', 'carrots', 'celery', 'potatoes']
	},
	{
		slug: 'tofu-broccoli-stir-fry',
		title: 'Tofu & broccoli stir-fry',
		description: 'Crisp tofu with broccoli and peppers over rice',
		ingredients: ['tofu', 'broccoli', 'peppers', 'rice']
	},
	{
		slug: 'salmon-potatoes-greens',
		title: 'Salmon, potatoes & greens',
		description: 'Seared salmon, roast potatoes and broccoli with lemon',
		ingredients: ['salmon', 'potatoes', 'broccoli', 'lemon']
	},
	{
		slug: 'bean-chili',
		title: 'Bean chili',
		description: 'Black bean chili with rice',
		ingredients: ['black beans', 'chopped tomatoes', 'peppers', 'rice']
	},
	{
		slug: 'halloumi-traybake',
		title: 'Halloumi traybake',
		description: 'Roast potatoes, peppers and courgettes with golden halloumi',
		ingredients: ['halloumi', 'potatoes', 'peppers', 'courgettes']
	}
];

const OUT = join(process.cwd(), 'artifacts', 'bakeoff');
const EXTENSIONS: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp'
};

function argument(name: string): string | undefined {
	const index = process.argv.indexOf(`--${name}`);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

async function apiKey(): Promise<string> {
	if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
	const env = await readFile(join(process.cwd(), '.env'), 'utf8').catch(() => '');
	const line = env.split('\n').find((row) => row.startsWith('OPENROUTER_API_KEY='));
	const key = line?.slice('OPENROUTER_API_KEY='.length).trim();
	if (!key) throw new Error('Set OPENROUTER_API_KEY (or put it in .env).');
	return key;
}

async function generate(key: string, variant: Variant, dish: Dish): Promise<Result> {
	const started = Date.now();
	const base = { variant: variant.id, model: variant.model, dish: dish.slug };
	try {
		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${key}`,
				'Content-Type': 'application/json',
				'X-Title': 'ReceiptToRecipe picture bake-off'
			},
			body: JSON.stringify({
				model: variant.model,
				messages: [{ role: 'user', content: recipePicturePrompt(dish) }],
				modalities: ['image', 'text'],
				usage: { include: true },
				...variant.extra
			})
		});
		const body = (await response.json()) as {
			error?: { message?: string };
			usage?: { cost?: number };
			choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
		};
		if (!response.ok)
			throw new Error(`${response.status} ${body.error?.message ?? response.statusText}`);
		const url = body.choices?.[0]?.message?.images?.[0]?.image_url?.url;
		const match = url ? /^data:([^;,]+);base64,(.*)$/s.exec(url) : null;
		if (!match) throw new Error('No image in the answer');
		const file = `${dish.slug}.${EXTENSIONS[match[1]] ?? 'png'}`;
		await mkdir(join(OUT, variant.id), { recursive: true });
		await writeFile(join(OUT, variant.id, file), Buffer.from(match[2], 'base64'));
		const seconds = (Date.now() - started) / 1000;
		return { ...base, file, cost: body.usage?.cost ?? null, seconds, error: null };
	} catch (error) {
		const seconds = (Date.now() - started) / 1000;
		return { ...base, file: null, cost: null, seconds, error: (error as Error).message };
	}
}

function escape(text: string): string {
	return text.replace(
		/[&<>"]/g,
		(char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char
	);
}

function money(value: number | null): string {
	return value === null ? '–' : `$${value.toFixed(4)}`;
}

function indexHtml(variants: Variant[], dishes: Dish[], results: Result[]): string {
	const cell = (variant: Variant, dish: Dish) => {
		const result = results.find((row) => row.variant === variant.id && row.dish === dish.slug);
		if (!result) return '<td>–</td>';
		if (!result.file) return `<td class="error">${escape(result.error ?? 'failed')}</td>`;
		return `<td><img src="${variant.id}/${result.file}" alt="${escape(dish.title)}, ${variant.id}" loading="lazy"><small>${money(result.cost)} · ${result.seconds.toFixed(1)} s</small></td>`;
	};
	const summary = variants
		.map((variant) => {
			const rows = results.filter((row) => row.variant === variant.id && row.file);
			const costs = rows.map((row) => row.cost).filter((cost): cost is number => cost !== null);
			const total = costs.reduce((sum, cost) => sum + cost, 0);
			const perPicture = costs.length ? total / costs.length : null;
			const perThousand = perPicture === null ? '–' : `$${(perPicture * 1000).toFixed(2)}`;
			const estimate = PICTURE_COST_ESTIMATES.find((row) => row.variant === variant.id);
			const estimated = estimate
				? estimate.low === estimate.high
					? money(estimate.low)
					: `${money(estimate.low)}–${money(estimate.high)}`
				: '–';
			return `<tr><th>${escape(variant.id)}</th><td>${escape(variant.model)}</td><td>${rows.length}/${dishes.length}</td><td>${money(costs.length ? total : null)}</td><td>${money(perPicture)}</td><td>${perThousand}</td><td>${estimated}</td></tr>`;
		})
		.join('\n');
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Recipe picture bake-off</title>
<style>
body{font:14px/1.4 system-ui,sans-serif;margin:24px;background:#fdfbf7;color:#2d3748}
table{border-collapse:collapse}th,td{border:1px solid #e5dcc4;padding:6px;vertical-align:top;text-align:left}
img{display:block;width:260px;height:195px;object-fit:cover;border-radius:4px}
small{color:#718096}.error{color:#b91c1c;max-width:260px}
</style></head><body>
<h1>Recipe picture bake-off</h1>
<p>Same house-style prompt (<code>src/lib/services/recipes/pictureStyle.ts</code>) for every model. Costs are what OpenRouter reported in <code>usage.cost</code>.</p>
<h2>Cost</h2>
<table><tr><th>Variant</th><th>Model</th><th>Pictures</th><th>Total</th><th>Per picture</th><th>Per 1,000 recipes</th><th>Estimated per picture</th></tr>
${summary}
</table>
<h2>Pictures</h2>
<table><tr><th>Dish</th>${variants.map((variant) => `<th>${escape(variant.id)}</th>`).join('')}</tr>
${dishes.map((dish) => `<tr><th>${escape(dish.title)}</th>${variants.map((variant) => cell(variant, dish)).join('')}</tr>`).join('\n')}
</table>
</body></html>
`;
}

async function main(): Promise<void> {
	const key = await apiKey();
	const dishes = DISHES.slice(0, Number(argument('dishes') ?? DISHES.length));
	const only = argument('only');
	const variants = only ? VARIANTS.filter((variant) => variant.id === only) : VARIANTS;
	await mkdir(OUT, { recursive: true });

	const resultsFile = join(OUT, 'results.json');
	const earlier: Result[] = existsSync(resultsFile)
		? JSON.parse(await readFile(resultsFile, 'utf8'))
		: [];
	const results = earlier.filter((row) => row.file);

	for (const variant of variants) {
		for (const dish of dishes) {
			if (results.some((row) => row.variant === variant.id && row.dish === dish.slug)) continue;
			const result = await generate(key, variant, dish);
			results.push(result);
			console.info(
				`${variant.id} · ${dish.slug}: ${result.error ?? `${money(result.cost)}, ${result.seconds.toFixed(1)} s`}`
			);
		}
	}

	await writeFile(resultsFile, `${JSON.stringify(results, null, '\t')}\n`);
	await writeFile(join(OUT, 'index.html'), indexHtml(VARIANTS, DISHES, results));
	console.info(`Open ${join(OUT, 'index.html')}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
