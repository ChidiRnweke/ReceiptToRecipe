import type { AgentToolCall } from '../../src/lib/models/agent';
import type {
	AgentModelDelta,
	AgentModelRequest,
	IAgentModel
} from '../../src/lib/services/interfaces/IAgentModel';

/** One scripted answer: words, tool calls, or both. `hold` keeps streaming open until Stop. */
export interface ScriptedAnswer {
	text?: string;
	toolCalls: AgentToolCall[];
	hold?: boolean;
}

/** One scripted answer, or a function of what the model was sent. */
export type ScriptedReply = ScriptedAnswer | ((request: AgentModelRequest) => ScriptedAnswer);

let callSequence = 0;

/** A tool call as a model writes it. */
export function call(name: string, args: Record<string, unknown> = {}): AgentToolCall {
	callSequence += 1;
	return { id: `call-${callSequence}`, name, arguments: JSON.stringify(args) };
}

/** A reply in words. */
export function says(text: string): ScriptedAnswer {
	return { text, toolCalls: [] };
}

/** A reply that calls tools. */
export function calls(...toolCalls: AgentToolCall[]): ScriptedAnswer {
	return { toolCalls };
}

/** A reply that says these words and then keeps going until the person taps Stop. */
export function holds(text: string): ScriptedAnswer {
	return { text, toolCalls: [], hold: true };
}

/** The words in pieces of a word or two, as a streaming model sends them. */
export function piecesOf(text: string): string[] {
	return text.split(/(?<=\s)/);
}

/**
 * A model that answers from a script, in order, streaming the words a piece at a time, and keeps
 * every request it was sent. When the script runs out it gives the fallback, which by default is
 * a short reply in words.
 */
export class ScriptedAgentModel implements IAgentModel {
	readonly requests: AgentModelRequest[] = [];
	/** Resolves when a held answer has streamed its words. */
	private heldListeners: (() => void)[] = [];
	private script: ScriptedReply[];

	constructor(
		script: ScriptedReply[] = [],
		private fallback: ScriptedReply = says('Done.')
	) {
		this.script = [...script];
	}

	/** Adds answers for the next turn. */
	then(...replies: ScriptedReply[]): this {
		this.script.push(...replies);
		return this;
	}

	/** Resolves once a held answer has sent its words and is waiting. */
	held(): Promise<void> {
		return new Promise((done) => this.heldListeners.push(done));
	}

	async *stream(request: AgentModelRequest, signal: AbortSignal): AsyncGenerator<AgentModelDelta> {
		this.requests.push(structuredClone(request));
		const next = this.script.shift() ?? this.fallback;
		const answer = typeof next === 'function' ? next(request) : next;
		for (const piece of piecesOf(answer.text ?? '')) {
			if (piece) yield { type: 'text', text: piece };
		}
		if (answer.hold) {
			for (const listener of this.heldListeners.splice(0)) listener();
			await new Promise<void>((done) => {
				if (signal.aborted) return done();
				signal.addEventListener('abort', () => done(), { once: true });
			});
			return;
		}
		if (answer.toolCalls.length) yield { type: 'tool_calls', calls: answer.toolCalls };
	}

	/** What the model last read back from a tool, parsed. */
	lastToolResult(): unknown {
		const request = this.requests.at(-1);
		const message = [...(request?.messages ?? [])].reverse().find((m) => m.role === 'tool');
		return message && message.role === 'tool' ? JSON.parse(message.content) : undefined;
	}
}

/** A model whose every call fails, as when the provider is down. */
export class FailingAgentModel implements IAgentModel {
	// eslint-disable-next-line require-yield
	async *stream(): AsyncGenerator<AgentModelDelta> {
		throw new Error('The provider is down');
	}
}
