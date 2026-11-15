import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { GeneratedImage, IImageGenerator } from './interfaces';

export interface LocalFluxOptions {
	/** The worker command; by default `uv run scripts/pictures/flux_worker.py`. */
	command?: string;
	args?: string[];
	/** Extra environment for the worker, e.g. FLUX_LOCAL_MODEL. */
	env?: Record<string, string | undefined>;
	width?: number;
	height?: number;
	/** How long the worker may take to load the model; the first run downloads about 10 GB. */
	readyTimeoutMs?: number;
	/** How long one picture may take. */
	requestTimeoutMs?: number;
	/** The folder for the worker's picture files; by default a new temporary folder. */
	tempDir?: string;
	/** Where the worker's log lines go; by default stderr. */
	onLog?: (line: string) => void;
}

interface WorkerAnswer {
	ready?: boolean;
	id?: string | null;
	path?: string;
	seconds?: number;
	error?: string;
}

interface Waiter {
	resolve: (answer: WorkerAnswer) => void;
	reject: (error: Error) => void;
}

const LOG_TAIL = 20;

/**
 * Makes recipe pictures with FLUX on this machine. It starts the Python worker
 * (`scripts/pictures/flux_worker.py`, MLX through mflux) on the first picture, waits until the
 * model is loaded, and then sends one request at a time over the worker's stdin. The worker
 * writes a PNG to a temporary folder; the generator returns it as a `data:` URL and deletes the
 * file. When the worker exits or a picture takes too long, that picture fails and the next one
 * starts a new worker. For development and batch runs on Apple Silicon only.
 */
export class LocalFluxImageGenerator implements IImageGenerator {
	private readonly command: string;
	private readonly args: string[];
	private readonly width: number;
	private readonly height: number;
	private readonly readyTimeoutMs: number;
	private readonly requestTimeoutMs: number;
	private readonly onLog: (line: string) => void;

	private worker: ChildProcess | null = null;
	private ready: Promise<void> | null = null;
	private folder: Promise<string> | null = null;
	/** The answer the current request waits for: the ready line, or the picture with this id. */
	private waiting: { id: string | null; waiter: Waiter } | null = null;
	private queue: Promise<unknown> = Promise.resolve();
	private logTail: string[] = [];
	private readonly killOnExit = () => this.worker?.kill();

	constructor(private readonly options: LocalFluxOptions = {}) {
		this.command = options.command ?? 'uv';
		this.args = options.args ?? [
			'run',
			'--quiet',
			join(process.cwd(), 'scripts/pictures/flux_worker.py')
		];
		this.width = options.width ?? 1024;
		this.height = options.height ?? 768;
		this.readyTimeoutMs = options.readyTimeoutMs ?? 30 * 60_000;
		this.requestTimeoutMs = options.requestTimeoutMs ?? 5 * 60_000;
		this.onLog = options.onLog ?? ((line) => process.stderr.write(`${line}\n`));
	}

	generateImage(prompt: string): Promise<GeneratedImage> {
		const turn = this.queue.then(() => this.generateNow(prompt));
		this.queue = turn.catch(() => undefined);
		return turn;
	}

	/** Stops the worker. A later picture starts a new one. */
	async close(): Promise<void> {
		this.stopWorker();
		const folder = this.folder;
		this.folder = null;
		if (folder && !this.options.tempDir) await rm(await folder, { recursive: true, force: true });
	}

	private async generateNow(prompt: string): Promise<GeneratedImage> {
		await this.start();
		const id = randomUUID();
		const out = join(await this.tempFolder(), `${id}.png`);
		try {
			const answer = await this.ask(
				id,
				{ id, prompt, width: this.width, height: this.height, seed: seedOf(prompt), out },
				this.requestTimeoutMs,
				`making a picture took longer than ${this.requestTimeoutMs / 1000} s`
			);
			if (answer.error)
				throw new Error(`The local FLUX worker could not make the picture: ${answer.error}`);
			const data = await readFile(answer.path ?? out);
			return { url: `data:image/png;base64,${data.toString('base64')}` };
		} finally {
			await rm(out, { force: true });
		}
	}

	private start(): Promise<void> {
		if (!this.ready) {
			this.ready = this.spawnWorker().catch((error) => {
				this.ready = null;
				throw error;
			});
		}
		return this.ready;
	}

	private async spawnWorker(): Promise<void> {
		this.logTail = [];
		const worker = spawn(this.command, this.args, {
			env: { ...process.env, ...this.options.env },
			stdio: ['pipe', 'pipe', 'pipe']
		});
		this.worker = worker;
		process.once('exit', this.killOnExit);

		createInterface({ input: worker.stdout! }).on('line', (line) => this.onAnswer(line));
		createInterface({ input: worker.stderr! }).on('line', (line) => {
			this.logTail = [...this.logTail.slice(1 - LOG_TAIL), line];
			this.onLog(line);
		});
		worker.on('error', (error) => this.onWorkerGone(worker, `could not start (${error.message})`));
		worker.on('exit', (code, signal) =>
			this.onWorkerGone(worker, `stopped (${signal ?? `exit code ${code}`})`)
		);

		await this.ask(
			null,
			null,
			this.readyTimeoutMs,
			`loading the model took longer than ${this.readyTimeoutMs / 1000} s`
		);
	}

	/** Sends a request (or nothing, for the ready line) and waits for the answer to `id`. */
	private ask(
		id: string | null,
		request: object | null,
		timeoutMs: number,
		timeoutReason: string
	): Promise<WorkerAnswer> {
		return new Promise<WorkerAnswer>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.waiting = null;
				this.stopWorker();
				reject(new Error(`The local FLUX worker failed: ${timeoutReason}.`));
			}, timeoutMs);
			const settle =
				<T>(next: (value: T) => void) =>
				(value: T) => {
					clearTimeout(timer);
					this.waiting = null;
					next(value);
				};
			this.waiting = { id, waiter: { resolve: settle(resolve), reject: settle(reject) } };
			if (request) this.worker?.stdin?.write(`${JSON.stringify(request)}\n`);
		});
	}

	private onAnswer(line: string): void {
		let answer: WorkerAnswer;
		try {
			answer = JSON.parse(line) as WorkerAnswer;
		} catch {
			this.onLog(line);
			return;
		}
		const waiting = this.waiting;
		if (!waiting) return;
		const matches = waiting.id === null ? answer.ready === true : answer.id === waiting.id;
		if (matches) waiting.waiter.resolve(answer);
	}

	private onWorkerGone(worker: ChildProcess, how: string): void {
		if (this.worker !== worker) return;
		this.worker = null;
		this.ready = null;
		process.removeListener('exit', this.killOnExit);
		const tail = this.logTail.length ? ` Last log lines:\n${this.logTail.join('\n')}` : '';
		this.waiting?.waiter.reject(new Error(`The local FLUX worker ${how}.${tail}`));
	}

	private stopWorker(): void {
		const worker = this.worker;
		if (!worker) return;
		this.worker = null;
		this.ready = null;
		process.removeListener('exit', this.killOnExit);
		worker.stdin?.end();
		worker.kill();
	}

	private tempFolder(): Promise<string> {
		this.folder ??= this.options.tempDir
			? Promise.resolve(this.options.tempDir)
			: mkdtemp(join(tmpdir(), 'r2r-flux-'));
		return this.folder;
	}
}

/** The same prompt gives the same seed, so a recipe's picture can be made again. */
export function seedOf(prompt: string): number {
	return createHash('sha256').update(prompt).digest().readUInt32BE(0);
}
