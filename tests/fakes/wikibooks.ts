import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
	CookbookStructure,
	WikibooksPage,
	WikibooksSections
} from '../../src/lib/models/recipes';
import type {
	CookbookEmbedder,
	ICookbookStructurer,
	IWikibooksClient,
	WikibooksLicence
} from '../../src/lib/services/interfaces/ICookbook';
import { RulesCookbookStructurer } from '../../src/lib/services/CookbookStructurers';

const FIXTURES = join(__dirname, '../fixtures/wikibooks');

const PAGES: Record<string, { title: string; pageId: number; revisionId: number }> = {
	'beef-stroganoff': {
		title: 'Cookbook:20-Minute Beef Stroganoff',
		pageId: 127881,
		revisionId: 4629559
	},
	'adobo-chicken': {
		title: 'Cookbook:Adobo Chicken (Philippine)',
		pageId: 47816,
		revisionId: 4630209
	},
	'agar-jelly': { title: 'Cookbook:Agar Jelly', pageId: 33309, revisionId: 4587276 },
	'akamu-no-amounts': {
		title: 'Cookbook:Akamu (Nigerian Pudding)',
		pageId: 446161,
		revisionId: 4525801
	}
};

/** A committed fixture page as the API returns it; pass a revision to pretend it was edited. */
export function fixturePage(name: keyof typeof PAGES, revisionId?: number): WikibooksPage {
	const meta = PAGES[name];
	return {
		pageId: meta.pageId,
		revisionId: revisionId ?? meta.revisionId,
		title: meta.title,
		wikitext: readFileSync(join(FIXTURES, `${name}.wikitext`), 'utf8')
	};
}

/** Serves the pages it was given, under the licence it was given. */
export class FakeWikibooksClient implements IWikibooksClient {
	constructor(
		public pages: WikibooksPage[],
		public licenceAnswer: WikibooksLicence = {
			text: 'Creative Commons Attribution-Share Alike 4.0',
			url: 'https://creativecommons.org/licenses/by-sa/4.0/'
		}
	) {}

	async licence(): Promise<WikibooksLicence> {
		return this.licenceAnswer;
	}

	async *recipePages(limit: number): AsyncGenerator<WikibooksPage> {
		for (const page of this.pages.slice(0, limit)) yield page;
	}
}

/** The rules structurer, except for titles it is told to fail, as a model answer that does not fit. */
export class FakeStructurer implements ICookbookStructurer {
	readonly kind = 'model' as const;
	private rules = new RulesCookbookStructurer();

	constructor(public failing: string[] = []) {}

	async structure(title: string, sections: WikibooksSections): Promise<CookbookStructure> {
		if (this.failing.includes(title)) throw new Error('servings: expected a number');
		return this.rules.structure(title, sections);
	}
}

/** Gives every text the same short vector, or fails like an unreachable embedding model. */
export class FakeEmbedder implements CookbookEmbedder {
	asked = 0;

	constructor(public fails = false) {}

	async embed(): Promise<number[]> {
		this.asked += 1;
		if (this.fails) throw new Error('401 Missing Authentication header');
		return [0.1, 0.2, 0.3];
	}
}
