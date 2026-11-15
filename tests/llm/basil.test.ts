/// <reference types="vitest/globals" />
/**
 * Basil against a real model: the loop, the run lifecycle, the real tools and the Plan fakes,
 * with OpenRouter streaming as the model. Run with `npm run test:llm`; skipped without
 * OPENROUTER_API_KEY.
 */
import { v4 as uuid } from 'uuid';
import { describeLLM, OPENROUTER_API_KEY, CHEAP_CHAT_MODEL } from './setup';
import { createBasil } from '../fakes/basil';
import { actor } from '../fakes/tonight';
import { OpenRouterAgentModel } from '../../src/lib/services/agent/OpenRouterAgentModel';
import { DAY0, at } from '../helpers/kitchenEvents';

const NOW = at(6, 10);

describeLLM('Basil (LLM Integration)', () => {
	const model = () =>
		new OpenRouterAgentModel(OPENROUTER_API_KEY, process.env.BASIL_MODEL || CHEAP_CHAT_MODEL);

	async function ask(b: ReturnType<typeof createBasil>, text: string, door: 'tonight' | 'plan') {
		const { runId } = await b.basil.submit(
			actor,
			{ text, pageContext: { door, route: `/${door}` }, requestId: uuid() },
			NOW,
			'UTC'
		);
		await b.runService.idle();
		return runId;
	}

	it('streams its answer about what is for dinner in pieces', async () => {
		const b = createBasil(model());
		const curry = await b.addRecipe('Chickpea curry', [
			{ name: 'Chickpeas', quantity: 1, unit: 'can' }
		]);
		await b.planOn(curry, DAY0 + 6);
		const runId = await ask(b, 'What are we having for dinner tonight?', 'tonight');
		const words = b.runs
			.eventsOf(runId)
			.map((event) => (event.type === 'text_delta' ? event.text : ''))
			.join('');
		expect(words.toLowerCase()).toContain('curry');
	});

	it('proposes taking a meal off the plan instead of doing it', async () => {
		const b = createBasil(model());
		const curry = await b.addRecipe('Chickpea curry', [
			{ name: 'Chickpeas', quantity: 1, unit: 'can' }
		]);
		const dinner = await b.planOn(curry, DAY0 + 6);
		await ask(b, 'Take tonight’s curry off the plan please.', 'plan');
		expect(await b.plannedMeals.findById(dinner.id)).not.toBeNull();
	});
});
