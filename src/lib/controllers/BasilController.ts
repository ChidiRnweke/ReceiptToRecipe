import type { AgentToolbox, IAgentService } from '$services';
import type { Actor } from '$lib/models/household';
import type {
	ActionInput,
	BasilConversationView,
	BasilTurnResult,
	SendMessageInput
} from '$lib/models/agent';

/** Builds Basil's tools for one member at one moment, bound to that member. */
export type ToolboxFor = (actor: Actor, now: Date, timeZone: string) => AgentToolbox;

/** Basil's sheet: the conversation, a message, and yes or not now on a proposed change. */
export class BasilController {
	constructor(
		private agentService: IAgentService,
		private toolboxFor: ToolboxFor
	) {}

	async getConversation(actor: Actor): Promise<BasilConversationView> {
		return this.agentService.getConversation(actor);
	}

	async sendMessage(
		actor: Actor,
		input: SendMessageInput,
		now: Date,
		timeZone: string
	): Promise<BasilTurnResult> {
		return this.agentService.sendMessage(actor, this.toolboxFor(actor, now, timeZone), {
			text: input.text,
			pageContext: input.pageContext,
			now
		});
	}

	async approve(
		actor: Actor,
		input: ActionInput,
		now: Date,
		timeZone: string
	): Promise<BasilTurnResult> {
		return this.agentService.approveAction(actor, this.toolboxFor(actor, now, timeZone), {
			actionId: input.actionId,
			pageContext: input.pageContext ?? null,
			now
		});
	}

	async decline(
		actor: Actor,
		input: ActionInput,
		now: Date,
		timeZone: string
	): Promise<BasilTurnResult> {
		return this.agentService.declineAction(actor, this.toolboxFor(actor, now, timeZone), {
			actionId: input.actionId,
			pageContext: input.pageContext ?? null,
			now
		});
	}
}
