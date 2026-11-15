import type {
	Model,
	ModelProvider,
	ModelRequest,
	ModelResponse,
	StreamEvent
} from '@openai/agents';

/** A model lease that becomes unusable after the owner releases it. */
export class InMemoryModelProvider implements ModelProvider {
	closed = false;
	readonly asked: (string | undefined)[] = [];

	constructor(private readonly model: Model) {}

	async getModel(name?: string): Promise<Model> {
		if (this.closed) throw new Error('Model provider is closed');
		this.asked.push(name);
		return this.model;
	}

	async close(): Promise<void> {
		this.closed = true;
	}
}

/** A function call as a model writes it. */
export interface ScriptedCall {
	callId: string;
	name: string;
	arguments: string;
}

/** One scripted answer: words, tool calls, or both. `hold` keeps streaming open until Stop. */
export interface ScriptedAnswer {
	text?: string;
	calls: ScriptedCall[];
	hold?: boolean;
}

/** One scripted answer, or a function of what the model was sent. */
export type ScriptedReply = ScriptedAnswer | ((request: ModelRequest) => ScriptedAnswer);

let callSequence = 0;

/** A tool call as a model writes it. */
export function call(name: string, args: Record<string, unknown> = {}): ScriptedCall {
	callSequence += 1;
	return { callId: `call-${callSequence}`, name, arguments: JSON.stringify(args) };
}

/** A reply in words. */
export function says(text: string): ScriptedAnswer {
	return { text, calls: [] };
}

/** A reply that calls tools. */
export function calls(...toolCalls: ScriptedCall[]): ScriptedAnswer {
	return { calls: toolCalls };
}

/** A reply that says these words and then keeps going until the person taps Stop. */
export function holds(text: string): ScriptedAnswer {
	return { text, calls: [], hold: true };
}

/** The words in pieces of a word or two, as a streaming model sends them. */
export function piecesOf(text: string): string[] {
	return text.split(/(?<=\s)/).filter(Boolean);
}

/**
 * A model on the agent SDK's `Model` interface that answers from a script, in order, streaming
 * the words a piece at a time, and keeps every request it was sent. When the script runs out it
 * gives the fallback, which by default is a short reply in words.
 */
export class ScriptedModel implements Model {
	readonly requests: ModelRequest[] = [];
	private heldListeners: (() => void)[] = [];
	private script: ScriptedReply[];
	private responses = 0;

	constructor(
		script: ScriptedReply[] = [],
		private fallback: ScriptedReply = says('Done.')
	) {
		this.script = [...script];
	}

	/**
	 * Adds answers for the next turns. Not named `then`: the SDK awaits the model its provider
	 * hands out, and a model with a `then` method would be taken for a promise.
	 */
	queue(...replies: ScriptedReply[]): this {
		this.script.push(...replies);
		return this;
	}

	/** Resolves once a held answer has sent its words and is waiting. */
	held(): Promise<void> {
		return new Promise((done) => this.heldListeners.push(done));
	}

	async getResponse(): Promise<ModelResponse> {
		throw new Error('This model supports streaming only');
	}

	async *getStreamedResponse(request: ModelRequest): AsyncIterable<StreamEvent> {
		this.requests.push(request);
		const next = this.script.shift() ?? this.fallback;
		const answer = typeof next === 'function' ? next(request) : next;
		yield { type: 'response_started' };
		for (const piece of piecesOf(answer.text ?? '')) {
			yield { type: 'output_text_delta', delta: piece };
		}
		if (answer.hold) {
			for (const listener of this.heldListeners.splice(0)) listener();
			await new Promise<void>((done) => {
				const signal = request.signal;
				if (!signal || signal.aborted) return done();
				signal.addEventListener('abort', () => done(), { once: true });
			});
			return;
		}
		this.responses += 1;
		yield {
			type: 'response_done',
			response: {
				id: `response-${this.responses}`,
				usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
				output: [
					...(answer.text
						? [
								{
									type: 'message' as const,
									role: 'assistant' as const,
									status: 'completed' as const,
									content: [{ type: 'output_text' as const, text: answer.text }]
								}
							]
						: []),
					...answer.calls.map((scripted) => ({
						type: 'function_call' as const,
						status: 'completed' as const,
						...scripted
					}))
				]
			}
		};
	}

	/** What the model last read back from a tool, parsed. */
	lastToolResult(): unknown {
		const input = this.requests.at(-1)?.input;
		if (!Array.isArray(input)) return undefined;
		const result = [...input].reverse().find((item) => item.type === 'function_call_result');
		if (result?.type !== 'function_call_result') return undefined;
		const output = result.output;
		const text = typeof output === 'string' ? output : 'text' in output ? output.text : '';
		return JSON.parse(text);
	}
}

/** A model whose every call fails, as when the provider is down. */
export class FailingModel implements Model {
	async getResponse(): Promise<ModelResponse> {
		throw new Error('The provider is down');
	}

	// eslint-disable-next-line require-yield
	async *getStreamedResponse(): AsyncIterable<StreamEvent> {
		throw new Error('The provider is down');
	}
}
