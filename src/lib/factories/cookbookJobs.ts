/**
 * The system compositions the cookbook scripts run: the importer and the picture run. They act
 * for no household, so they are built here and not per request.
 */
import { dev } from '$app/environment';
import { ConfigService } from '$services/ConfigService';
import {
	CookbookImportService,
	OpenRouterCookbookStructurer,
	RulesCookbookStructurer,
	WikibooksClient,
	type ICookbookImportService,
	type ICookbookStructurer,
	type IRecipePictureService
} from '$services';
import { chooseImageGenerator, DEFAULT_IMAGE_MODEL } from '$services/recipes';
import { AppFactory } from './AppFactory';

export interface CookbookImportSetup {
	service: ICookbookImportService;
	structurer: ICookbookStructurer['kind'];
	/** Why the rules structurer runs, when it does. */
	reason: string | null;
	embeds: boolean;
}

/**
 * The importer. The model structures pages through OpenRouter unless there is no key or
 * IMPORTER_STRUCTURER=rules, when the deterministic rules do. Embeddings need the key too.
 */
export function cookbookImport(options: { cacheDir: string | null }): CookbookImportSetup {
	const apiKey = ConfigService.get('OPENROUTER_API_KEY') || null;
	const forced = ConfigService.get('IMPORTER_STRUCTURER') === 'rules';
	const structurer: ICookbookStructurer =
		apiKey && !forced
			? new OpenRouterCookbookStructurer(
					apiKey,
					ConfigService.get('OPENROUTER_MODEL') || 'google/gemini-3-flash-preview'
				)
			: new RulesCookbookStructurer();
	const embedder = apiKey ? AppFactory.getCulinaryIntelligence() : null;
	return {
		service: new CookbookImportService(
			new WikibooksClient({ cacheDir: options.cacheDir }),
			structurer,
			AppFactory.getCookbookRecipeRepository(),
			embedder
		),
		structurer: structurer.kind,
		reason: forced ? 'IMPORTER_STRUCTURER=rules' : apiKey ? null : 'no OPENROUTER_API_KEY',
		embeds: embedder !== null
	};
}

/**
 * The picture service, and which image model it uses: `seed` for the stand-in photos, `local`
 * for FLUX on this machine, else the OpenRouter model.
 */
export function cookbookPictures(): { pictures: IRecipePictureService; model: string } {
	const kind = chooseImageGenerator({
		setting: ConfigService.get('IMAGE_GENERATOR'),
		apiKey: ConfigService.get('OPENROUTER_API_KEY'),
		// A built server (`dev` false) counts as production even when NODE_ENV is unset.
		production: !dev || process.env.NODE_ENV === 'production'
	});
	return {
		pictures: AppFactory.getRecipePictureService(),
		model:
			kind === 'openrouter'
				? ConfigService.get('OPENROUTER_IMAGE_MODEL') || DEFAULT_IMAGE_MODEL
				: kind
	};
}

export function cookbookRecipes() {
	return AppFactory.getCookbookRecipeRepository();
}
