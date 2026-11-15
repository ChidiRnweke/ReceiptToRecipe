/**
 * Gives shared-cookbook recipes their picture, generated in the house style. Resumable: a run
 * only looks at recipes without a picture, so stopping and starting again continues.
 *
 *   npm run cookbook:pictures [-- --model openai/gpt-5-image-mini] [-- --limit 100]
 *                             [-- --replace-stand-ins] [-- --yes]
 *
 * --model sets OPENROUTER_IMAGE_MODEL for this run. Without a working OpenRouter key, or with
 * IMAGE_GENERATOR=seed, the committed seed photos stand in. The spend estimate (from the
 * bake-off's per-picture costs) is printed first; a run that costs money waits 5 seconds, so
 * Ctrl-C stops it, unless --yes is passed.
 */
import { appModules, argument, integerArgument } from './lib/appModules.ts';
import type * as Jobs from '../src/lib/factories/cookbookJobs.ts';
import type * as Costs from '../src/lib/services/recipes/pictureCosts.ts';

export async function runCookbookPictures(
	jobs: typeof Jobs,
	costs: typeof Costs,
	options: { limit: number; standIns: boolean; wait: boolean }
): Promise<void> {
	const { pictures, model } = jobs.cookbookPictures();
	const repository = jobs.cookbookRecipes();
	const waiting = await repository.countWithoutPicture(options.standIns);
	const count = Math.min(waiting, options.limit);
	if (count === 0) {
		console.log('Every cookbook recipe has a picture.');
		return;
	}

	if (model === 'seed') {
		console.log(`${count} picture(s) from the committed seed photos (stand-ins): $0.`);
	} else {
		const estimate = costs.spendEstimate(model, count);
		console.log(
			estimate
				? `${count} picture(s) with ${model}: about $${estimate.low.toFixed(2)}–$${estimate.high.toFixed(2)} ($${estimate.perPicture.low}–$${estimate.perPicture.high} each, bake-off estimate).`
				: `${count} picture(s) with ${model}: no estimate for this model; see scripts/picture-bakeoff.ts.`
		);
		if (options.wait) {
			console.log('Starting in 5 s; Ctrl-C to stop.');
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}
	}

	const summary = await pictures.fillCookbook({
		limit: options.limit,
		standIns: options.standIns,
		onPicture: (title, outcome) => console.log(`  ${title}: ${outcome}`)
	});
	console.log(
		`Pictures: ${summary.filled} made, ${summary.failed} failed${summary.stopped ? ' (stopped after 3 failures in a row)' : ''}.`
	);
}

async function main() {
	const args = process.argv.slice(2);
	const model = argument(args, 'model');
	if (model) process.env.OPENROUTER_IMAGE_MODEL = model;
	const modules = await appModules();
	try {
		const jobs = await modules.load<typeof Jobs>('/src/lib/factories/cookbookJobs.ts');
		const costs = await modules.load<typeof Costs>('/src/lib/services/recipes/pictureCosts.ts');
		await runCookbookPictures(jobs, costs, {
			limit: integerArgument(args, 'limit', Number.MAX_SAFE_INTEGER),
			standIns: args.includes('--replace-stand-ins'),
			wait: !args.includes('--yes')
		});
	} finally {
		await modules.close();
	}
	process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
