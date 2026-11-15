/**
 * Types of Basil, the in-app agent.
 *
 * Basil answers questions about the household's kitchen, plan, list and recipes through tools.
 * Every controller method is classified for Basil at compile time: a tool reads, proposes, or
 * changes something. A change waits for the person to say yes.
 */

import { z } from 'zod';
import type { ToolName } from './toolCatalog';
import type { BasilActiveRun } from './runs';
import type { BasilDoor } from './doors';
import { pageContextInput } from './pageContext';

export * from './toolCatalog';
export * from './toolInputs';
export * from './doors';
export * from './keys';
export * from './pageContext';
export * from './runs';
export * from './toolLabels';

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

export const BASIL_MESSAGE_MAX = 1000;

export const sendMessageInput = z
	.object({
		text: z.string().trim().min(1, 'Say something first').max(BASIL_MESSAGE_MAX),
		pageContext: pageContextInput,
		/** Chosen by the browser, so sending the same message twice starts one run. */
		requestId: z.uuid()
	})
	.strict();
export type SendMessageInput = z.infer<typeof sendMessageInput>;

export const actionInput = z
	.object({ actionId: z.uuid(), requestId: z.uuid(), pageContext: pageContextInput.optional() })
	.strict();
export type ActionInput = z.infer<typeof actionInput>;

export const runInput = z.object({ runId: z.uuid() }).strict();
export type RunInput = z.infer<typeof runInput>;

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
	/** The run still answering, so a reloaded sheet can follow it again. */
	activeRun: BasilActiveRun | null;
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
