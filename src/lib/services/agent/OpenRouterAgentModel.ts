import { OpenRouter } from '@openrouter/sdk';
import type { Message } from '@openrouter/sdk/models';
import type {
	AgentModelMessage,
	AgentModelReply,
	AgentModelRequest,
	IAgentModel
} from '../interfaces/IAgentModel';

/** Basil's model on OpenRouter, with chat-completions function calling. */
export class OpenRouterAgentModel implements IAgentModel {
	private client: OpenRouter;

	constructor(
		apiKey: string,
		private model: string
	) {
		this.client = new OpenRouter({ apiKey });
	}

	async complete(request: AgentModelRequest): Promise<AgentModelReply> {
		const completion = await this.client.chat.send({
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
				stream: false
			}
		});
		if (!completion || !('choices' in completion) || !completion.choices[0]) {
			throw new Error('Invalid response from OpenRouter');
		}
		const message = completion.choices[0].message;
		const content = message.content;
		const text =
			typeof content === 'string'
				? content
				: Array.isArray(content)
					? content
							.filter((part) => part.type === 'text')
							.map((part) => ('text' in part ? part.text : ''))
							.join('')
					: '';
		return {
			text: text || undefined,
			toolCalls: (message.toolCalls ?? []).map((call) => ({
				id: call.id,
				name: call.function.name,
				arguments: call.function.arguments ?? ''
			}))
		};
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
