import type {
	AgentInputItem,
	Model,
	ModelProvider,
	ModelRequest,
	ModelResponse,
	StreamEvent
} from '@openai/agents';

/** How long the scripted model waits between pieces of its words. */
const PIECE_MS = 180;

interface ScriptedCall {
	callId: string;
	name: string;
	arguments: string;
}

/**
 * A stand-in for the real model, for local development only (`BASIL_MODEL=scripted` in dev). It
 * reads the person's last message, calls Basil's real read tools, proposes a change for "take …
 * off", and streams its words a few at a time, so the sheet can be tried without a provider key.
 * It understands a handful of phrasings; it is not a model.
 */
export class DevScriptedAgentModel implements Model {
	private sequence = 0;

	constructor(private pieceMs = PIECE_MS) {}

	async getResponse(): Promise<ModelResponse> {
		throw new Error('The scripted model only streams');
	}

	async *getStreamedResponse(request: ModelRequest): AsyncIterable<StreamEvent> {
		const signal = request.signal ?? new AbortController().signal;
		const items = typeof request.input === 'string' ? [userItem(request.input)] : request.input;
		const reply = this.answer(items);
		yield { type: 'response_started' };
		// A real model takes a moment to read a tool's result before it answers.
		if (items.at(-1)?.type === 'function_call_result') await pause(this.pieceMs * 5, signal);
		for (const piece of reply.text ? pieces(reply.text) : []) {
			await pause(this.pieceMs, signal);
			if (signal.aborted) return;
			yield { type: 'output_text_delta', delta: piece };
		}
		if (reply.calls.length) await pause(this.pieceMs * 2, signal);
		if (signal.aborted) return;
		yield {
			type: 'response_done',
			response: {
				id: `scripted-${Date.now()}`,
				usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
				output: [
					...(reply.text
						? [
								{
									type: 'message' as const,
									role: 'assistant' as const,
									status: 'completed' as const,
									content: [{ type: 'output_text' as const, text: reply.text }]
								}
							]
						: []),
					...reply.calls.map((call) => ({
						type: 'function_call' as const,
						status: 'completed' as const,
						...call
					}))
				]
			}
		};
	}

	private answer(items: AgentInputItem[]): { text: string; calls: ScriptedCall[] } {
		const last = items.at(-1);
		const question = lastQuestion(items).toLowerCase();

		if (last?.type === 'function_call_result') {
			const output = last.output;
			const result = parse(
				typeof output === 'string' ? output : 'text' in output ? output.text : ''
			);
			return this.afterTool(last.name, result, question);
		}
		if (/\b(take|remove)\b.*\boff\b/.test(question)) {
			return { text: 'Let me find it on the plan first. ', calls: [this.call('get_plan')] };
		}
		if (/\b(list|shop|buy)\b/.test(question)) {
			return { text: '', calls: [this.call('get_shop_list')] };
		}
		if (/\b(plan|week)\b/.test(question)) {
			return { text: 'I’ll look at your plan. ', calls: [this.call('get_plan')] };
		}
		if (/\b(tonight|dinner|eat)\b/.test(question)) {
			return { text: '', calls: [this.call('whats_for_tonight')] };
		}
		return {
			text:
				'I’m the scripted Basil for trying the app locally, so I only know a few things. Ask me ' +
				'what’s for dinner tonight, what’s on the plan, what’s on the list, or to take a meal off ' +
				'the plan, and I’ll use the real tools to answer.',
			calls: []
		};
	}

	private afterTool(
		tool: string,
		result: Record<string, unknown>,
		question: string
	): { text: string; calls: ScriptedCall[] } {
		if ('declined' in result) return { text: 'No problem, I’ve left it as it was.', calls: [] };
		if ('failure' in result) {
			return { text: `That didn’t work: ${String(result.failure)}`, calls: [] };
		}
		if (tool === 'remove_plan_slot') {
			return { text: `Done. ${String(result.message ?? 'It’s off the plan.')}`, calls: [] };
		}
		if (tool === 'get_plan') {
			const planned = plannedMeals(result);
			if (/\b(take|remove)\b.*\boff\b/.test(question)) {
				const target =
					planned.find((meal) => question.includes(meal.title.toLowerCase())) ?? planned[0];
				if (!target) return { text: 'There’s nothing on the plan to take off.', calls: [] };
				return {
					text: `${target.title} is on ${target.weekday}. I’ll ask before I take it off.`,
					calls: [this.call('remove_plan_slot', { plannedMealId: target.plannedMealId })]
				};
			}
			if (planned.length === 0) {
				return {
					text: 'Nothing is planned yet. Open the Plan door and I can help fill the week.',
					calls: []
				};
			}
			const lines = planned
				.slice(0, 5)
				.map((meal) => `${meal.weekday}: ${meal.title}`)
				.join('\n');
			return { text: `Here’s what’s planned:\n${lines}`, calls: [] };
		}
		if (tool === 'get_shop_list') {
			const count = Number(result.count ?? 0);
			const dishes = Array.isArray(result.forDishes)
				? result.forDishes.map((group) => String((group as { dish?: unknown }).dish ?? ''))
				: [];
			if (count === 0) return { text: 'The list is empty. Nothing to buy right now.', calls: [] };
			const forWhat = dishes.length ? `, mostly for ${dishes.slice(0, 3).join(', ')}` : '';
			return {
				text: `There are ${count} things on the list${forWhat}. Want me to open the Shop door?`,
				calls: []
			};
		}
		if (tool === 'whats_for_tonight') {
			const meal = result.meal as { title?: unknown; minutes?: unknown } | null;
			if (meal?.title) {
				const minutes = meal.minutes ? `, about ${String(meal.minutes)} minutes` : '';
				return {
					text: `Tonight it’s ${String(meal.title)}${minutes}. Everything else is on the Tonight door.`,
					calls: []
				};
			}
			return {
				text: 'Nothing is planned for tonight. The Tonight door has a few ideas from what you have.',
				calls: []
			};
		}
		return { text: 'Done.', calls: [] };
	}

	private call(name: string, args: Record<string, unknown> = {}): ScriptedCall {
		this.sequence += 1;
		return {
			callId: `scripted-${Date.now()}-${this.sequence}`,
			name,
			arguments: JSON.stringify(args)
		};
	}
}

/** The words in pieces of two or three, as a streaming model sends them. */
function pieces(text: string): string[] {
	const words = text.split(/(?<=\s)/);
	const out: string[] = [];
	for (let i = 0; i < words.length; i += 3) out.push(words.slice(i, i + 3).join(''));
	return out;
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((done) => {
		if (signal.aborted) return done();
		const timer = setTimeout(done, ms);
		signal.addEventListener(
			'abort',
			() => {
				clearTimeout(timer);
				done();
			},
			{ once: true }
		);
	});
}

function parse(content: string): Record<string, unknown> {
	try {
		const value: unknown = JSON.parse(content);
		return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

/** What the person last asked. */
function lastQuestion(items: AgentInputItem[]): string {
	for (const item of [...items].reverse()) {
		if (item.type !== 'message' || item.role !== 'user') continue;
		if (typeof item.content === 'string') return item.content;
		return item.content.map((part) => (part.type === 'input_text' ? part.text : '')).join('');
	}
	return '';
}

function userItem(text: string): AgentInputItem {
	return { type: 'message', role: 'user', content: text };
}

function plannedMeals(
	result: Record<string, unknown>
): { title: string; weekday: string; plannedMealId: string }[] {
	if (!Array.isArray(result.slots)) return [];
	return result.slots.flatMap((slot) => {
		const s = slot as {
			weekday?: string;
			planned?: { title?: string; plannedMealId?: string } | null;
		};
		if (!s.planned?.title || !s.planned.plannedMealId) return [];
		return [
			{ title: s.planned.title, weekday: s.weekday ?? '', plannedMealId: s.planned.plannedMealId }
		];
	});
}

/** Hands out the scripted model, whatever model name the agent asks for. */
export class DevScriptedModelProvider implements ModelProvider {
	constructor(private model: Model = new DevScriptedAgentModel()) {}

	async getModel(): Promise<Model> {
		return this.model;
	}
}
