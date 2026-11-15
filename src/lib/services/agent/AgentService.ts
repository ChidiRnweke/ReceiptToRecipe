import type {
	IAgentActionRepository,
	IAgentConversationRepository,
	IAgentMessageRepository
} from '$repositories';
import type { Actor } from '$lib/models/household';
import type {
	AgentAction,
	AgentConversation,
	AgentMessage,
	AgentToolCall,
	BasilConversationView,
	BasilTurnEvent,
	PageContext
} from '$lib/models/agent';
import { toolLabel } from '$lib/models/agent';
import type { AgentModelMessage, AgentModelTool, IAgentModel } from '../interfaces/IAgentModel';
import type {
	BasilDecision,
	BasilTurnInput,
	BasilTurnOutcome,
	IAgentService
} from '../interfaces/IAgentService';
import { basilSystemPrompt, pageContextBlock } from './prompt';
import { buildConversationView } from './conversationView';
import { toolFailure, type AgentTool, type AgentToolbox } from './toolbox';

/** A turn calls the model at most this many times, so a model that keeps calling tools stops. */
export const MAX_STEPS = 8;
/** The model reads this many of the latest messages, starting at a message from the person. */
const HISTORY_MESSAGES = 40;

export const STEP_LIMIT_REPLY =
	'I went round in circles on that one. Could you put it another way?';
export const MODEL_DOWN_REPLY = 'I couldn’t think that through just now. Try again in a moment.';

const DECLINED_RESULT = {
	declined: true,
	note: 'The person said not now. Nothing changed. Reply briefly, for example "No problem."'
};
const MOVED_ON_RESULT = {
	declined: true,
	note: 'The person sent a new message instead of answering. Nothing changed.'
};
const ONE_CHANGE = toolFailure(
	'Only one change can wait for a yes at a time.',
	'Propose this change again after the person has answered the first one.'
);

/** Said when something unexpected stopped a turn. */
export const BROKE_REPLY = 'Something went wrong on my side. Try asking again.';
const LOST_REPLY = 'Sorry, I lost my train of thought.';

/** One turn's running state. */
interface Turn {
	actor: Actor;
	conversationId: string;
	toolbox: AgentToolbox;
	now: Date;
	pageContext: PageContext | null;
	signal: AbortSignal;
}

/**
 * Basil's loop. A turn sends the conversation to the model and streams its words; reads and
 * proposals run at once and their results go back to the model; a change is stored as a pending
 * action and the turn ends with an approval card. Approving runs the change, and the next turn
 * lets the model go on; declining runs nothing.
 *
 * Nothing about a turn lives outside the conversation's messages and actions, so any turn can
 * be rebuilt from them.
 */
export class AgentService implements IAgentService {
	constructor(
		private conversations: IAgentConversationRepository,
		private messages: IAgentMessageRepository,
		private actions: IAgentActionRepository,
		private model: IAgentModel
	) {}

	latestConversation(actor: Actor): Promise<AgentConversation | null> {
		return this.conversations.findLatest(actor.householdId, actor.userId);
	}

	async conversationFor(actor: Actor, now: Date): Promise<AgentConversation> {
		return (
			(await this.latestConversation(actor)) ??
			(await this.conversations.create(actor.householdId, actor.userId, now))
		);
	}

	async startOver(actor: Actor, now: Date): Promise<AgentConversation> {
		const current = await this.latestConversation(actor);
		if (current) await this.dropPending(current.id, now);
		return this.conversations.create(actor.householdId, actor.userId, now);
	}

	async view(conversationId: string): Promise<Omit<BasilConversationView, 'activeRun'>> {
		const [messages, actions] = await Promise.all([
			this.messages.list(conversationId),
			this.actions.list(conversationId)
		]);
		return buildConversationView(messages, actions);
	}

	async dropPending(conversationId: string, now: Date): Promise<void> {
		for (const action of await this.actions.list(conversationId)) {
			if (action.status !== 'pending') continue;
			const declined = await this.actions.decide(action.id, 'pending', {
				status: 'declined',
				decidedAt: now
			});
			if (declined) await this.appendToolResult(conversationId, action, MOVED_ON_RESULT, now);
		}
	}

	async decide(
		actor: Actor,
		toolbox: AgentToolbox,
		input: { actionId: string; approve: boolean; now: Date }
	): Promise<BasilDecision> {
		const { conversation, action } = await this.ownAction(actor, input.actionId);
		const undecided = { conversationId: conversation.id, decided: false, staleDoors: [] };
		if (!input.approve) {
			const declined = await this.actions.decide(action.id, 'pending', {
				status: 'declined',
				decidedAt: input.now
			});
			if (!declined) return undecided;
			await this.appendToolResult(conversation.id, action, DECLINED_RESULT, input.now);
			return { ...undecided, decided: true };
		}

		const approved = await this.actions.decide(action.id, 'pending', {
			status: 'approved',
			decidedAt: input.now
		});
		// Decided already, by another tap or another tab.
		if (!approved) return undecided;

		const tool = toolbox.find((candidate) => candidate.name === action.tool);
		const outcome = tool
			? await tool.execute(action.args)
			: {
					ok: false as const,
					failure: toolFailure(`Unknown tool ${action.tool}.`, 'Use one of the tools you have.')
				};
		if (!outcome.ok) {
			await this.actions.decide(action.id, 'approved', {
				status: 'failed',
				result: outcome.failure,
				decidedAt: input.now
			});
			await this.appendToolResult(conversation.id, action, outcome.failure, input.now);
			return { ...undecided, decided: true };
		}
		await this.actions.decide(action.id, 'approved', {
			status: 'executed',
			result: outcome.value.result,
			touched: outcome.value.touched,
			decidedAt: input.now
		});
		await this.appendToolResult(conversation.id, action, outcome.value.result, input.now);
		return { conversationId: conversation.id, decided: true, staleDoors: [...(tool?.doors ?? [])] };
	}

	async say(conversationId: string, text: string, now: Date): Promise<void> {
		await this.messages.append(conversationId, { role: 'assistant', text, toolCalls: [] }, now);
	}

	async *turn(input: BasilTurnInput): AsyncGenerator<BasilTurnEvent, BasilTurnOutcome> {
		const turn: Turn = {
			actor: input.actor,
			conversationId: input.conversationId,
			toolbox: input.toolbox,
			now: input.now,
			pageContext: input.request.pageContext,
			signal: input.signal
		};
		try {
			if (input.request.kind === 'decision' && input.request.staleDoors.length) {
				yield { type: 'resources_stale', doors: input.request.staleDoors };
			}
			return yield* this.loop(turn);
		} catch (error) {
			console.error('[basil] a turn failed', error);
			await this.say(turn.conversationId, BROKE_REPLY, turn.now);
			return { status: 'failed', message: BROKE_REPLY, retryable: false };
		}
	}

	/** Calls the model until it answers in words, asks for a yes, or runs out of steps. */
	private async *loop(turn: Turn): AsyncGenerator<BasilTurnEvent, BasilTurnOutcome> {
		const offered: AgentModelTool[] = turn.toolbox.map((tool) => ({
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters
		}));
		for (let step = 0; step < MAX_STEPS; step++) {
			if (turn.signal.aborted) return { status: 'cancelled' };
			const history = await this.messages.list(turn.conversationId);
			let text = '';
			let toolCalls: AgentToolCall[] = [];
			try {
				const stream = this.model.stream(
					{ messages: this.prompt(turn, history), tools: offered },
					turn.signal
				);
				for await (const delta of stream) {
					if (turn.signal.aborted) break;
					if (delta.type === 'text') {
						text += delta.text;
						yield { type: 'text_delta', text: delta.text };
					} else {
						toolCalls = delta.calls;
					}
				}
			} catch (error) {
				if (!turn.signal.aborted) {
					console.error('[basil] the model call failed', error);
					await this.keepPartial(turn, text);
					await this.say(turn.conversationId, MODEL_DOWN_REPLY, turn.now);
					return { status: 'failed', message: MODEL_DOWN_REPLY, retryable: true };
				}
			}
			if (turn.signal.aborted) {
				// What Basil had said when the person tapped Stop stays as its reply.
				await this.keepPartial(turn, text);
				return { status: 'cancelled' };
			}

			if (toolCalls.length === 0) {
				await this.say(turn.conversationId, text.trim() || LOST_REPLY, turn.now);
				return { status: 'completed' };
			}
			await this.messages.append(
				turn.conversationId,
				{ role: 'assistant', text: text.trim() || null, toolCalls },
				turn.now
			);
			const waiting = yield* this.callTools(turn, toolCalls);
			if (waiting) return { status: 'awaiting_approval' };
		}
		await this.say(turn.conversationId, STEP_LIMIT_REPLY, turn.now);
		return { status: 'completed' };
	}

	private async keepPartial(turn: Turn, text: string): Promise<void> {
		if (text.trim()) await this.say(turn.conversationId, text.trim(), turn.now);
	}

	/**
	 * Runs one reply's tool calls in order. Returns true when a change now waits for a yes, which
	 * ends the turn.
	 */
	private async *callTools(
		turn: Turn,
		calls: AgentToolCall[]
	): AsyncGenerator<BasilTurnEvent, boolean> {
		let proposed: { id: string; summary: string } | null = null;
		for (const call of calls) {
			const tool = turn.toolbox.find((candidate) => candidate.name === call.name);
			const args = parseArguments(call.arguments);
			if (!tool) {
				await this.toolResult(
					turn,
					call,
					toolFailure(`There is no tool called ${call.name}.`, 'Use one of the tools you have.')
				);
				continue;
			}
			if (args === undefined) {
				await this.toolResult(
					turn,
					call,
					toolFailure(
						'The arguments were not valid JSON.',
						'Send the arguments as one JSON object.'
					)
				);
				continue;
			}
			if (tool.classification === 'mutation' && proposed) {
				await this.toolResult(turn, call, ONE_CHANGE);
				continue;
			}
			yield { type: 'tool_started', callId: call.id, name: call.name, label: toolLabel(call.name) };
			if (tool.classification === 'mutation') {
				proposed = await this.propose(turn, tool, call, args);
				yield { type: 'tool_finished', callId: call.id, name: call.name, ok: proposed !== null };
				continue;
			}
			const outcome = await tool.execute(args);
			yield { type: 'tool_finished', callId: call.id, name: call.name, ok: outcome.ok };
			if (outcome.ok) {
				if (outcome.value.clientAction) {
					yield { type: 'client_action', action: outcome.value.clientAction };
				}
				await this.toolResult(turn, call, outcome.value.result);
			} else {
				await this.toolResult(turn, call, outcome.failure);
			}
		}
		// Last, so the card is the final thing the run says.
		if (proposed) yield { type: 'approval_required', action: proposed };
		return proposed !== null;
	}

	/** Stores a change as pending, after its preview checked it can happen. */
	private async propose(
		turn: Turn,
		tool: AgentTool,
		call: AgentToolCall,
		args: unknown
	): Promise<{ id: string; summary: string } | null> {
		const preview = await tool.preview(args);
		if (!preview.ok) {
			await this.toolResult(turn, call, preview.failure);
			return null;
		}
		const action = await this.actions.create(
			{
				conversationId: turn.conversationId,
				callId: call.id,
				tool: tool.name,
				args,
				summary: preview.value
			},
			turn.now
		);
		return { id: action.id, summary: action.summary };
	}

	private prompt(turn: Turn, history: AgentMessage[]): AgentModelMessage[] {
		return [
			{
				role: 'system',
				content: basilSystemPrompt({
					firstName: turn.actor.displayName.split(/\s+/)[0] || turn.actor.displayName,
					now: turn.now,
					timeZone: turn.actor.timeZone
				})
			},
			{ role: 'system', content: pageContextBlock(turn.pageContext) },
			...window(history).map(toModelMessage)
		];
	}

	private async toolResult(turn: Turn, call: AgentToolCall, result: unknown): Promise<void> {
		await this.messages.append(
			turn.conversationId,
			{ role: 'tool', callId: call.id, name: call.name, result },
			turn.now
		);
	}

	private async appendToolResult(
		conversationId: string,
		action: AgentAction,
		result: unknown,
		at: Date
	): Promise<void> {
		await this.messages.append(
			conversationId,
			{ role: 'tool', callId: action.callId, name: action.tool, result },
			at
		);
	}

	/** The action and its conversation, when both belong to this member. */
	private async ownAction(
		actor: Actor,
		actionId: string
	): Promise<{ conversation: AgentConversation; action: AgentAction }> {
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
		return { conversation, action };
	}
}

/** The model's arguments as a value; undefined when they are not JSON. Empty text is `{}`. */
function parseArguments(text: string): unknown {
	if (!text.trim()) return {};
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

/** The latest messages, cut at a message from the person so no tool result loses its call. */
function window(history: AgentMessage[]): AgentMessage[] {
	if (history.length <= HISTORY_MESSAGES) return history;
	const tail = history.slice(-HISTORY_MESSAGES);
	const start = tail.findIndex((message) => message.role === 'user');
	return start >= 0 ? tail.slice(start) : tail;
}

function toModelMessage(message: AgentMessage): AgentModelMessage {
	switch (message.role) {
		case 'user':
			return { role: 'user', content: message.text };
		case 'assistant':
			return { role: 'assistant', content: message.text, toolCalls: message.toolCalls };
		case 'tool':
			return {
				role: 'tool',
				toolCallId: message.callId,
				content: JSON.stringify(message.result ?? null)
			};
	}
}
