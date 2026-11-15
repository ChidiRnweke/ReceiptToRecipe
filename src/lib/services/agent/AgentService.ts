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
	BasilDoor,
	BasilTurnResult,
	ClientAction,
	PageContext
} from '$lib/models/agent';
import type { AgentModelMessage, AgentModelTool, IAgentModel } from '../interfaces/IAgentModel';
import type { IAgentService } from '../interfaces/IAgentService';
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

/** One turn's running state. */
interface Turn {
	actor: Actor;
	conversation: AgentConversation;
	toolbox: AgentToolbox;
	now: Date;
	pageContext: PageContext | null;
	clientActions: ClientAction[];
	staleDoors: Set<BasilDoor>;
}

/**
 * Basil's loop. A turn sends the conversation to the model; reads and proposals run at once and
 * their results go back to the model; a change is stored as a pending action and the turn ends
 * with an approval card. Approving runs the change and lets the model go on; declining runs
 * nothing.
 */
export class AgentService implements IAgentService {
	constructor(
		private conversations: IAgentConversationRepository,
		private messages: IAgentMessageRepository,
		private actions: IAgentActionRepository,
		private model: IAgentModel
	) {}

	async getConversation(actor: Actor): Promise<BasilConversationView> {
		const conversation = await this.conversations.findLatest(actor.householdId, actor.userId);
		if (!conversation) return { entries: [], pendingActionId: null };
		return this.view(conversation.id);
	}

	async sendMessage(
		actor: Actor,
		toolbox: AgentToolbox,
		input: { text: string; pageContext: PageContext | null; now: Date }
	): Promise<BasilTurnResult> {
		const conversation =
			(await this.conversations.findLatest(actor.householdId, actor.userId)) ??
			(await this.conversations.create(actor.householdId, actor.userId, input.now));
		// A change still waiting for a yes is dropped: the person moved on.
		for (const action of await this.actions.list(conversation.id)) {
			if (action.status !== 'pending') continue;
			const declined = await this.actions.decide(action.id, 'pending', {
				status: 'declined',
				decidedAt: input.now
			});
			if (declined)
				await this.appendToolResult(conversation.id, action, MOVED_ON_RESULT, input.now);
		}
		await this.messages.append(conversation.id, { role: 'user', text: input.text }, input.now);
		return this.run({
			actor,
			conversation,
			toolbox,
			now: input.now,
			pageContext: input.pageContext,
			clientActions: [],
			staleDoors: new Set()
		});
	}

	async approveAction(
		actor: Actor,
		toolbox: AgentToolbox,
		input: { actionId: string; pageContext: PageContext | null; now: Date }
	): Promise<BasilTurnResult> {
		const { conversation, action } = await this.ownAction(actor, input.actionId);
		const turn: Turn = {
			actor,
			conversation,
			toolbox,
			now: input.now,
			pageContext: input.pageContext,
			clientActions: [],
			staleDoors: new Set()
		};
		const approved = await this.actions.decide(action.id, 'pending', {
			status: 'approved',
			decidedAt: input.now
		});
		// Decided already, by another tap or another tab: show the conversation as it is.
		if (!approved) return this.result(turn);

		const tool = toolbox.find((candidate) => candidate.name === action.tool);
		const outcome = tool
			? await tool.execute(action.args)
			: {
					ok: false as const,
					failure: toolFailure(`Unknown tool ${action.tool}.`, 'Use one of the tools you have.')
				};
		if (outcome.ok) {
			await this.actions.decide(action.id, 'approved', {
				status: 'executed',
				result: outcome.value.result,
				touched: outcome.value.touched,
				decidedAt: input.now
			});
			for (const door of tool?.doors ?? []) turn.staleDoors.add(door);
			await this.appendToolResult(conversation.id, action, outcome.value.result, input.now);
		} else {
			await this.actions.decide(action.id, 'approved', {
				status: 'failed',
				result: outcome.failure,
				decidedAt: input.now
			});
			await this.appendToolResult(conversation.id, action, outcome.failure, input.now);
		}
		return this.run(turn);
	}

	async declineAction(
		actor: Actor,
		toolbox: AgentToolbox,
		input: { actionId: string; pageContext: PageContext | null; now: Date }
	): Promise<BasilTurnResult> {
		const { conversation, action } = await this.ownAction(actor, input.actionId);
		const turn: Turn = {
			actor,
			conversation,
			toolbox,
			now: input.now,
			pageContext: input.pageContext,
			clientActions: [],
			staleDoors: new Set()
		};
		const declined = await this.actions.decide(action.id, 'pending', {
			status: 'declined',
			decidedAt: input.now
		});
		if (!declined) return this.result(turn);
		await this.appendToolResult(conversation.id, action, DECLINED_RESULT, input.now);
		return this.run(turn);
	}

	/** Calls the model until it answers in words, asks for a yes, or runs out of steps. */
	private async run(turn: Turn): Promise<BasilTurnResult> {
		const offered: AgentModelTool[] = turn.toolbox.map((tool) => ({
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters
		}));
		for (let step = 0; step < MAX_STEPS; step++) {
			const history = await this.messages.list(turn.conversation.id);
			let reply;
			try {
				reply = await this.model.complete({ messages: this.prompt(turn, history), tools: offered });
			} catch (error) {
				console.error('[basil] the model call failed', error);
				await this.say(turn, MODEL_DOWN_REPLY);
				return this.result(turn);
			}

			if (reply.toolCalls.length === 0) {
				await this.say(turn, reply.text?.trim() || 'Sorry, I lost my train of thought.');
				return this.result(turn);
			}
			await this.messages.append(
				turn.conversation.id,
				{ role: 'assistant', text: reply.text?.trim() || null, toolCalls: reply.toolCalls },
				turn.now
			);
			const waiting = await this.callTools(turn, reply.toolCalls);
			if (waiting) return this.result(turn);
		}
		await this.say(turn, STEP_LIMIT_REPLY);
		return this.result(turn);
	}

	/**
	 * Runs one reply's tool calls in order. Returns true when a change now waits for a yes, which
	 * ends the turn.
	 */
	private async callTools(turn: Turn, calls: AgentToolCall[]): Promise<boolean> {
		let waiting = false;
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
			if (tool.classification === 'mutation') {
				if (waiting) {
					await this.toolResult(turn, call, ONE_CHANGE);
					continue;
				}
				waiting = await this.propose(turn, tool, call, args);
				continue;
			}
			const outcome = await tool.execute(args);
			if (outcome.ok) {
				if (outcome.value.clientAction) turn.clientActions.push(outcome.value.clientAction);
				await this.toolResult(turn, call, outcome.value.result);
			} else {
				await this.toolResult(turn, call, outcome.failure);
			}
		}
		return waiting;
	}

	/** Stores a change as pending, after its preview checked it can happen. */
	private async propose(
		turn: Turn,
		tool: AgentTool,
		call: AgentToolCall,
		args: unknown
	): Promise<boolean> {
		const preview = await tool.preview(args);
		if (!preview.ok) {
			await this.toolResult(turn, call, preview.failure);
			return false;
		}
		await this.actions.create(
			{
				conversationId: turn.conversation.id,
				callId: call.id,
				tool: tool.name,
				args,
				summary: preview.value
			},
			turn.now
		);
		return true;
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

	private async say(turn: Turn, text: string): Promise<void> {
		await this.messages.append(
			turn.conversation.id,
			{ role: 'assistant', text, toolCalls: [] },
			turn.now
		);
	}

	private async toolResult(turn: Turn, call: AgentToolCall, result: unknown): Promise<void> {
		await this.messages.append(
			turn.conversation.id,
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

	private async view(conversationId: string): Promise<BasilConversationView> {
		const [messages, actions] = await Promise.all([
			this.messages.list(conversationId),
			this.actions.list(conversationId)
		]);
		return buildConversationView(messages, actions);
	}

	private async result(turn: Turn): Promise<BasilTurnResult> {
		return {
			conversation: await this.view(turn.conversation.id),
			clientActions: turn.clientActions,
			staleDoors: [...turn.staleDoors]
		};
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
