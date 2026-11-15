/**
 * Imports the Wikibooks Cookbook (Category:Recipes, CC BY-SA 4.0) into the shared catalog, then
 * gives the new recipes their picture.
 *
 *   npm run cookbook:import [-- --limit 50] [-- --no-pictures] [-- --no-cache] [-- --yes]
 *
 * Pages are read through the MediaWiki API at about one request per second, and responses are
 * cached under artifacts/cache/wikibooks/ (--no-cache reads the wiki again). A page stored at the
 * same revision is skipped; a new revision updates it. The model structures each page through
 * OpenRouter; without a key, or with IMPORTER_STRUCTURER=rules, deterministic rules do.
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
			`Structuring with ${setup.structurer === 'model' ? 'the model' : `rules (${setup.reason})`}; ${setup.embeds ? 'embedding each recipe' : 'no embeddings (no key)'}.`
		);

		const summary = await setup.service.import({
			limit,
			onPage: (title, outcome) => console.log(`  ${title}: ${outcome}`)
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
