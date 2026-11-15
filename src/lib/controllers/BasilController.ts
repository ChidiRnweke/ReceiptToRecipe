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
 * Start over. Every message and decision starts a run that executes in the background; the sheet
 * follows its events.
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

	/** Stores the message and starts Basil's answer. A change still waiting is dropped. */
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
		await this.agentService.dropPending(conversation.id, now);
		return this.start(actor, {
			conversationId: conversation.id,
			requestId: input.requestId,
			request: { kind: 'message', text: input.text, pageContext: input.pageContext },
			userMessage: input.text,
			now,
			timeZone
		});
	}

	/**
	 * Yes runs the waiting change, not now drops it; then a run lets Basil go on. A change decided
	 * already, by another tap or tab, starts nothing.
	 */
	async decide(
		actor: Actor,
		input: ActionInput,
		approve: boolean,
		now: Date,
		timeZone: string
	): Promise<BasilDecisionReceipt> {
		const existing = await this.runService.findByRequest(actor, input.requestId);
		if (existing) return this.receipt(existing);
		const decision = await this.agentService.decide(actor, this.toolboxFor(actor, now, timeZone), {
			actionId: input.actionId,
			approve,
			now
		});
		if (!decision.decided) return { runId: null, cursor: 0 };
		return this.start(actor, {
			conversationId: decision.conversationId,
			requestId: input.requestId,
			request: {
				kind: 'decision',
				actionId: input.actionId,
				decision: approve ? 'approve' : 'decline',
				staleDoors: decision.staleDoors,
				pageContext: input.pageContext ?? null
			},
			userMessage: null,
			now,
			timeZone
		});
	}

	/** Stop: Basil keeps what it had said. */
	async cancel(actor: Actor, runId: string, now: Date): Promise<void> {
		await this.runService.cancel(actor, runId, now);
	}

	/** A new, empty conversation. Refused while Basil is still answering. */
	async startOver(actor: Actor, now: Date): Promise<void> {
		const current = await this.agentService.latestConversation(actor);
		if (current && (await this.runService.activeRun(current.id))) throw new BasilBusyError();
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

	private async start(
		actor: Actor,
		input: {
			conversationId: string;
			requestId: string;
			request: BasilRunRequest;
			userMessage: string | null;
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
				userMessage: input.userMessage
			},
			input.now
		);
		if (created) this.runService.launch(run, this.runner);
		return { runId: run.id, cursor };
	}

	private receipt(run: AgentRun): BasilRunReceipt {
		return { runId: run.id, cursor: 0 };
	}

	/** One turn for a claimed run, as the member who asked, at the moment they asked. */
	private runner: BasilTurnRunner = (run, signal) => {
		const { actor, timeZone, request } = run.input;
		const now = run.createdAt;
		return this.agentService.turn({
			actor,
			toolbox: this.toolboxFor(actor, now, timeZone),
			conversationId: run.conversationId,
			request,
			now,
			signal
		});
	};
}
