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

/** What the model answered: words for the person, tool calls, or both. */
export interface AgentModelReply {
	text?: string;
	toolCalls: AgentToolCall[];
}

/** The language model behind Basil. */
export interface IAgentModel {
	complete(request: AgentModelRequest): Promise<AgentModelReply>;
}
