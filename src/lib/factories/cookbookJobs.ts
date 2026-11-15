/**
 * The system compositions the cookbook preprocessing scripts run: the importer, the picture run
 * and the bundle. They act for no household, so they are built here and not per request.
 *
 * The scripts' text and image models may run on any OpenAI-compatible server, on this machine or
 * hosted, through the PREPROCESS_* settings; OpenRouter is the default. The running app never
 * reads these settings: it uses OpenRouter only.
 */
import { ConfigService } from '$services/ConfigService';
import {
	ChatCookbookStructurer,
	CookbookBundleService,
	CookbookImportService,
	RulesCookbookStructurer,
	SmartImageGenerator,
	WikibooksClient,
	type ICookbookBundleService,
	type ICookbookImportService,
	type ICookbookStructurer,
	type IRecipePictureService
} from '$services';
import { chooseImageGenerator, DEFAULT_IMAGE_MODEL, OPENROUTER_BASE_URL } from '$services/recipes';
import { AppFactory } from './AppFactory';

/** The text model the importer uses when PREPROCESS_LLM_MODEL and OPENROUTER_MODEL are unset. */
const DEFAULT_STRUCTURER_MODEL = 'google/gemini-3-flash-preview';

export interface CookbookImportSetup {
	service: ICookbookImportService;
	structurer: ICookbookStructurer['kind'];
	/** The model and server that structure pages, when a model does. */
	model: { name: string; baseUrl: string } | null;
	/** Why the rules structurer runs, when it does. */
	reason: string | null;
	embeds: boolean;
}

/** A preprocessing setting, or null when it is unset or blank. */
function setting(name: string): string | null {
	return ConfigService.get(name)?.trim() || null;
}

/**
 * The importer. A model structures the pages through an OpenAI-compatible chat endpoint:
 * PREPROCESS_LLM_BASE_URL (OpenRouter by default), PREPROCESS_LLM_MODEL and
 * PREPROCESS_LLM_API_KEY (OPENROUTER_API_KEY for OpenRouter; a server on this machine may need
 * none), and PREPROCESS_LLM_REASONING_EFFORT (e.g. `none`) for a thinking model. The deterministic rules structure them instead with IMPORTER_STRUCTURER=rules, or when
 * OpenRouter is the server and there is no key. Embeddings always go through OpenRouter, so the
 * catalog matches the app's search queries; without a key the pages are stored without one.
 */
export function cookbookImport(options: { cacheDir: string | null }): CookbookImportSetup {
	const openRouterKey = setting('OPENROUTER_API_KEY');
	const baseUrl = setting('PREPROCESS_LLM_BASE_URL');
	const apiKey = setting('PREPROCESS_LLM_API_KEY') ?? (baseUrl ? '' : openRouterKey);
	const forced = setting('IMPORTER_STRUCTURER') === 'rules';
	const model =
		!forced && (baseUrl || apiKey)
			? {
					name:
						setting('PREPROCESS_LLM_MODEL') ??
						setting('OPENROUTER_MODEL') ??
						DEFAULT_STRUCTURER_MODEL,
					baseUrl: baseUrl ?? OPENROUTER_BASE_URL
				}
			: null;
	const structurer: ICookbookStructurer = model
		? new ChatCookbookStructurer({
				baseUrl: model.baseUrl,
				model: model.name,
				apiKey: apiKey ?? '',
				reasoningEffort: setting('PREPROCESS_LLM_REASONING_EFFORT')
			})
		: new RulesCookbookStructurer();
	const embedder = openRouterKey ? AppFactory.getCulinaryIntelligence() : null;
	return {
		service: new CookbookImportService(
			new WikibooksClient({ cacheDir: options.cacheDir }),
			structurer,
			AppFactory.getCookbookRecipeRepository(),
			embedder
		),
		structurer: structurer.kind,
		model,
		reason: forced ? 'IMPORTER_STRUCTURER=rules' : model ? null : 'no OPENROUTER_API_KEY',
		embeds: embedder !== null
	};
}

export interface CookbookPicturesSetup {
	pictures: IRecipePictureService;
	/** The image model, or `seed` for the stand-in photos. */
	model: string;
	/** The server, when it is not OpenRouter. */
	baseUrl: string | null;
}

/**
 * The picture service for the picture run. With PREPROCESS_IMAGE_BASE_URL, pictures come from
 * that OpenAI-compatible images endpoint (PREPROCESS_IMAGE_MODEL, optional
 * PREPROCESS_IMAGE_API_KEY). Otherwise from OpenRouter with PREPROCESS_IMAGE_MODEL, else the
 * app's image model; with `IMAGE_GENERATOR=seed` or no OpenRouter key, the seed photos stand in.
 */
export function cookbookPictures(): CookbookPicturesSetup {
	const baseUrl = setting('PREPROCESS_IMAGE_BASE_URL');
	const model =
		setting('PREPROCESS_IMAGE_MODEL') ?? setting('OPENROUTER_IMAGE_MODEL') ?? DEFAULT_IMAGE_MODEL;
	if (baseUrl) {
		const generator = new SmartImageGenerator(setting('PREPROCESS_IMAGE_API_KEY') ?? '', model, {
			baseUrl
		});
		return { pictures: AppFactory.recipePictureServiceWith(generator), model, baseUrl };
	}
	const apiKey = setting('OPENROUTER_API_KEY');
	const kind = chooseImageGenerator({
		setting: setting('IMAGE_GENERATOR') ?? undefined,
		apiKey: apiKey ?? undefined
	});
	if (kind === 'seed' || !apiKey) {
		return { pictures: AppFactory.getRecipePictureService(), model: 'seed', baseUrl: null };
	}
	return {
		pictures: AppFactory.recipePictureServiceWith(new SmartImageGenerator(apiKey, model)),
		model,
		baseUrl: null
	};
}

export function cookbookRecipes() {
	return AppFactory.getCookbookRecipeRepository();
}

/** Writes and loads cookbook bundles; loading makes no model calls. */
export function cookbookBundle(): ICookbookBundleService {
	return new CookbookBundleService(
		AppFactory.getCookbookRecipeRepository(),
		AppFactory.getStorageService()
	);
}
