import { EventEmitter } from 'node:events';

/**
 * Says "this run has new events". The events themselves are in Postgres; a listener reads them
 * from its cursor. This bus lives in one Node process, which is how the app runs (adapter-node).
 */
export interface IRunEventBus {
	notify(runId: string): void;
	/** Returns the unsubscribe. */
	subscribe(runId: string, listener: () => void): () => void;
}

export class InProcessRunEventBus implements IRunEventBus {
	private readonly emitter = new EventEmitter();

	constructor() {
		this.emitter.setMaxListeners(0);
	}

	notify(runId: string): void {
		this.emitter.emit(runId);
	}

	subscribe(runId: string, listener: () => void): () => void {
		this.emitter.on(runId, listener);
		return () => {
			this.emitter.off(runId, listener);
		};
	}
}
