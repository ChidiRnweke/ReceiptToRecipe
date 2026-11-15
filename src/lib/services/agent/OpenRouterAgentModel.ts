import { OpenRouter } from '@openrouter/sdk';
import type { Message } from '@openrouter/sdk/models';
import type {
	AgentModelDelta,
	AgentModelMessage,
	AgentModelRequest,
	IAgentModel
} from '../interfaces/IAgentModel';
import { readChatStream } from './chatStream';

/** Basil's model on OpenRouter, with streamed chat-completions function calling. */
export class OpenRouterAgentModel implements IAgentModel {
	private client: OpenRouter;

	constructor(
		apiKey: string,
		private model: string
	) {
		this.client = new OpenRouter({ apiKey });
	}

	async *stream(request: AgentModelRequest, signal: AbortSignal): AsyncGenerator<AgentModelDelta> {
		const chunks = await this.client.chat.send(
			{
				chatGenerationParams: {
					model: this.model,
					messages: request.messages.map(toMessage),
					tools: request.tools.map((tool) => ({
						type: 'function' as const,
						function: {
							name: tool.name,
							description: tool.description,
							parameters: tool.parameters
						}
					})),
					toolChoice: 'auto',
					temperature: 0.3,
					stream: true
				}
			},
			{ signal }
		);
		yield* readChatStream(chunks);
	}
}

function toMessage(message: AgentModelMessage): Message {
	switch (message.role) {
		case 'system':
			return { role: 'system', content: message.content };
		case 'user':
			return { role: 'user', content: message.content };
		case 'assistant':
			return {
				role: 'assistant',
				content: message.content,
				...(message.toolCalls.length
					? {
							toolCalls: message.toolCalls.map((call) => ({
								id: call.id,
								type: 'function' as const,
								function: { name: call.name, arguments: call.arguments || '{}' }
							}))
						}
					: {})
			};
		case 'tool':
			return { role: 'tool', toolCallId: message.toolCallId, content: message.content };
	}
}
