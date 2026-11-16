/**
 * Writes the shared cookbook as a bundle, or loads one into this database and object store.
 *
 *   npm run cookbook:export [-- --out artifacts/cookbook-bundle-2026-11-16.tar.gz]
 *   npm run cookbook:load -- <bundle.tar.gz | https://…/bundle.tar.gz>
 *
 * A bundle is a .tar.gz of `catalog.jsonl` (one recipe per line: page id, revision, structured
 * recipe, tags, embedding, picture), `pictures/<pageId>.webp` (about 800 px wide) and
 * `manifest.json` (counts, models, licences, the catalog's checksum). Loading makes no model
 * calls and can run again: pages already stored at the bundle's revision are left alone. The
 * models that made a bundle are named with PREPROCESS_LLM_MODEL and PREPROCESS_IMAGE_MODEL (the
 * manifest records them). See docs/cookbook.md.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { appModules, argument } from './lib/appModules.ts';
import type * as Jobs from '../src/lib/factories/cookbookJobs.ts';
import type * as Services from '../src/lib/services/index.ts';

const run = promisify(execFile);
/** The bundle's pictures are this wide at most. */
const PICTURE_WIDTH = 800;

async function exportBundle(args: string[]) {
	const date = new Date().toISOString().slice(0, 10);
	const out = resolve(argument(args, 'out') ?? join('artifacts', `cookbook-bundle-${date}.tar.gz`));
	const { default: sharp } = await import('sharp');
	const modules = await appModules();
	const work = await mkdtemp(join(tmpdir(), 'cookbook-bundle-'));
	try {
		const jobs = await modules.load<typeof Jobs>('/src/lib/factories/cookbookJobs.ts');
		const services = await modules.load<typeof Services>('/src/lib/services/index.ts');
		const manifest = await jobs.cookbookBundle().export(services.directoryBundleFiles(work), {
			shrink: (picture) =>
				sharp(picture)
					.resize({ width: PICTURE_WIDTH, withoutEnlargement: true })
					.webp({ quality: 80 })
					.toBuffer(),
			models: {
				text: process.env.PREPROCESS_LLM_MODEL || 'rules',
				embedding: 'openai/text-embedding-3-small (768)',
				pictures: process.env.PREPROCESS_IMAGE_MODEL || 'black-forest-labs/flux-3-image-klein'
			}
		});
		await run('tar', ['-czf', out, '-C', work, '.']);
		console.log(
			`Wrote ${out}: ${manifest.recipes} recipes, ${manifest.pictures} pictures, ${manifest.embedded} embedded.`
		);
	} finally {
		await rm(work, { recursive: true, force: true });
		await modules.close();
	}
}

async function loadBundle(source: string) {
	const modules = await appModules();
	const work = await mkdtemp(join(tmpdir(), 'cookbook-bundle-'));
	try {
		let archive = resolve(source);
		if (/^https?:\/\//.test(source)) {
			const response = await fetch(source);
			if (!response.ok) throw new Error(`${source} answered ${response.status}`);
			archive = join(work, 'bundle.tar.gz');
			await writeFile(archive, Buffer.from(await response.arrayBuffer()));
		}
		const unpacked = join(work, 'bundle');
		await run('mkdir', ['-p', unpacked]);
		await run('tar', ['-xzf', archive, '-C', unpacked]);

		const jobs = await modules.load<typeof Jobs>('/src/lib/factories/cookbookJobs.ts');
		const services = await modules.load<typeof Services>('/src/lib/services/index.ts');
		let done = 0;
		const summary = await jobs.cookbookBundle().load(services.directoryBundleFiles(unpacked), {
			onRecipe: () => {
				done += 1;
				if (done % 250 === 0) console.log(`  ${done} recipes`);
			}
		});
		console.log(
			`Loaded ${summary.recipes} recipes: ${summary.inserted} new, ${summary.updated} updated, ${summary.unchanged} unchanged; ${summary.pictures} pictures stored.`
		);
	} finally {
		await rm(work, { recursive: true, force: true });
		await modules.close();
	}
}

async function main() {
	const [command, ...args] = process.argv.slice(2);
	if (command === 'export') await exportBundle(args);
	else if (command === 'load' && args[0]) await loadBundle(args[0]);
	else throw new Error('Usage: cookbook-bundle.ts export [--out <file>] | load <file|URL>');
	process.exit(0);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
