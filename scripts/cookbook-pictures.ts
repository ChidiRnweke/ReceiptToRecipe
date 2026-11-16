/**
 * Gives shared-cookbook recipes their picture, generated in the house style from a scene caption
 * of the served dish. Resumable: a run only looks at recipes without a picture, so stopping and
 * starting again continues. With --regenerate it also makes again every picture of an older
 * house style; each new picture records its style, so a stopped run continues too.
 *
 *   npm run cookbook:pictures [-- --model google/gemini-2.5-flash-image] [-- --limit 100]
 *                             [-- --replace-stand-ins] [-- --regenerate] [-- --yes]
 *
 * Pictures come from OpenRouter's images endpoint (FLUX 3 Image Klein by default), or from any
 * OpenAI-compatible images endpoint set in PREPROCESS_IMAGE_BASE_URL (docs/cookbook.md). --model
 * sets PREPROCESS_IMAGE_MODEL for this run. Without a working OpenRouter key and no other server,
 * or with IMAGE_GENERATOR=seed, the committed seed photos stand in. A recipe without a stored
 * caption is captioned first on the PREPROCESS_LLM_* text server (OpenRouter by default). The spend estimate (from the
 * bake-off's per-picture costs) is printed first; a run that may cost money waits 5 seconds, so
 * Ctrl-C stops it, unless --yes is passed.
 */
import { appModules, argument, integerArgument } from './lib/appModules.ts';
import type * as Jobs from '../src/lib/factories/cookbookJobs.ts';
import type * as Costs from '../src/lib/services/recipes/pictureCosts.ts';
import type * as Styles from '../src/lib/services/recipes/pictureStyle.ts';

export async function runCookbookPictures(
	jobs: typeof Jobs,
	costs: typeof Costs,
	styles: typeof Styles,
	options: { limit: number; standIns: boolean; regenerate: boolean; wait: boolean }
): Promise<void> {
	const { pictures, model, baseUrl, captionModel } = jobs.cookbookPictures();
	const repository = jobs.cookbookRecipes();
	const waiting = options.regenerate
		? await repository.countWithOlderPicture(styles.HOUSE_PICTURE_STYLE_VERSION)
		: await repository.countWithoutPicture(options.standIns);
	const count = Math.min(waiting, options.limit);
	if (count === 0) {
		console.log(
			options.regenerate
				? `Every cookbook picture is in house style ${styles.HOUSE_PICTURE_STYLE_VERSION}.`
				: 'Every cookbook recipe has a picture.'
		);
		return;
	}
	console.log(
		captionModel
			? `Recipes without a caption are captioned by ${captionModel}.`
			: 'No caption model: recipes without a stored caption are drawn from their title.'
	);

	const notice = costs.pictureRunNotice(model, count, baseUrl);
	console.log(notice.message);
	if (notice.costsMoney && options.wait) {
		console.log('Starting in 5 s; Ctrl-C to stop.');
		await new Promise((resolve) => setTimeout(resolve, 5000));
	}

	const summary = await pictures.fillCookbook({
		limit: options.limit,
		standIns: options.standIns,
		regenerate: options.regenerate,
		onPicture: (title, outcome) => console.log(`  ${new Date().toISOString()} ${title}: ${outcome}`)
	});
	console.log(
		`Pictures: ${summary.filled} made, ${summary.failed} failed${summary.stopped ? ' (stopped after 3 failures in a row)' : ''}.`
	);
}

async function main() {
	const args = process.argv.slice(2);
	const model = argument(args, 'model');
	if (model) process.env.PREPROCESS_IMAGE_MODEL = model;
	const modules = await appModules();
	try {
		const jobs = await modules.load<typeof Jobs>('/src/lib/factories/cookbookJobs.ts');
		const costs = await modules.load<typeof Costs>('/src/lib/services/recipes/pictureCosts.ts');
		const styles = await modules.load<typeof Styles>('/src/lib/services/recipes/pictureStyle.ts');
		await runCookbookPictures(jobs, costs, styles, {
			limit: integerArgument(args, 'limit', Number.MAX_SAFE_INTEGER),
			standIns: args.includes('--replace-stand-ins'),
			regenerate: args.includes('--regenerate'),
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
