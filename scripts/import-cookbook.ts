/**
 * Imports the Wikibooks Cookbook (Category:Recipes, CC BY-SA 4.0) into the shared catalog, then
 * gives the new recipes their picture.
 *
 *   npm run cookbook:import [-- --limit 50] [-- --no-pictures] [-- --no-cache] [-- --yes]
 *
 * Pages are read through the MediaWiki API at about one request per second, and responses are
 * cached under artifacts/cache/wikibooks/ (--no-cache reads the wiki again). A page stored at the
 * same revision is skipped; a new revision updates it, and a model run structures again the pages
 * the rules structured. A model structures each page through an OpenAI-compatible chat endpoint
 * (PREPROCESS_LLM_BASE_URL, OpenRouter by default; see docs/cookbook.md); without a key, or with
 * IMPORTER_STRUCTURER=rules, deterministic rules do. Embeddings go through OpenRouter; a page
 * whose embedding fails keeps the one already stored. So a fast rules run (embedding every page)
 * followed by a slow model run leaves every page embedded even if the key stops working midway.
 * Pictures follow `npm run cookbook:pictures`: the spend estimate is printed first.
 */
import { join } from 'node:path';
import { appModules, integerArgument } from './lib/appModules.ts';
import { runCookbookPictures } from './cookbook-pictures.ts';
import type * as Jobs from '../src/lib/factories/cookbookJobs.ts';
import type * as Costs from '../src/lib/services/recipes/pictureCosts.ts';

const CACHE_DIR = join(process.cwd(), 'artifacts', 'cache', 'wikibooks');

async function main() {
	const args = process.argv.slice(2);
	const limit = integerArgument(args, 'limit', Number.MAX_SAFE_INTEGER);
	const modules = await appModules();
	try {
		const jobs = await modules.load<typeof Jobs>('/src/lib/factories/cookbookJobs.ts');
		const setup = jobs.cookbookImport({ cacheDir: args.includes('--no-cache') ? null : CACHE_DIR });
		console.log(
			`Structuring with ${setup.model ? `${setup.model.name} at ${setup.model.baseUrl}` : `rules (${setup.reason})`}; ${setup.embeds ? 'embedding each recipe' : 'no embeddings (no key)'}.`
		);

		let last = Date.now();
		const summary = await setup.service.import({
			limit,
			onPage: (title, outcome) => {
				const now = Date.now();
				console.log(
					`  ${new Date(now).toISOString()} ${((now - last) / 1000).toFixed(1)}s ${title}: ${outcome}`
				);
				last = now;
			}
		});
		const skipped = Object.entries(summary.skipped)
			.map(([reason, count]) => `${reason} ${count}`)
			.join(', ');
		console.log(
			`Seen ${summary.seen}: imported ${summary.imported}, updated ${summary.updated}, skipped ${summary.seen - summary.imported - summary.updated}${skipped ? ` (${skipped})` : ''}; ${summary.unembedded} without an embedding.`
		);

		if (!args.includes('--no-pictures')) {
			const costs = await modules.load<typeof Costs>('/src/lib/services/recipes/pictureCosts.ts');
			await runCookbookPictures(jobs, costs, {
				limit: Math.max(summary.imported + summary.updated, 1),
				standIns: false,
				wait: !args.includes('--yes')
			});
		}
	} finally {
		await modules.close();
	}
	process.exit(0);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
