import {
	Agent,
	MaxTurnsExceededError,
	RunState,
	Runner,
	type ModelProvider,
	type RunToolApprovalItem
} from '@openai/agents';
import type {
	IAgentActionRepository,
	IAgentConversationRepository,
	IAgentMessageRepository,
	IAgentSessionRepository
} from '$repositories';
import type { Actor } from '$lib/models/household';
import type {
	AgentAction,
	AgentConversation,
	AgentRun,
	AgentToolCall,
	BasilConversationView,
	BasilTurnEvent,
	PageContext
} from '$lib/models/agent';
import { toolLabel } from '$lib/models/agent';
import type { BasilTurnInput, BasilTurnOutcome, IAgentService } from '../interfaces/IAgentService';
import { basilSystemPrompt, pageContextBlock } from './prompt';
import { buildConversationView } from './conversationView';
import { toolFailure, type AgentToolbox } from './toolbox';
import { basilTools, CallLedger } from './basilTools';
import { ConversationSession } from './session';
import { functionCall, readStreamEvent, type StreamedCall } from './streamEvents';

/** A run calls the model at most this many times, so a model that keeps calling tools stops. */
export const MAX_TURNS = 8;

export const STEP_LIMIT_REPLY =
	'I went round in circles on that one. Could you put it another way?';
export const MODEL_DOWN_REPLY = 'I couldn’t think that through just now. Try again in a moment.';
/** Said when something unexpected stopped a turn. */
export const BROKE_REPLY = 'Something went wrong on my side. Try asking again.';
/** Said when the model answered with nothing at all. */
export const LOST_REPLY = 'Sorry, I lost my train of thought.';

/** What the model reads back for a change the person said not now to. */
const DECLINED = JSON.stringify({
	declined: true,
	note: 'The person said not now. Nothing changed. Reply briefly, for example "No problem."'
});
/** For a change the person answered by sending a new message instead. */
const MOVED_ON = JSON.stringify({
	declined: true,
	note: 'The person sent a new message instead of answering. Nothing changed.'
});
/** For a second change proposed while the first one waits; only one card is shown at a time. */
const ONE_CHANGE = JSON.stringify(
	toolFailure(
		'Only one change can wait for a yes at a time.',
		'Propose this change again after the person has answered the first one.'
	)
);

/** One turn's running state. */
interface Turn {
	run: AgentRun;
	toolbox: AgentToolbox;
	now: Date;
	ledger: CallLedger;
	/** Basil's words since its last tool call, not yet in the conversation. */
	words: string;
	/** The tool each call of the run named. */
	called: Map<string, string>;
}

/**
 * Basil's agent, on the OpenAI Agents SDK. A run hands the person's message to the SDK's runner,
 * which calls the model and the tools until the model answers in words; its words stream as
 * they come. Reads and proposals run at once. A change needs a yes: the run parks with the SDK's
 * serialized state and an approval card, and the person's yes or not now resumes the same run
 * from that state, approving or rejecting the call.
 *
 * The model reads the conversation from the SDK session; the sheet shows the conversation's
 * messages and actions, written as the run goes.
 */
export class AgentService implements IAgentService {
	private runner: Runner;

	constructor(
		private conversations: IAgentConversationRepository,
		private messages: IAgentMessageRepository,
		private sessions: IAgentSessionRepository,
		private actions: IAgentActionRepository,
		models: ModelProvider,
		private model: string
	) {
		this.runner = new Runner({ modelProvider: models, tracingDisabled: true });
	}

	latestConversation(actor: Actor): Promise<AgentConversation | null> {
		return this.conversations.findLatest(actor.householdId, actor.userId);
	}

	async conversationFor(actor: Actor, now: Date): Promise<AgentConversation> {
		return (
			(await this.latestConversation(actor)) ??
			(await this.conversations.create(actor.householdId, actor.userId, now))
		);
	}

	startOver(actor: Actor, now: Date): Promise<AgentConversation> {
		return this.conversations.create(actor.householdId, actor.userId, now);
	}

	async view(conversationId: string): Promise<Omit<BasilConversationView, 'activeRun'>> {
		const [messages, actions] = await Promise.all([
			this.messages.list(conversationId),
			this.actions.list(conversationId)
		]);
		return buildConversationView(messages, actions);
	}

	async pendingAction(actor: Actor, actionId: string): Promise<AgentAction | null> {
		const action = await this.actions.findById(actionId);
		const conversation = action ? await this.conversations.findById(action.conversationId) : null;
		if (
			!action ||
			!conversation ||
			conversation.householdId !== actor.householdId ||
			conversation.userId !== actor.userId
		) {
			throw new Error('Action not found');
		}
		return action.status === 'pending' ? action : null;
	}

	async decide(actionId: string, approve: boolean, now: Date): Promise<boolean> {
		const decided = await this.actions.decide(actionId, 'pending', {
			status: approve ? 'approved' : 'declined',
			decidedAt: now
		});
		return decided !== null;
	}

	async declineWaiting(input: { toolbox: AgentToolbox; run: AgentRun; now: Date }): Promise<void> {
		const { run, now } = input;
		for (const action of await this.actions.list(run.conversationId)) {
			if (action.status !== 'pending') continue;
			await this.actions.decide(action.id, 'pending', { status: 'declined', decidedAt: now });
		}
		const session = new ConversationSession(this.sessions, run.conversationId);
		try {
			if (!run.serializedState) throw new Error(`Run ${run.id} is parked without its state`);
			// Stops at the rejected call's result, so the model is not asked anything: the new
			// message is the person's answer, and its own run replies to it.
			const agent = this.agent(input.toolbox, run, now, new CallLedger(), 'stop_on_first_tool');
			const state = await RunState.fromString(agent, run.serializedState);
			for (const item of state.getInterruptions()) state.reject(item, { message: MOVED_ON });
			const stream = await this.runner.run(agent, state, { stream: true, session });
			for await (const event of stream) void event;
			await stream.completed;
			await session.save(await session.snapshot(), now);
		} catch (error) {
			// The waiting call is dropped from what the model reads, so the next run can go on.
			console.error(`[basil] could not decline the change run ${run.id} waits on`, error);
			await session.save(await session.settled(''), now);
		}
	}

	async say(conversationId: string, text: string, now: Date): Promise<void> {
		await this.messages.append(conversationId, { role: 'assistant', text, toolCalls: [] }, now);
	}

	async *turn(input: BasilTurnInput): AsyncGenerator<BasilTurnEvent, BasilTurnOutcome> {
		const turn: Turn = {
			run: input.run,
			toolbox: input.toolbox,
			now: input.now,
			ledger: new CallLedger(),
			words: '',
			called: new Map()
		};
		const session = new ConversationSession(this.sessions, turn.run.conversationId);
		try {
			return yield* this.answer(turn, session, input.signal);
		} catch (error) {
			console.error('[basil] a turn failed', error);
			await this.say(turn.run.conversationId, BROKE_REPLY, turn.now);
			return { status: 'failed', message: BROKE_REPLY, retryable: false };
		}
	}

	/** Runs the agent, or resumes it after a decision, and streams what it does. */
	private async *answer(
		turn: Turn,
		session: ConversationSession,
		signal: AbortSignal
	): AsyncGenerator<BasilTurnEvent, BasilTurnOutcome> {
		const agent = this.agent(turn.toolbox, turn.run, turn.now, turn.ledger);
		const input = turn.run.serializedState
			? await this.resumed(agent, turn.run)
			: turn.run.input.request.text;
		let finalOutput = '';
		let interruptions: RunToolApprovalItem[] = [];
		let serializedState = '';
		// The SDK asks the model again when it answers with nothing, up to the turn limit; Basil
		// stops at the first empty answer and apologises instead.
		const silence = new AbortController();
		try {
			const stream = await this.runner.run(agent, input, {
				stream: true,
				session,
				maxTurns: MAX_TURNS,
				signal: AbortSignal.any([signal, silence.signal]),
				toolNotFoundBehavior: 'return_error_to_model',
				toolErrorFormatter: ({ kind, toolName }) =>
					kind === 'tool_not_found'
						? JSON.stringify(
								toolFailure(
									`There is no tool called ${toolName}.`,
									'Use one of the tools you have.'
								)
							)
						: undefined
			});
			let proposed = false;
			for await (const raw of stream) {
				const event = readStreamEvent(raw);
				switch (event.type) {
					case 'text':
						turn.words += event.text;
						yield { type: 'text_delta', text: event.text };
						break;
					case 'tool_called':
						turn.called.set(event.call.callId, event.call.name);
						// The words before a tool are stored with its call, so the sheet shows them while
						// the tool runs and a change's card follows them.
						await this.keepWords(turn, event.call);
						yield {
							type: 'tool_started',
							callId: event.call.callId,
							name: event.call.name,
							label: toolLabel(event.call.name)
						};
						break;
					case 'approval_requested':
						// Only the first change gets a card; any other waits rejected (ONE_CHANGE).
						yield {
							type: 'tool_finished',
							callId: event.call.callId,
							name: event.call.name,
							ok: !proposed
						};
						proposed = true;
						break;
					case 'tool_output':
						yield* this.toolOutput(turn, event.callId);
						break;
					case 'empty_response':
						silence.abort();
						break;
					case 'ignored':
						break;
				}
			}
			await stream.completed;
			if (silence.signal.aborted && !signal.aborted) return yield* this.lost(turn, session);
			interruptions = stream.interruptions;
			if (interruptions.length) serializedState = stream.state.toString();
			else finalOutput = typeof stream.finalOutput === 'string' ? stream.finalOutput : '';
		} catch (error) {
			if (signal.aborted) return this.stopped(turn, session);
			if (silence.signal.aborted) return yield* this.lost(turn, session);
			if (error instanceof MaxTurnsExceededError) {
				await this.keepWords(turn);
				await session.save(await session.settled(''), turn.now);
				await this.say(turn.run.conversationId, STEP_LIMIT_REPLY, turn.now);
				return { status: 'completed' };
			}
			console.error('[basil] the model call failed', error);
			await this.keepWords(turn);
			await session.save(await session.settled(''), turn.now);
			await this.say(turn.run.conversationId, MODEL_DOWN_REPLY, turn.now);
			return { status: 'failed', message: MODEL_DOWN_REPLY, retryable: true };
		}
		if (signal.aborted) return this.stopped(turn, session);

		if (interruptions.length) {
			await session.save(await session.snapshot(), turn.now);
			const action = await this.propose(turn, interruptions[0]);
			// Last, so the card is the final thing the run says.
			yield { type: 'approval_required', action: { id: action.id, summary: action.summary } };
			return { status: 'awaiting_approval', serializedState };
		}

		if (!finalOutput.trim()) return yield* this.lost(turn, session);
		await session.save(await session.snapshot(), turn.now);
		await this.keepWords(turn);
		return { status: 'completed' };
	}

	/**
	 * The model answered with nothing, as gemini-2.5-flash-lite sometimes does after a tool's
	 * result: Basil says so, so a run never ends in silence.
	 */
	private async *lost(
		turn: Turn,
		session: ConversationSession
	): AsyncGenerator<BasilTurnEvent, BasilTurnOutcome> {
		turn.words += turn.words.trim() ? ` ${LOST_REPLY}` : LOST_REPLY;
		yield { type: 'text_delta', text: LOST_REPLY };
		await session.save(await session.settled(turn.words), turn.now);
		await this.keepWords(turn);
		return { status: 'completed' };
	}

	/** Reports a call's result: whether it worked, a browser step, and what a change did. */
	private async *toolOutput(turn: Turn, callId: string): AsyncGenerator<BasilTurnEvent> {
		const outcome = turn.ledger.outcomes.get(callId);
		const action = await this.actions.findByCall(turn.run.conversationId, callId);
		const tool = action ? turn.toolbox.find((candidate) => candidate.name === action.tool) : null;
		const name = turn.called.get(callId) ?? action?.tool ?? '';
		yield { type: 'tool_finished', callId, name, ok: outcome?.ok ?? false };
		if (outcome?.ok && outcome.value.clientAction) {
			yield { type: 'client_action', action: outcome.value.clientAction };
		}
		if (!action || action.status !== 'approved') return;
		// The approved change ran: the card says what it touched, and the doors refresh.
		if (outcome?.ok) {
			await this.actions.decide(action.id, 'approved', {
				status: 'executed',
				result: outcome.value.result,
				touched: outcome.value.touched,
				decidedAt: turn.now
			});
			yield { type: 'resources_stale', doors: [...(tool?.doors ?? [])] };
		} else {
			await this.actions.decide(action.id, 'approved', {
				status: 'failed',
				result: outcome ? outcome.failure : null,
				decidedAt: turn.now
			});
		}
	}

	/** Stores the first waiting change as the action its card shows. */
	private async propose(turn: Turn, item: RunToolApprovalItem): Promise<AgentAction> {
		const call = functionCall(item);
		if (!call) throw new Error('The run waits on a call that is not a function call');
		const tool = turn.toolbox.find((candidate) => candidate.name === call.name);
		return this.actions.create(
			{
				conversationId: turn.run.conversationId,
				callId: call.callId,
				tool: call.name,
				args: parseArguments(call.arguments),
				summary: turn.ledger.summaries.get(call.callId) ?? tool?.description ?? call.name
			},
			turn.now
		);
	}

	/**
	 * The parked run's state with the person's answer applied: yes approves the carded call, not
	 * now rejects it, and any other change proposed alongside it is rejected as one too many.
	 */
	private async resumed(agent: Agent, run: AgentRun): Promise<RunState<unknown, Agent>> {
		if (!run.serializedState) throw new Error(`Run ${run.id} resumes without its state`);
		const state = await RunState.fromString(agent, run.serializedState);
		for (const item of state.getInterruptions()) {
			const call = functionCall(item);
			const action = call ? await this.actions.findByCall(run.conversationId, call.callId) : null;
			if (action?.status === 'approved') state.approve(item);
			else state.reject(item, { message: action ? DECLINED : ONE_CHANGE });
		}
		return state;
	}

	/** Stop: what Basil had said stays as its reply, for the sheet and for the model. */
	private async stopped(turn: Turn, session: ConversationSession): Promise<BasilTurnOutcome> {
		await session.save(await session.settled(turn.words), turn.now);
		await this.keepWords(turn);
		return { status: 'cancelled' };
	}

	/** Writes Basil's words so far to the conversation, with the call they came with. */
	private async keepWords(turn: Turn, call?: StreamedCall): Promise<void> {
		const text = turn.words.trim();
		turn.words = '';
		if (!text && !call) return;
		const toolCalls: AgentToolCall[] = call
			? [{ id: call.callId, name: call.name, arguments: call.arguments }]
			: [];
		await this.messages.append(
			turn.run.conversationId,
			{ role: 'assistant', text: text || null, toolCalls },
			turn.now
		);
	}

	private agent(
		toolbox: AgentToolbox,
		run: AgentRun,
		now: Date,
		ledger: CallLedger,
		toolUseBehavior: 'run_llm_again' | 'stop_on_first_tool' = 'run_llm_again'
	): Agent {
		const { actor } = run.input;
		return new Agent({
			name: 'Basil',
			model: this.model,
			instructions: instructions(actor, now, run.input.request.pageContext),
			tools: basilTools(toolbox, ledger),
			modelSettings: { temperature: 0.3 },
			toolUseBehavior
		});
	}
}

function instructions(actor: Actor, now: Date, pageContext: PageContext | null): string {
	const prompt = basilSystemPrompt({
		firstName: actor.displayName.split(/\s+/)[0] || actor.displayName,
		now,
		timeZone: actor.timeZone
	});
	return `${prompt}\n\n${pageContextBlock(pageContext)}`;
}

/** The model's arguments as a value, for the stored action; `{}` when they are not JSON. */
function parseArguments(text: string): unknown {
	if (!text.trim()) return {};
	try {
		return JSON.parse(text);
	} catch {
		return {};
	}
}
