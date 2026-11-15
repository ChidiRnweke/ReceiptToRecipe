/// <reference types="vitest/globals" />
/**
 * Basil against a real model: the loop, the real tools and the Plan fakes, with OpenRouter as the
 * model. Run with `npm run test:llm`; skipped without OPENROUTER_API_KEY.
 */
import { describeLLM, OPENROUTER_API_KEY, CHEAP_CHAT_MODEL } from './setup';
import { createBasil } from '../fakes/basil';
import { actor } from '../fakes/tonight';
import { OpenRouterAgentModel } from '../../src/lib/services/agent/OpenRouterAgentModel';
import { DAY0, at } from '../helpers/kitchenEvents';

const NOW = at(6, 10);

describeLLM('Basil (LLM Integration)', () => {
	const model = () =>
		new OpenRouterAgentModel(OPENROUTER_API_KEY, process.env.BASIL_MODEL || CHEAP_CHAT_MODEL);

	it('reads the plan to answer what is for dinner', async () => {
		const b = createBasil(model());
		const curry = await b.addRecipe('Chickpea curry', [
			{ name: 'Chickpeas', quantity: 1, unit: 'can' }
		]);
		await b.planOn(curry, DAY0 + 6);
		const turn = await b.service.sendMessage(actor, b.toolboxFor(actor, NOW), {
			text: 'What are we having for dinner tonight?',
			pageContext: { door: 'tonight', route: '/tonight' },
			now: NOW
		});
		const last = turn.conversation.entries.at(-1);
		expect(last?.kind === 'basil' ? last.text.toLowerCase() : '').toContain('curry');
	});

	it('proposes taking a meal off the plan instead of doing it', async () => {
		const b = createBasil(model());
		const curry = await b.addRecipe('Chickpea curry', [
			{ name: 'Chickpeas', quantity: 1, unit: 'can' }
		]);
		const dinner = await b.planOn(curry, DAY0 + 6);
		await b.service.sendMessage(actor, b.toolboxFor(actor, NOW), {
			text: 'Take tonight’s curry off the plan please.',
			pageContext: { door: 'plan', route: '/plan' },
			now: NOW
		});
		expect(await b.plannedMeals.findById(dinner.id)).not.toBeNull();
	});
});
