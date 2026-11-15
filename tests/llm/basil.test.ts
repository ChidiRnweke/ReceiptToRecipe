/// <reference types="vitest/globals" />
/**
 * Basil against a real model: the agent on the OpenAI Agents SDK, the run lifecycle, the real
 * tools and the Plan fakes, with OpenRouter streaming as the model. Uses Basil's production
 * default model unless BASIL_MODEL names another. Run with `npm run test:llm`; skipped without
 * OPENROUTER_API_KEY.
 */
import { v4 as uuid } from 'uuid';
import { describeLLM, OPENROUTER_API_KEY } from './setup';
import { createBasil } from '../fakes/basil';
import { actor } from '../fakes/tonight';
import { openRouterModelProvider } from '../../src/lib/services/agent/openRouter';
import { DAY0, at } from '../helpers/kitchenEvents';

const NOW = at(6, 10);

// `scripted` is the dev stand-in that a local .env may name; this test is about a real model.
const named = process.env.BASIL_MODEL === 'scripted' ? '' : process.env.BASIL_MODEL;
const MODEL = named || 'google/gemini-3-flash-preview';

describeLLM('Basil (LLM Integration)', () => {
	const basil = async () =>
		createBasil(await openRouterModelProvider(OPENROUTER_API_KEY).getModel(MODEL), {
			modelName: MODEL
		});

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
		const b = await basil();
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
		const b = await basil();
		const curry = await b.addRecipe('Chickpea curry', [
			{ name: 'Chickpeas', quantity: 1, unit: 'can' }
		]);
		const dinner = await b.planOn(curry, DAY0 + 6);
		await ask(b, 'Take tonight’s curry off the plan please.', 'plan');
		expect(await b.plannedMeals.findById(dinner.id)).not.toBeNull();
	});

	it('takes the meal off once the person says yes', async () => {
		const b = await basil();
		const curry = await b.addRecipe('Chickpea curry', [
			{ name: 'Chickpeas', quantity: 1, unit: 'can' }
		]);
		const dinner = await b.planOn(curry, DAY0 + 6);
		await ask(b, 'Take tonight’s curry off the plan please.', 'plan');
		const { pendingActionId } = await b.basil.getConversation(actor);
		await b.basil.decide(actor, { actionId: pendingActionId ?? '' }, true, NOW);
		await b.runService.idle();
		expect(await b.plannedMeals.findById(dinner.id)).toBeNull();
	});
});
