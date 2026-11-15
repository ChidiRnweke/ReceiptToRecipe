import type { AgentToolbox, BasilTurnRunner, IAgentRunService, IAgentService } from '$services';
import type { Actor } from '$lib/models/household';
import {
	BasilBusyError,
	RESTARTED_REPLY,
	type ActionInput,
	type AgentRun,
	type BasilConversationView,
	type BasilDecisionReceipt,
	type BasilRunEventRecord,
	type BasilRunReceipt,
	type BasilRunRequest,
	type SendMessageInput
} from '$lib/models/agent';

/** Builds Basil's tools for one member at one moment, bound to that member. */
export type ToolboxFor = (actor: Actor, now: Date, timeZone: string) => AgentToolbox;

/**
 * Basil's sheet: the conversation, a message, yes or not now on a proposed change, Stop and
 * Start over. A message starts a run that executes in the background; a decision resumes the run
 * that proposed the change. The sheet follows the run's events.
 */
export class BasilController {
	constructor(
		private agentService: IAgentService,
		private runService: IAgentRunService,
		private toolboxFor: ToolboxFor
	) {}

	async getConversation(actor: Actor): Promise<BasilConversationView> {
		const conversation = await this.agentService.latestConversation(actor);
		if (!conversation) return { entries: [], pendingActionId: null, activeRun: null };
		const [view, activeRun] = await Promise.all([
			this.agentService.view(conversation.id),
			this.runService.activeRun(conversation.id)
		]);
		return { ...view, activeRun };
	}

	/**
	 * Stores the message and starts Basil's answer. A change still waiting for a yes is declined:
	 * the new message is the person's answer.
	 */
	async submit(
		actor: Actor,
		input: SendMessageInput,
		now: Date,
		timeZone: string
	): Promise<BasilRunReceipt> {
		const existing = await this.runService.findByRequest(actor, input.requestId);
		if (existing) return this.receipt(existing);
		const conversation = await this.agentService.conversationFor(actor, now);
		if (await this.runService.activeRun(conversation.id)) throw new BasilBusyError();
		await this.declineWaiting(conversation.id, now);
		return this.start(actor, {
			conversationId: conversation.id,
			requestId: input.requestId,
			request: { text: input.text, pageContext: input.pageContext },
			now,
			timeZone
		});
	}

	/**
	 * Yes or not now on the waiting change resumes the run that proposed it: yes runs the change,
	 * not now runs nothing, and Basil goes on. A change decided already, by another tap or tab,
	 * resumes nothing.
	 */
	async decide(
		actor: Actor,
		input: ActionInput,
		approve: boolean,
		now: Date
	): Promise<BasilDecisionReceipt> {
		const action = await this.agentService.pendingAction(actor, input.actionId);
		if (!action) return { runId: null, cursor: 0 };
		const parked = await this.runService.parkedRun(action.conversationId);
		// The run is the lock: whoever queues it again decides the change.
		const resumed = parked ? await this.runService.resume(parked.id, now) : null;
		if (!resumed) return { runId: null, cursor: 0 };
		await this.agentService.decide(action.id, approve, now);
		this.runService.launch(resumed.run, this.runner);
		return { runId: resumed.run.id, cursor: resumed.cursor };
	}

	/** Stop: Basil keeps what it had said. */
	async cancel(actor: Actor, runId: string, now: Date): Promise<void> {
		await this.runService.cancel(actor, runId, now);
	}

	/** A new, empty conversation. Refused while Basil is still answering. */
	async startOver(actor: Actor, now: Date): Promise<void> {
		const current = await this.agentService.latestConversation(actor);
		if (current && (await this.runService.activeRun(current.id))) throw new BasilBusyError();
		if (current) await this.declineWaiting(current.id, now);
		await this.agentService.startOver(actor, now);
	}

	/** Checks the run is the member's. Throws not found, or forbidden for another member's. */
	async openRun(actor: Actor, runId: string): Promise<void> {
		await this.runService.getRun(actor, runId);
	}

	listEvents(actor: Actor, runId: string, after: number): Promise<BasilRunEventRecord[]> {
		return this.runService.listEvents(actor, runId, after);
	}

	isStreamComplete(actor: Actor, runId: string, cursor: number): Promise<boolean> {
		return this.runService.isStreamComplete(actor, runId, cursor);
	}

	/** Calls the listener when the run has new events. Returns the unsubscribe. */
	watch(runId: string, listener: () => void): () => void {
		return this.runService.subscribe(runId, listener);
	}

	/**
	 * After a restart: interrupted runs say so in their conversation, and queued runs start
	 * again. Returns how many runs it touched.
	 */
	async recoverInterruptedRuns(now: Date): Promise<number> {
		const { interrupted, queued } = await this.runService.recover(now);
		for (const run of interrupted) {
			await this.agentService.say(run.conversationId, RESTARTED_REPLY, now);
		}
		for (const run of queued) this.runService.launch(run, this.runner);
		return interrupted.length + queued.length;
	}

	/** Settles the run waiting for a yes in the conversation, declining its change. */
	private async declineWaiting(conversationId: string, now: Date): Promise<void> {
		const parked = await this.runService.parkedRun(conversationId);
		const closed = parked ? await this.runService.close(parked.id, now) : null;
		if (!closed) return;
		const { actor, timeZone } = closed.input;
		await this.agentService.declineWaiting({
			toolbox: this.toolboxFor(actor, closed.createdAt, timeZone),
			run: closed,
			now
		});
	}

	private async start(
		actor: Actor,
		input: {
			conversationId: string;
			requestId: string;
			request: BasilRunRequest;
			now: Date;
			timeZone: string;
		}
	): Promise<BasilRunReceipt> {
		const { run, created, cursor } = await this.runService.submit(
			actor,
			{
				conversationId: input.conversationId,
				requestId: input.requestId,
				input: { request: input.request, actor, timeZone: input.timeZone },
				userMessage: input.request.text
			},
			input.now
		);
		if (created) this.runService.launch(run, this.runner);
		return { runId: run.id, cursor };
	}

	private receipt(run: AgentRun): BasilRunReceipt {
		return { runId: run.id, cursor: 0 };
	}

	/**
	 * One turn for a claimed run, as the member who asked, at the moment they asked: a resumed run
	 * reads the change's arguments as they were meant when it was proposed.
	 */
	private runner: BasilTurnRunner = (run, signal) => {
		const { actor, timeZone } = run.input;
		const now = run.createdAt;
		return this.agentService.turn({
			actor,
			toolbox: this.toolboxFor(actor, now, timeZone),
			run,
			now,
			signal
		});
	};
}
