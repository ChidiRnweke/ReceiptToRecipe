/**
 * The contract between Basil's loop and its tools.
 *
 * The loop only knows tools through this interface. The factory builds them over the controllers
 * with the signed-in member bound in, so the loop never sees a user or household id.
 */

import type {
	BasilDoor,
	ClientAction,
	ToolClassification,
	ToolFailure,
	ToolName,
	Touched
} from '$lib/models/agent';

export type ToolOutcome<T> = { ok: true; value: T } | { ok: false; failure: ToolFailure };

/** What a tool call produced. */
export interface ToolRun {
	/** What the model reads back, as JSON. */
	result: unknown;
	/** What a change touched, for the chips under an approved change. */
	touched: Touched[];
	/** A step for the browser, for a client tool. */
	clientAction?: ClientAction;
}

export interface AgentTool<N extends ToolName = ToolName> {
	readonly name: N;
	readonly classification: ToolClassification;
	readonly surface?: 'client';
	readonly description: string;
	/** The JSON schema of the tool's input, for the model. */
	readonly parameters: Record<string, unknown>;
	/** Doors whose data a change makes stale. Empty for reads. */
	readonly doors: readonly BasilDoor[];
	/**
	 * Checks the arguments and says in plain words what the change would do, without doing it.
	 * A failure here goes back to the model, so no approval card asks about a change that cannot
	 * happen.
	 */
	preview(args: unknown): Promise<ToolOutcome<string>>;
	/** Parses the arguments again and runs the tool. Never throws; a failure is a value. */
	execute(args: unknown): Promise<ToolOutcome<ToolRun>>;
}

/** The tools of one request, for one member. */
export type AgentToolbox = readonly AgentTool[];

/** The failure the model reads when a call cannot run, with a hint on what to try instead. */
export function toolFailure(failure: string, recovery: string): ToolFailure {
	return { failure, recovery };
}

/** Advice for a failure the tool did not expect, chosen from its message. */
export function failureFromError(error: unknown): ToolFailure {
	const message = error instanceof Error ? error.message : String(error);
	if (/not found/i.test(message)) {
		return toolFailure(
			message,
			'Look the id up again with a read tool (get_plan, get_shop_list, find_recipes or kitchen_stock) and use one from its result.'
		);
	}
	return toolFailure(
		message || 'The tool failed.',
		'Tell the person it did not work, and suggest doing it on the door itself.'
	);
}
