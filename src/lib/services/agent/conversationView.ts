import type {
	AgentAction,
	AgentMessage,
	BasilConversationView,
	BasilEntry
} from '$lib/models/agent';

/**
 * The conversation as the sheet shows it: the person's messages, Basil's words, and a card for
 * each change Basil proposed, right after the words that proposed it. Tool results stay hidden.
 */
export function buildConversationView(
	messages: readonly AgentMessage[],
	actions: readonly AgentAction[]
): BasilConversationView {
	const byCall = new Map(actions.map((action) => [action.callId, action]));
	const entries: BasilEntry[] = [];
	for (const message of messages) {
		if (message.role === 'user') {
			entries.push({ kind: 'user', id: message.id, text: message.text });
		} else if (message.role === 'assistant') {
			if (message.text?.trim()) {
				entries.push({ kind: 'basil', id: message.id, text: message.text.trim() });
			}
			for (const call of message.toolCalls) {
				const action = byCall.get(call.id);
				if (!action) continue;
				entries.push({
					kind: 'action',
					id: action.id,
					summary: action.summary,
					status: action.status,
					touched: action.touched
				});
			}
		}
	}
	const pending = actions.find((action) => action.status === 'pending');
	return { entries, pendingActionId: pending?.id ?? null };
}
