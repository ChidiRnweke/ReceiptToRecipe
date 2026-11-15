import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { WikibooksPage } from '$lib/models/recipes';
import type { IWikibooksClient, WikibooksLicence } from './interfaces/ICookbook';

const API = 'https://en.wikibooks.org/w/api.php';
/** Wikimedia asks API clients to name themselves and give a way to reach the operator. */
export const WIKIBOOKS_USER_AGENT =
	'ReceiptToRecipe cookbook importer (https://github.com/ChidiRnweke/ReceiptToRecipe)';
/** The Cookbook namespace; Category:Recipes also holds user drafts in other namespaces. */
const COOKBOOK_NAMESPACE = 102;
/** The most pages the API returns with their wikitext in one request. */
const PAGE_BATCH = 50;

interface ApiPage {
	pageid: number;
	ns: number;
	title: string;
	missing?: boolean;
	revisions?: { revid: number; slots?: { main?: { content?: string } } }[];
}

interface ApiResponse {
	continue?: Record<string, string>;
	query?: {
		pages?: ApiPage[];
		rightsinfo?: { url: string; text: string };
	};
	error?: { code: string; info: string };
}

export interface WikibooksClientOptions {
	/** Where responses are kept, so a second run reads them from disk. Null keeps nothing. */
	cacheDir: string | null;
	/** Time between two network requests, in ms. */
	minIntervalMs?: number;
	fetch?: typeof fetch;
}

/**
 * The MediaWiki API of English Wikibooks, about one request per second, with a polite
 * User-Agent and an on-disk response cache.
 */
export class WikibooksClient implements IWikibooksClient {
	private lastRequest = 0;
	private fetcher: typeof fetch;

	constructor(private options: WikibooksClientOptions) {
		this.fetcher = options.fetch ?? fetch;
	}

	async licence(): Promise<WikibooksLicence> {
		const response = await this.get({ action: 'query', meta: 'siteinfo', siprop: 'rightsinfo' });
		const rights = response.query?.rightsinfo;
		if (!rights) throw new Error('Wikibooks did not state its licence');
		return { text: rights.text, url: rights.url };
	}

	async *recipePages(limit: number): AsyncGenerator<WikibooksPage> {
		let yielded = 0;
		let next: Record<string, string> = {};
		for (;;) {
			const response = await this.get({
				action: 'query',
				generator: 'categorymembers',
				gcmtitle: 'Category:Recipes',
				gcmnamespace: String(COOKBOOK_NAMESPACE),
				gcmtype: 'page',
				gcmlimit: String(PAGE_BATCH),
				prop: 'revisions',
				rvprop: 'ids|content',
				rvslots: 'main',
				...next
			});
			// The API returns a batch's pages by page id; read them in title order.
			const pages = [...(response.query?.pages ?? [])].sort((a, b) =>
				a.title.localeCompare(b.title)
			);
			for (const page of pages) {
				const revision = page.revisions?.[0];
				const wikitext = revision?.slots?.main?.content;
				if (page.missing || page.ns !== COOKBOOK_NAMESPACE || !revision || wikitext == null) {
					continue;
				}
				yield { pageId: page.pageid, revisionId: revision.revid, title: page.title, wikitext };
				yielded += 1;
				if (yielded >= limit) return;
			}
			if (!response.continue) return;
			next = response.continue;
		}
	}

	private async get(params: Record<string, string>): Promise<ApiResponse> {
		const url = `${API}?${new URLSearchParams({ ...params, format: 'json', formatversion: '2' })}`;
		const cached = await this.readCache(url);
		if (cached) return cached;

		const wait = this.lastRequest + (this.options.minIntervalMs ?? 1000) - Date.now();
		if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
		this.lastRequest = Date.now();

		const response = await this.fetcher(url, {
			headers: { 'User-Agent': WIKIBOOKS_USER_AGENT, 'Api-User-Agent': WIKIBOOKS_USER_AGENT }
		});
		if (!response.ok) throw new Error(`Wikibooks answered ${response.status} for ${url}`);
		const body = (await response.json()) as ApiResponse;
		if (body.error) throw new Error(`Wikibooks: ${body.error.code}: ${body.error.info}`);
		await this.writeCache(url, body);
		return body;
	}

	private cachePath(url: string): string | null {
		if (!this.options.cacheDir) return null;
		return join(this.options.cacheDir, `${createHash('sha1').update(url).digest('hex')}.json`);
	}

	private async readCache(url: string): Promise<ApiResponse | null> {
		const path = this.cachePath(url);
		if (!path) return null;
		try {
			return JSON.parse(await readFile(path, 'utf8')) as ApiResponse;
		} catch {
			// Not cached yet.
			return null;
		}
	}

	private async writeCache(url: string, body: ApiResponse): Promise<void> {
		const path = this.cachePath(url);
		if (!path || !this.options.cacheDir) return;
		await mkdir(this.options.cacheDir, { recursive: true });
		await writeFile(path, JSON.stringify(body));
	}
}
