import type { AgentToolCall } from '$lib/models/agent';

/** One message of the conversation as the model reads it. */
export type AgentModelMessage =
	| { role: 'system'; content: string }
	| { role: 'user'; content: string }
	| { role: 'assistant'; content: string | null; toolCalls: AgentToolCall[] }
	| { role: 'tool'; toolCallId: string; content: string };

/** A tool as the model is offered it: its JSON schema is the tool's input schema. */
export interface AgentModelTool {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
}

export interface AgentModelRequest {
	messages: AgentModelMessage[];
	tools: AgentModelTool[];
}

/** A piece of the model's answer as it streams: words for the person, or its tool calls. */
export type AgentModelDelta =
	| { type: 'text'; text: string }
	/** Every tool call of the answer, stitched together, once the stream has ended. */
	| { type: 'tool_calls'; calls: AgentToolCall[] };

/** The language model behind Basil. */
export interface IAgentModel {
	/**
	 * Streams one answer. Stops when `signal` aborts; a provider error, or an error inside the
	 * stream, is thrown.
	 */
	stream(request: AgentModelRequest, signal: AbortSignal): AsyncIterable<AgentModelDelta>;
}
