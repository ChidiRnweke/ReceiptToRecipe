import { describe, it, expect } from 'vitest';
import {
	ChatStreamError,
	readChatStream,
	stitchToolCalls
} from '../../../src/lib/services/agent/chatStream';
import type { AgentModelDelta } from '../../../src/lib/services/interfaces/IAgentModel';

type Chunk = Parameters<typeof readChatStream>[0] extends AsyncIterable<infer C> ? C : never;

async function* chunksOf(chunks: Chunk[]): AsyncGenerator<Chunk> {
	for (const chunk of chunks) yield chunk;
}

const delta = (value: Chunk['choices'][number]['delta']): Chunk => ({
	choices: [{ index: 0, delta: value, finishReason: null }]
});

async function read(chunks: Chunk[]): Promise<AgentModelDelta[]> {
	const out: AgentModelDelta[] = [];
	for await (const piece of readChatStream(chunksOf(chunks))) out.push(piece);
	return out;
}

describe('stitchToolCalls', () => {
	it('joins one call’s argument fragments', () => {
		expect(
			stitchToolCalls([
				{ index: 0, id: 'call-1', function: { name: 'get_recipe', arguments: '{"reci' } },
				{ index: 0, function: { arguments: 'peId":"r1"}' } }
			])
		).toEqual([{ id: 'call-1', name: 'get_recipe', arguments: '{"recipeId":"r1"}' }]);
	});

	it('keeps several calls apart by their index', () => {
		const stitched = stitchToolCalls([
			{ index: 0, id: 'a', function: { name: 'get_plan', arguments: '' } },
			{ index: 1, id: 'b', function: { name: 'get_shop_list', arguments: '{' } },
			{ index: 0, function: { arguments: '{}' } },
			{ index: 1, function: { arguments: '}' } }
		]);
		expect(stitched).toEqual([
			{ id: 'a', name: 'get_plan', arguments: '{}' },
			{ id: 'b', name: 'get_shop_list', arguments: '{}' }
		]);
	});

	it('orders calls by index, not by arrival', () => {
		const stitched = stitchToolCalls([
			{ index: 1, id: 'b', function: { name: 'habits' } },
			{ index: 0, id: 'a', function: { name: 'get_plan' } }
		]);
		expect(stitched.map((c) => c.id)).toEqual(['a', 'b']);
	});

	it('gives a call without an id one from its index', () => {
		expect(stitchToolCalls([{ index: 2, function: { name: 'habits' } }])[0].id).toBe('call-2');
	});
});

describe('readChatStream', () => {
	it('yields the words as they arrive', async () => {
		const pieces = await read([delta({ content: 'Curry ' }), delta({ content: 'tonight.' })]);
		expect(pieces).toEqual([
			{ type: 'text', text: 'Curry ' },
			{ type: 'text', text: 'tonight.' }
		]);
	});

	it('yields the stitched tool calls once the stream ends', async () => {
		const pieces = await read([
			delta({
				toolCalls: [{ index: 0, id: 'c1', function: { name: 'get_plan', arguments: '{' } }]
			}),
			delta({ toolCalls: [{ index: 0, function: { arguments: '}' } }] })
		]);
		expect(pieces).toEqual([
			{ type: 'tool_calls', calls: [{ id: 'c1', name: 'get_plan', arguments: '{}' }] }
		]);
	});

	it('fails on a chunk that carries an error', async () => {
		await expect(
			read([
				delta({ content: 'Cur' }),
				{ choices: [], error: { message: 'Provider overloaded', code: 502 } }
			])
		).rejects.toThrow(ChatStreamError);
	});
});
