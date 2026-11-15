/**
 * Types of Basil, the in-app agent.
 *
 * Basil answers questions about the household's kitchen, plan, list and recipes through tools.
 * Every controller method is classified for Basil at compile time: a tool reads, proposes, or
 * changes something. A change waits for the person to say yes.
 */

import { z } from 'zod';
import type { ToolName } from './toolCatalog';
import { BASIL_DOORS, type BasilDoor } from './doors';

export * from './toolCatalog';
export * from './toolInputs';
export * from './doors';
export * from './keys';

/**
 * What a tool does to the household's data.
 * - read: looks something up; runs at once.
 * - proposal: works out a suggestion without changing anything; runs at once.
 * - mutation: changes something; waits for the person's yes.
 */
export type ToolClassification = 'read' | 'proposal' | 'mutation';

/** How one controller method takes part in Basil's tools. */
export type AgentToolContractBinding =
	| { readonly kind: ToolClassification; readonly tools: readonly ToolName[] }
	| { readonly kind: 'excluded'; readonly reason: string };

/** One binding for every public method of every controller. */
export type AgentToolContractMap<Controllers> = {
	readonly [C in keyof Controllers]: {
		readonly [M in keyof Controllers[C]]: AgentToolContractBinding;
	};
};

/** What the person is looking at when they ask. */
export const pageContextInput = z
	.object({
		door: z.enum(BASIL_DOORS).nullable(),
		route: z.string().trim().max(200),
		/** `data-basil-key` values on the page, so Basil can point at them. */
		visibleIds: z.array(z.string().trim().min(1).max(120)).max(60).optional(),
		/** Text the person selected, if any. */
		selection: z.string().trim().max(500).optional()
	})
	.strict();
export type PageContext = z.infer<typeof pageContextInput>;

export const BASIL_MESSAGE_MAX = 1000;

export const sendMessageInput = z
	.object({
		text: z.string().trim().min(1, 'Say something first').max(BASIL_MESSAGE_MAX),
		pageContext: pageContextInput
	})
	.strict();
export type SendMessageInput = z.infer<typeof sendMessageInput>;

export const actionInput = z
	.object({ actionId: z.uuid(), pageContext: pageContextInput.optional() })
	.strict();
export type ActionInput = z.infer<typeof actionInput>;

/** What kind of thing a change touched; each kind has a door it shows on. */
export type TouchedKind = 'tonight' | 'planned-meal' | 'list-item' | 'kitchen-item' | 'recipe';

/** One thing a change touched, for the row of chips under an approved change. */
export interface Touched {
	kind: TouchedKind;
	/** The entity's id, or a stable key such as a plan slot `20410:DINNER`. */
	id: string;
	/** "Shakshuka", "Feta". */
	label: string;
	door: BasilDoor;
	/** The `data-basil-key` to outline on the door, when the thing has one. */
	key?: string;
}

/** A failed tool call, as the model reads it so it can try another way. */
export interface ToolFailure {
	failure: string;
	recovery: string;
}

export type AgentActionStatus = 'pending' | 'approved' | 'declined' | 'executed' | 'failed';

/** A step the browser carries out for Basil. */
export type ClientAction =
	| { tool: 'navigate_to'; door: BasilDoor | null; recipeId: string | null }
	| { tool: 'highlight'; key: string };

/** One line of the conversation as the sheet shows it. */
export type BasilEntry =
	| { kind: 'user'; id: string; text: string }
	| { kind: 'basil'; id: string; text: string }
	| {
			kind: 'action';
			id: string;
			/** The change in plain words: "Take the shakshuka off Thursday". */
			summary: string;
			status: AgentActionStatus;
			touched: Touched[];
	  };

export interface BasilConversationView {
	entries: BasilEntry[];
	/** The change waiting for a yes, if any. */
	pendingActionId: string | null;
}

/** What one turn of Basil gives back to the page. */
export interface BasilTurnResult {
	conversation: BasilConversationView;
	/** Steps for the browser: open a door, outline something. */
	clientActions: ClientAction[];
	/** Doors whose data changed, so the page refreshes their queries. */
	staleDoors: BasilDoor[];
}

// ─── Stored conversation ─────────────────────────────────────────────────

export interface AgentConversation {
	id: string;
	householdId: string;
	userId: string;
	createdAt: Date;
}

/** A tool call as the model wrote it; `arguments` is its raw JSON text. */
export interface AgentToolCall {
	id: string;
	name: string;
	arguments: string;
}

export type AgentMessageBody =
	| { role: 'user'; text: string }
	| { role: 'assistant'; text: string | null; toolCalls: AgentToolCall[] }
	| { role: 'tool'; callId: string; name: string; result: unknown };

export type AgentMessage = AgentMessageBody & {
	id: string;
	conversationId: string;
	createdAt: Date;
};

export interface AgentAction {
	id: string;
	conversationId: string;
	callId: string;
	tool: string;
	args: unknown;
	summary: string;
	status: AgentActionStatus;
	result: unknown;
	touched: Touched[];
	createdAt: Date;
	decidedAt: Date | null;
}

export interface NewAgentAction {
	conversationId: string;
	callId: string;
	tool: string;
	args: unknown;
	summary: string;
}

export interface AgentActionDecision {
	status: Exclude<AgentActionStatus, 'pending'>;
	result?: unknown;
	touched?: Touched[];
	decidedAt: Date;
}
