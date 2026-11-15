/**
 * Basil's runs and the events they stream.
 *
 * A run answers one message. When Basil proposes a change the run parks, holding the agent's
 * serialized state, and the person's yes or not now resumes the same run. Its events are stored
 * in order with a cursor, and the sheet reads them over server-sent events, so a reload picks the
 * stream up again from a cursor.
 */

import { z } from 'zod';
import { BASIL_DOORS, type BasilDoor } from './doors';
import { pageContextInput, type PageContext } from './pageContext';
import type { Actor } from '$lib/models/household';

export const AGENT_RUN_STATUSES = [
	'queued',
	'running',
	'awaiting_approval',
	'cancelling',
	'completed',
	'failed',
	'cancelled'
] as const;
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

/** A run in one of these holds its conversation's single slot. */
export const ACTIVE_RUN_STATUSES = [
	'queued',
	'running',
	'cancelling'
] as const satisfies readonly AgentRunStatus[];

/** A run in one of these writes no more events. */
export const SETTLED_RUN_STATUSES = [
	'awaiting_approval',
	'completed',
	'failed',
	'cancelled'
] as const satisfies readonly AgentRunStatus[];

/** A step the browser carries out for Basil. */
export type ClientAction =
	| { tool: 'navigate_to'; door: BasilDoor | null; recipeId: string | null }
	| { tool: 'highlight'; key: string };

/** Everything a run tells the sheet, in order. */
export type BasilEvent =
	// The run's life
	| { type: 'run_queued' }
	| { type: 'run_started' }
	| { type: 'completed' }
	| { type: 'failed'; message: string; retryable: boolean }
	| { type: 'cancelled' }
	// What Basil says and does in the browser
	| { type: 'text_delta'; text: string }
	| { type: 'client_action'; action: ClientAction }
	| { type: 'resources_stale'; doors: BasilDoor[] }
	// Tools
	| {
			type: 'tool_started';
			callId: string;
			name: string;
			/** What the sheet shows while the tool runs: "Looking at your plan…". */
			label: string;
	  }
	| { type: 'tool_finished'; callId: string; name: string; ok: boolean }
	// A change waiting for a yes
	| { type: 'approval_required'; action: { id: string; summary: string } };

export type BasilEventType = BasilEvent['type'];

/** The events Basil's loop produces; the run's life is the run's own. */
export type BasilTurnEvent = Extract<
	BasilEvent,
	{
		type:
			| 'text_delta'
			| 'client_action'
			| 'resources_stale'
			| 'tool_started'
			| 'tool_finished'
			| 'approval_required';
	}
>;

const clientActionSchema = z.discriminatedUnion('tool', [
	z.object({
		tool: z.literal('navigate_to'),
		door: z.enum(BASIL_DOORS).nullable(),
		recipeId: z.string().nullable()
	}),
	z.object({ tool: z.literal('highlight'), key: z.string() })
]);

/** The zod mirror of `BasilEvent`, for rows read back and frames the browser receives. */
export const basilEventSchema: z.ZodType<BasilEvent> = z.discriminatedUnion('type', [
	z.object({ type: z.literal('run_queued') }),
	z.object({ type: z.literal('run_started') }),
	z.object({ type: z.literal('completed') }),
	z.object({ type: z.literal('failed'), message: z.string(), retryable: z.boolean() }),
	z.object({ type: z.literal('cancelled') }),
	z.object({ type: z.literal('text_delta'), text: z.string() }),
	z.object({ type: z.literal('client_action'), action: clientActionSchema }),
	z.object({ type: z.literal('resources_stale'), doors: z.array(z.enum(BASIL_DOORS)) }),
	z.object({
		type: z.literal('tool_started'),
		callId: z.string(),
		name: z.string(),
		label: z.string()
	}),
	z.object({
		type: z.literal('tool_finished'),
		callId: z.string(),
		name: z.string(),
		ok: z.boolean()
	}),
	z.object({
		type: z.literal('approval_required'),
		action: z.object({ id: z.string(), summary: z.string() })
	})
]);

/** One stored event of a run. Cursors only grow, across every run. */
export interface BasilRunEventRecord {
	runId: string;
	cursor: number;
	event: BasilEvent;
}

/** A record as it travels in an SSE frame. */
export const basilRunEventRecordSchema: z.ZodType<BasilRunEventRecord> = z.object({
	runId: z.string(),
	cursor: z.number().int().nonnegative(),
	event: basilEventSchema
});

/** What a run answers: the person's message and the page they sent it from. */
export interface BasilRunRequest {
	text: string;
	pageContext: PageContext | null;
}

/** A run's input: the request, and who asked from where, so it can run without the request. */
export interface BasilRunInput {
	request: BasilRunRequest;
	actor: Actor;
	/** The browser's time zone when the person asked. */
	timeZone: string;
}

const actorSchema = z.object({
	userId: z.string(),
	householdId: z.string(),
	memberId: z.string(),
	displayName: z.string(),
	roles: z.object({ plans: z.boolean(), shops: z.boolean(), cooks: z.boolean() }),
	timeZone: z.string()
});

/** Reads a stored run input back. */
export const basilRunInputSchema: z.ZodType<BasilRunInput> = z.object({
	request: z.object({ text: z.string(), pageContext: pageContextInput.nullable() }),
	actor: actorSchema,
	timeZone: z.string()
});

export interface AgentRun {
	id: string;
	conversationId: string;
	householdId: string;
	userId: string;
	requestId: string;
	input: BasilRunInput;
	status: AgentRunStatus;
	/** The agent's state while the run waits for a yes; null otherwise. */
	serializedState: string | null;
	failure: string | null;
	cancelRequestedAt: Date | null;
	createdAt: Date;
	finishedAt: Date | null;
}

export interface NewAgentRun {
	conversationId: string;
	householdId: string;
	userId: string;
	requestId: string;
	input: BasilRunInput;
}

/** A status change, applied only when the run is still in one of the expected statuses. */
export interface AgentRunTransition {
	status: AgentRunStatus;
	/** Stored when the run parks on a change, cleared (null) when it settles otherwise. */
	serializedState?: string | null;
	failure?: string;
	cancelRequestedAt?: Date;
	finishedAt?: Date;
}

/** What starting a run gives back: the run to follow and the cursor its stream is at. */
export interface BasilRunReceipt {
	runId: string;
	cursor: number;
}

/** A decision that was already made resumes nothing. */
export interface BasilDecisionReceipt {
	runId: string | null;
	cursor: number;
}

/** The run still answering in a conversation, and the cursor its stream has reached. */
export interface BasilActiveRun {
	id: string;
	cursor: number;
}

/** What Basil says about a run the server restarted under. */
export const RESTARTED_REPLY = 'I was interrupted before I could finish. Ask me again?';

/** Another run is still answering in this conversation. */
export class BasilBusyError extends Error {
	constructor() {
		super('Basil is still answering. Wait for it, or stop it first.');
		this.name = 'BasilBusyError';
	}
}

/** The run does not exist. */
export class BasilRunNotFoundError extends Error {
	constructor() {
		super('Run not found');
		this.name = 'BasilRunNotFoundError';
	}
}

/** The run belongs to another member. */
export class BasilRunForbiddenError extends Error {
	constructor() {
		super('This run belongs to someone else');
		this.name = 'BasilRunForbiddenError';
	}
}
