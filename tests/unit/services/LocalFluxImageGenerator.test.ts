import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFluxImageGenerator } from '../../../src/lib/services/LocalFluxImageGenerator';

const FAKE_WORKER = join(process.cwd(), 'tests/fixtures/flux-worker/fake-worker.mjs');

interface Setup {
	env?: Record<string, string>;
	readyTimeoutMs?: number;
	requestTimeoutMs?: number;
}

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
	await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

/** A generator over the fake worker, with its own picture folder; it keeps the log lines. */
function generatorOver(setup: Setup = {}) {
	const folder = mkdtempSync(join(tmpdir(), 'r2r-flux-test-'));
	const logs: string[] = [];
	const generator = new LocalFluxImageGenerator({
		command: process.execPath,
		args: [FAKE_WORKER],
		env: setup.env,
		tempDir: folder,
		readyTimeoutMs: setup.readyTimeoutMs ?? 5000,
		requestTimeoutMs: setup.requestTimeoutMs ?? 5000,
		onLog: (line) => logs.push(line)
	});
	cleanups.push(async () => {
		await generator.close();
		rmSync(folder, { recursive: true, force: true });
	});
	return { generator, logs, folder };
}

/** What the fake worker "drew": it writes the prompt into the picture file. */
function drawn(url: string): string {
	return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64').toString('utf8');
}

function isRunning(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

describe('LocalFluxImageGenerator', () => {
	describe('pictures', () => {
		it('returns the picture as a PNG data URL', async () => {
			const { generator } = generatorOver();
			const image = await generator.generateImage('shakshuka');
			expect(image.url.startsWith('data:image/png;base64,')).toBe(true);
		});

		it('returns the picture the worker made for the prompt', async () => {
			const { generator } = generatorOver();
			const image = await generator.generateImage('shakshuka');
			expect(drawn(image.url)).toBe('shakshuka');
		});

		it('waits for the worker to load the model before it asks for a picture', async () => {
			const { generator } = generatorOver({ env: { FAKE_READY_DELAY_MS: '200' } });
			const image = await generator.generateImage('frittata');
			expect(drawn(image.url)).toBe('frittata');
		});

		it('deletes the picture file once it has read it', async () => {
			const { generator, folder } = generatorOver();
			await generator.generateImage('risotto');
			expect(readdirSync(folder)).toEqual([]);
		});

		it('passes the worker’s log lines on', async () => {
			const { generator, logs } = generatorOver();
			await generator.generateImage('salmon');
			expect(logs).toContain('[flux-worker] loading fake model');
		});
	});

	describe('one picture at a time', () => {
		it('gives two pictures asked for at once each its own answer, in order', async () => {
			const { generator } = generatorOver();
			const images = await Promise.all([
				generator.generateImage('frittata'),
				generator.generateImage('risotto')
			]);
			expect(images.map((image) => drawn(image.url))).toEqual(['frittata', 'risotto']);
		});
	});

	describe('failures', () => {
		it('fails a picture the worker could not make, with the worker’s reason', async () => {
			const { generator } = generatorOver();
			await expect(generator.generateImage('please fail')).rejects.toThrow('prompt refused');
		});

		it('makes the next picture after one failed', async () => {
			const { generator } = generatorOver();
			await generator.generateImage('please fail').catch(() => undefined);
			const image = await generator.generateImage('tacos');
			expect(drawn(image.url)).toBe('tacos');
		});

		it('fails the picture in progress when the worker stops, with its last log line', async () => {
			const { generator } = generatorOver();
			await expect(generator.generateImage('crash now')).rejects.toThrow('out of memory');
		});

		it('starts a new worker for the next picture after a crash', async () => {
			const { generator } = generatorOver();
			await generator.generateImage('crash now').catch(() => undefined);
			const image = await generator.generateImage('chili');
			expect(drawn(image.url)).toBe('chili');
		});

		it('fails a picture that takes longer than the request timeout', async () => {
			const { generator } = generatorOver({ requestTimeoutMs: 300 });
			await expect(generator.generateImage('hang here')).rejects.toThrow('took longer than');
		});

		it('fails when the worker does not load the model in time', async () => {
			const { generator } = generatorOver({ env: { FAKE_NEVER_READY: '1' }, readyTimeoutMs: 300 });
			await expect(generator.generateImage('soup')).rejects.toThrow('loading the model');
		});

		it('fails with a clear error when the worker command does not exist', async () => {
			const generator = new LocalFluxImageGenerator({
				command: join(process.cwd(), 'no-such-worker'),
				args: [],
				onLog: () => undefined
			});
			cleanups.push(() => generator.close());
			await expect(generator.generateImage('soup')).rejects.toThrow('could not start');
		});
	});

	describe('shutdown', () => {
		it('stops the worker on close', async () => {
			const pidFile = join(mkdtempSync(join(tmpdir(), 'r2r-flux-pid-')), 'pid');
			const { generator } = generatorOver({ env: { FAKE_PID_FILE: pidFile } });
			await generator.generateImage('salmon');
			const pid = Number(readFileSync(pidFile, 'utf8'));
			await generator.close();
			await new Promise((resolve) => setTimeout(resolve, 200));
			expect(isRunning(pid)).toBe(false);
		});
	});
});
