import type { Actor } from '$lib/models/household';
import type { BasilConversationView, BasilTurnResult, PageContext } from '$lib/models/agent';
import type { AgentToolbox } from '../agent/toolbox';

export interface BasilTurnInput {
	now: Date;
	pageContext: PageContext | null;
}

/** Basil's conversations and the loop that answers them. */
export interface IAgentService {
	/** The member's conversation, or an empty one. */
	getConversation(actor: Actor): Promise<BasilConversationView>;
	/** Adds the member's message and lets Basil answer. A change still waiting is dropped. */
	sendMessage(
		actor: Actor,
		toolbox: AgentToolbox,
		input: BasilTurnInput & { text: string }
	): Promise<BasilTurnResult>;
	/** Runs the waiting change and lets Basil go on. Throws "not found" for another member's action. */
	approveAction(
		actor: Actor,
		toolbox: AgentToolbox,
		input: BasilTurnInput & { actionId: string }
	): Promise<BasilTurnResult>;
	/** Drops the waiting change; nothing runs. Throws "not found" for another member's action. */
	declineAction(
		actor: Actor,
		toolbox: AgentToolbox,
		input: BasilTurnInput & { actionId: string }
	): Promise<BasilTurnResult>;
}
