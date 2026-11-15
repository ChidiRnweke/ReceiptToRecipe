/**
 * Reading a streamed chat completion: words arrive as they are written, and each tool call
 * arrives in fragments (its id and name first, then its arguments a few characters at a time)
 * that share an `index`.
 */

import type { ChatStreamingResponseChunkData } from '@openrouter/sdk/models';
import type { AgentToolCall } from '$lib/models/agent';
import type { AgentModelDelta } from '../interfaces/IAgentModel';

/** One fragment of a tool call, as a stream chunk carries it. */
export interface ToolCallFragment {
	index: number;
	id?: string;
	function?: { name?: string; arguments?: string };
}

/** Joins tool-call fragments by index, in index order. Arguments are concatenated. */
export function stitchToolCalls(fragments: readonly ToolCallFragment[]): AgentToolCall[] {
	const byIndex = new Map<number, AgentToolCall>();
	for (const fragment of fragments) {
		const call = byIndex.get(fragment.index) ?? { id: '', name: '', arguments: '' };
		if (fragment.id) call.id = fragment.id;
		if (fragment.function?.name) call.name += fragment.function.name;
		if (fragment.function?.arguments) call.arguments += fragment.function.arguments;
		byIndex.set(fragment.index, call);
	}
	return [...byIndex.entries()]
		.sort(([a], [b]) => a - b)
		.map(([index, call]) => ({ ...call, id: call.id || `call-${index}` }))
		.filter((call) => call.name);
}

/** The provider reported an error inside the stream. */
export class ChatStreamError extends Error {
	constructor(
		message: string,
		readonly code: number
	) {
		super(message);
		this.name = 'ChatStreamError';
	}
}

/**
 * Turns the provider's chunks into Basil's deltas: text as it comes, then the stitched tool
 * calls once the stream ends. A chunk with an `error` ends the stream with a `ChatStreamError`.
 */
export async function* readChatStream(
	chunks: AsyncIterable<Pick<ChatStreamingResponseChunkData, 'choices' | 'error'>>
): AsyncGenerator<AgentModelDelta> {
	const fragments: ToolCallFragment[] = [];
	for await (const chunk of chunks) {
		if (chunk.error) throw new ChatStreamError(chunk.error.message, chunk.error.code);
		const delta = chunk.choices[0]?.delta;
		if (!delta) continue;
		if (delta.content) yield { type: 'text', text: delta.content };
		for (const call of delta.toolCalls ?? []) fragments.push(call);
	}
	const calls = stitchToolCalls(fragments);
	if (calls.length) yield { type: 'tool_calls', calls };
}
