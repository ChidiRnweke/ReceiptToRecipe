import type {
	AgentModelReply,
	AgentModelRequest,
	IAgentModel
} from '../../src/lib/services/interfaces/IAgentModel';

/** One scripted answer, or a function of what the model was sent. */
export type ScriptedReply = AgentModelReply | ((request: AgentModelRequest) => AgentModelReply);

let callSequence = 0;

/** A tool call as a model writes it. */
export function call(name: string, args: Record<string, unknown> = {}) {
	callSequence += 1;
	return { id: `call-${callSequence}`, name, arguments: JSON.stringify(args) };
}

/** A reply in words. */
export function says(text: string): AgentModelReply {
	return { text, toolCalls: [] };
}

/** A reply that calls tools. */
export function calls(...toolCalls: ReturnType<typeof call>[]): AgentModelReply {
	return { toolCalls };
}

/**
 * A model that answers from a script, in order, and keeps every request it was sent. When the
 * script runs out it gives the fallback, which by default is a short reply in words.
 */
export class ScriptedAgentModel implements IAgentModel {
	readonly requests: AgentModelRequest[] = [];
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

	async complete(request: AgentModelRequest): Promise<AgentModelReply> {
		this.requests.push(structuredClone(request));
		const next = this.script.shift() ?? this.fallback;
		return typeof next === 'function' ? next(request) : next;
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
	async complete(): Promise<AgentModelReply> {
		throw new Error('The provider is down');
	}
}
