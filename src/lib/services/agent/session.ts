import type { AgentInputItem, Session } from '@openai/agents';
import type { IAgentSessionRepository } from '$repositories';

/** The model reads at most this many of the latest items, starting at a message from the person. */
export const HISTORY_ITEMS = 60;

/**
 * The agent SDK session over a conversation's stored items. The SDK reads the history from it
 * and adds each turn's items to it; nothing is written until the run hands the items back with
 * {@link save}, so a run that breaks off half way does not leave half a turn behind.
 */
export class ConversationSession implements Session {
	private items: AgentInputItem[] | undefined;

	constructor(
		private repository: IAgentSessionRepository,
		private conversationId: string
	) {}

	async getSessionId(): Promise<string> {
		return this.conversationId;
	}

	async getItems(limit?: number): Promise<AgentInputItem[]> {
		const shown = latest(await this.load());
		return limit === undefined ? shown : shown.slice(-limit);
	}

	async addItems(items: AgentInputItem[]): Promise<void> {
		(await this.load()).push(...structuredClone(items));
	}

	async popItem(): Promise<AgentInputItem | undefined> {
		return (await this.load()).pop();
	}

	async clearSession(): Promise<void> {
		this.items = [];
	}

	/** Every item as the SDK left it, a call waiting for a yes included. */
	async snapshot(): Promise<AgentInputItem[]> {
		return [...(await this.load())];
	}

	/**
	 * The items of a run that broke off: a call left without its result, or a result without its
	 * call, is dropped, since a provider refuses either; and the words Basil had said are kept as
	 * its reply.
	 */
	async settled(words: string): Promise<AgentInputItem[]> {
		const items = await this.load();
		const calls = new Set<string>();
		const results = new Set<string>();
		for (const item of items) {
			if (item.type === 'function_call') calls.add(item.callId);
			if (item.type === 'function_call_result') results.add(item.callId);
		}
		const paired = items.filter((item) => {
			if (item.type === 'function_call') return results.has(item.callId);
			if (item.type === 'function_call_result') return calls.has(item.callId);
			return true;
		});
		if (!words.trim()) return paired;
		return [...paired, assistantMessage(words.trim())];
	}

	save(items: readonly AgentInputItem[], at: Date): Promise<void> {
		return this.repository.replace(this.conversationId, items, at);
	}

	private async load(): Promise<AgentInputItem[]> {
		if (!this.items) this.items = await this.repository.list(this.conversationId);
		return this.items;
	}
}

/** Basil's words as the SDK stores an assistant message. */
function assistantMessage(text: string): AgentInputItem {
	return {
		type: 'message',
		role: 'assistant',
		status: 'completed',
		content: [{ type: 'output_text', text }]
	};
}

/** The latest items, cut at a message from the person so no result loses its call. */
function latest(items: AgentInputItem[]): AgentInputItem[] {
	if (items.length <= HISTORY_ITEMS) return items;
	const tail = items.slice(-HISTORY_ITEMS);
	const start = tail.findIndex((item) => 'role' in item && item.role === 'user');
	return start >= 0 ? tail.slice(start) : tail;
}
