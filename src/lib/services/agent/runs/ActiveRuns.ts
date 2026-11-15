/**
 * The runs executing in this process, with the abort controller each one watches.
 *
 * Cancelling is durable in the database, but stopping the work needs the controller, which only
 * exists where the run started. A run that started before a restart is not here, and cancelling
 * settles its row directly.
 */
export class ActiveRuns {
	private readonly running = new Map<
		string,
		{ controller: AbortController; done: Promise<void> }
	>();

	/** Claims the slot for a run and returns the controller its execution watches. */
	register(runId: string): AbortController {
		const controller = new AbortController();
		this.running.set(runId, { controller, done: Promise.resolve() });
		return controller;
	}

	/** Records the promise that settles when the run's execution ends. */
	track(runId: string, controller: AbortController, done: Promise<void>): void {
		const entry = this.running.get(runId);
		if (entry?.controller === controller) entry.done = done;
	}

	/** Aborts the run if it executes here. Returns whether there was anything to abort. */
	abort(runId: string): boolean {
		const entry = this.running.get(runId);
		if (!entry) return false;
		entry.controller.abort();
		return true;
	}

	/** Only the execution that owns the slot releases it. */
	release(runId: string, controller: AbortController): void {
		if (this.running.get(runId)?.controller === controller) this.running.delete(runId);
	}

	/** Resolves once every run executing now has ended. */
	async idle(): Promise<void> {
		while (this.running.size) {
			await Promise.all([...this.running.values()].map((entry) => entry.done));
		}
	}
}
