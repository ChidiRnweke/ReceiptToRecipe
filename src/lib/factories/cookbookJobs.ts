/**
 * The system compositions the cookbook scripts run: the importer and the picture run. They act
 * for no household, so they are built here and not per request.
 */
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

/** The picture service, and which image model it uses (`seed` for the stand-in photos). */
export function cookbookPictures(): { pictures: IRecipePictureService; model: string } {
	const apiKey = ConfigService.get('OPENROUTER_API_KEY');
	const seed = ConfigService.get('IMAGE_GENERATOR') === 'seed' || !apiKey;
	return {
		pictures: AppFactory.getRecipePictureService(),
		model: seed
			? 'seed'
			: ConfigService.get('OPENROUTER_IMAGE_MODEL') || 'google/gemini-2.5-flash-image'
	};
}

export function cookbookRecipes() {
	return AppFactory.getCookbookRecipeRepository();
}
