import { tool, type Tool } from '@openai/agents';
import type { ToolFailure } from '$lib/models/agent';
import {
	failureFromError,
	type AgentTool,
	type AgentToolbox,
	type ToolOutcome,
	type ToolParameters,
	type ToolRun
} from './toolbox';

/**
 * What one run's tool calls did, by call id. The tools write it as they run; the loop reads it
 * when the SDK reports a call's result, to say whether it worked and what a change touched.
 */
export class CallLedger {
	/** A change waiting for a yes, in the plain words its card shows. */
	readonly summaries = new Map<string, string>();
	/** A change whose preview failed: it is answered with the failure and never runs. */
	readonly refused = new Map<string, ToolFailure>();
	/** What a call that ran produced. */
	readonly outcomes = new Map<string, ToolOutcome<ToolRun>>();
}

/**
 * Basil's toolbox as agent SDK tools. Reads and proposals run at once. A change asks for a yes,
 * after its preview checked it can happen: a change that cannot is answered with its failure
 * instead, so no card asks about it. A result goes back to the model as JSON; a failure as
 * `{ failure, recovery }`.
 */
export function basilTools(toolbox: AgentToolbox, ledger: CallLedger): Tool[] {
	return toolbox.map((agentTool) => basilTool(agentTool, ledger));
}

/** The JSON schema the SDK takes for a tool that is not strict. */
type NonStrictParameters = Omit<ToolParameters, 'additionalProperties'> & {
	additionalProperties: true;
};

/**
 * A tool's schema for the SDK's non-strict mode. Strict mode would require every field, and
 * Basil's tools have optional ones. The SDK types a non-strict schema as one that takes other
 * fields; Basil's say they take none, which the provider reads the same way, and the toolbox
 * parses the arguments itself and refuses any extra field.
 */
function nonStrict(parameters: ToolParameters): NonStrictParameters {
	return parameters as Omit<ToolParameters, 'additionalProperties'> as NonStrictParameters;
}

function basilTool(agentTool: AgentTool, ledger: CallLedger): Tool {
	return tool({
		name: agentTool.name,
		description: agentTool.description,
		parameters: nonStrict(agentTool.parameters),
		strict: false,
		needsApproval: async (_context, input, callId) => {
			if (agentTool.classification !== 'mutation') return false;
			if (!callId) throw new Error(`The change ${agentTool.name} came without a call id`);
			const preview = await agentTool.preview(input);
			if (!preview.ok) {
				ledger.refused.set(callId, preview.failure);
				return false;
			}
			ledger.summaries.set(callId, preview.value);
			return true;
		},
		errorFunction: (_context, error) => JSON.stringify(failureFromError(error)),
		execute: async (input, _context, details) => {
			const callId = details?.toolCall?.callId;
			const refused = callId ? ledger.refused.get(callId) : undefined;
			const outcome: ToolOutcome<ToolRun> = refused
				? { ok: false, failure: refused }
				: await agentTool.execute(input);
			if (callId) ledger.outcomes.set(callId, outcome);
			return JSON.stringify(outcome.ok ? (outcome.value.result ?? null) : outcome.failure);
		}
	});
}
