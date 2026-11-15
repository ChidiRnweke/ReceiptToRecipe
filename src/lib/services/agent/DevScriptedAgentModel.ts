import type { AgentToolCall } from '$lib/models/agent';
import type {
	AgentModelDelta,
	AgentModelMessage,
	AgentModelRequest,
	IAgentModel
} from '../interfaces/IAgentModel';

/** How long the scripted model waits between pieces of its words. */
const PIECE_MS = 180;

/**
 * A stand-in for the real model, for local development only (`BASIL_MODEL=scripted` in dev). It
 * reads the person's last message, calls Basil's real read tools, proposes a change for "take …
 * off", and streams its words a few at a time, so the sheet can be tried without a provider key.
 * It understands a handful of phrasings; it is not a model.
 */
export class DevScriptedAgentModel implements IAgentModel {
	private sequence = 0;

	constructor(private pieceMs = PIECE_MS) {}

	async *stream(request: AgentModelRequest, signal: AbortSignal): AsyncGenerator<AgentModelDelta> {
		const reply = this.answer(request.messages);
		// A real model takes a moment to read a tool's result before it answers.
		if (request.messages.at(-1)?.role === 'tool') await pause(this.pieceMs * 5, signal);
		if (reply.text) {
			for (const piece of pieces(reply.text)) {
				await pause(this.pieceMs, signal);
				if (signal.aborted) return;
				yield { type: 'text', text: piece };
			}
		}
		if (reply.calls.length) {
			await pause(this.pieceMs * 2, signal);
			if (signal.aborted) return;
			yield { type: 'tool_calls', calls: reply.calls };
		}
	}

	private answer(messages: AgentModelMessage[]): { text: string; calls: AgentToolCall[] } {
		const last = messages.at(-1);
		const asked = [...messages].reverse().find((message) => message.role === 'user');
		const question = asked?.role === 'user' ? asked.content.toLowerCase() : '';

		if (last?.role === 'tool') {
			const result = parse(last.content);
			const called = toolOf(messages, last.toolCallId);
			return this.afterTool(called, result, question);
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
	): { text: string; calls: AgentToolCall[] } {
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

	private call(name: string, args: Record<string, unknown> = {}): AgentToolCall {
		this.sequence += 1;
		return { id: `scripted-${Date.now()}-${this.sequence}`, name, arguments: JSON.stringify(args) };
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

function toolOf(messages: AgentModelMessage[], callId: string): string {
	for (const message of messages) {
		if (message.role !== 'assistant') continue;
		const call = message.toolCalls.find((candidate) => candidate.id === callId);
		if (call) return call.name;
	}
	return '';
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
