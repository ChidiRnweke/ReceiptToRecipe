import { describe, it, expect, beforeEach } from 'vitest';
import { createBasil } from '../../fakes/basil';
import {
	FailingAgentModel,
	ScriptedAgentModel,
	call,
	calls,
	says
} from '../../fakes/ScriptedAgentModel';
import { actor } from '../../fakes/tonight';
import { DAY0, at } from '../../helpers/kitchenEvents';
import {
	MAX_STEPS,
	MODEL_DOWN_REPLY,
	STEP_LIMIT_REPLY
} from '../../../src/lib/services/agent/AgentService';
import type { BasilConversationView, PageContext } from '../../../src/lib/models/agent';
import type { Actor } from '../../../src/lib/models/household';
import { v4 as uuid } from 'uuid';

// Day 0 of the test calendar is Monday 2 November 2026, in UTC. "Now" is Sunday 10:00.
const NOW = at(6, 10);
const TODAY = DAY0 + 6;
const ON_PLAN: PageContext = { door: 'plan', route: '/plan' };

const sam: Actor = { ...actor, userId: 'user-2', memberId: 'member-2', displayName: 'Sam Haddad' };

describe('Basil’s loop', () => {
	let model: ScriptedAgentModel;
	let b: ReturnType<typeof createBasil>;
	let curry: { id: string; title: string };
	let dinnerId: string;

	beforeEach(async () => {
		model = new ScriptedAgentModel();
		b = createBasil(model);
		curry = await b.addRecipe('Chickpea curry', [{ name: 'Chickpeas', quantity: 1, unit: 'can' }]);
		dinnerId = (await b.planOn(curry, TODAY)).id;
	});

	/** The person sends a message and Basil's run finishes. */
	async function send(text: string, who: Actor = actor): Promise<BasilConversationView> {
		await b.basil.submit(who, { text, pageContext: ON_PLAN, requestId: uuid() }, NOW, 'UTC');
		await b.runService.idle();
		return b.basil.getConversation(who);
	}
	async function decideOn(actionId: string, yes: boolean, who: Actor = actor) {
		const receipt = await b.basil.decide(
			who,
			{ actionId, requestId: uuid(), pageContext: ON_PLAN },
			yes,
			NOW,
			'UTC'
		);
		await b.runService.idle();
		return receipt;
	}
	const approve = (actionId: string, who: Actor = actor) => decideOn(actionId, true, who);
	const decline = (actionId: string) => decideOn(actionId, false);
	const eventsOf = (runId: string | null) => (runId ? b.runs.eventsOf(runId) : []);

	/** The person asks to take tonight's curry off; Basil proposes it. */
	async function proposeRemoval(): Promise<string> {
		model.then(calls(call('remove_plan_slot', { plannedMealId: dinnerId })));
		const view = await send('Take the curry off tonight');
		return view.pendingActionId as string;
	}

	const lastEntry = (view: BasilConversationView) => view.entries.at(-1);

	describe('a read tool', () => {
		it('runs at once and its result goes back to the model', async () => {
			model.then(calls(call('get_plan')), says('Chickpea curry tonight.'));
			await send('What are we eating?');
			expect(JSON.stringify(model.lastToolResult())).toContain('Chickpea curry');
		});

		it('needs no approval', async () => {
			model.then(calls(call('get_plan')), says('Chickpea curry tonight.'));
			const view = await send('What are we eating?');
			expect(view.pendingActionId).toBeNull();
		});

		it('shows the model’s answer as Basil’s words', async () => {
			model.then(calls(call('get_plan')), says('Chickpea curry tonight.'));
			const view = await send('What are we eating?');
			expect(lastEntry(view)).toMatchObject({ kind: 'basil', text: 'Chickpea curry tonight.' });
		});

		it('tells the model the page the person is on', async () => {
			model.then(says('Hi.'));
			await send('Hello');
			expect(JSON.stringify(model.requests[0].messages)).toContain('page_context');
		});
	});

	describe('a change', () => {
		it('waits for approval', async () => {
			expect(await proposeRemoval()).toEqual(expect.any(String));
		});

		it('changes nothing before the person says yes', async () => {
			await proposeRemoval();
			expect(await b.plannedMeals.findById(dinnerId)).not.toBeNull();
		});

		it('is shown in plain words on its card', async () => {
			await proposeRemoval();
			const card = b.actions.actions[0];
			expect(card.summary).toBe('Take chickpea curry off today’s dinner.');
		});

		it('ends the turn without asking the model again', async () => {
			await proposeRemoval();
			expect(model.requests).toHaveLength(1);
		});

		it('is dropped when the person sends a new message instead', async () => {
			const actionId = await proposeRemoval();
			model.then(says('Sure.'));
			await send('Never mind, what else is there?');
			expect((await b.actions.findById(actionId))?.status).toBe('declined');
		});
	});

	describe('declining', () => {
		it('executes nothing', async () => {
			const actionId = await proposeRemoval();
			model.then(says('No problem.'));
			await decline(actionId);
			expect(await b.plannedMeals.findById(dinnerId)).not.toBeNull();
		});

		it('records the decision', async () => {
			const actionId = await proposeRemoval();
			model.then(says('No problem.'));
			await decline(actionId);
			expect((await b.actions.findById(actionId))?.status).toBe('declined');
		});

		it('lets the model reply', async () => {
			const actionId = await proposeRemoval();
			model.then(says('No problem.'));
			await decline(actionId);
			expect(lastEntry(await b.basil.getConversation(actor))).toMatchObject({
				kind: 'basil',
				text: 'No problem.'
			});
		});
	});

	describe('approving', () => {
		it('executes the change', async () => {
			const actionId = await proposeRemoval();
			model.then(says('Done, it’s off.'));
			await approve(actionId);
			expect(await b.plannedMeals.findById(dinnerId)).toBeNull();
		});

		it('records what the change touched', async () => {
			const actionId = await proposeRemoval();
			model.then(says('Done, it’s off.'));
			await approve(actionId);
			expect((await b.actions.findById(actionId))?.touched).toEqual([
				{
					kind: 'planned-meal',
					id: `${TODAY}:DINNER`,
					label: 'Chickpea curry',
					door: 'plan',
					key: `plan-slot:${TODAY}:DINNER`
				}
			]);
		});

		it('hands the result to the model', async () => {
			const actionId = await proposeRemoval();
			model.then(says('Done, it’s off.'));
			await approve(actionId);
			expect(model.lastToolResult()).toEqual({ message: 'Chickpea curry is off the plan.' });
		});

		it('names the doors whose data changed', async () => {
			const actionId = await proposeRemoval();
			model.then(says('Done, it’s off.'));
			const receipt = await approve(actionId);
			const stale = eventsOf(receipt.runId).find((event) => event.type === 'resources_stale');
			expect(stale).toMatchObject({ doors: expect.arrayContaining(['plan']) });
		});

		it('runs the change only once when approved twice', async () => {
			const actionId = await proposeRemoval();
			model.then(says('Done.'));
			await approve(actionId);
			const second = await approve(actionId);
			expect(second.runId).toBeNull();
		});

		it('sets the servings of a meal for guests', async () => {
			model.then(calls(call('guests_for_meal', { plannedMealId: dinnerId, servings: 4 })));
			const view = await send('Friends over tonight, we are four');
			model.then(says('It’s for four now.'));
			await approve(view.pendingActionId as string);
			expect((await b.plannedMeals.findById(dinnerId))?.servings).toBe(4);
		});

		it('re-validates the stored arguments before it runs them', async () => {
			const actionId = await proposeRemoval();
			const stored = b.actions.actions.find((action) => action.id === actionId);
			if (stored) stored.args = { plannedMealId: 'not-a-uuid' };
			model.then(says('That didn’t work.'));
			await approve(actionId);
			expect((await b.actions.findById(actionId))?.status).toBe('failed');
		});
	});

	describe('the step limit', () => {
		it('stops a model that keeps calling tools', async () => {
			const looping = new ScriptedAgentModel([], () => calls(call('get_plan')));
			b = createBasil(looping);
			const view = await send('Plan forever');
			expect(lastEntry(view)).toMatchObject({ kind: 'basil', text: STEP_LIMIT_REPLY });
		});

		it('calls the model at most eight times in a turn', async () => {
			const looping = new ScriptedAgentModel([], () => calls(call('get_plan')));
			b = createBasil(looping);
			await send('Plan forever');
			expect(looping.requests).toHaveLength(MAX_STEPS);
		});
	});

	describe('failures', () => {
		it('returns a tool failure to the model with a way to recover', async () => {
			model.then(
				calls(call('get_recipe', { recipeId: '6f1c2c1e-0000-4000-8000-000000000000' })),
				says('I can’t find that one.')
			);
			await send('Show me that recipe');
			expect(model.lastToolResult()).toEqual({
				failure: 'Recipe not found',
				recovery: expect.stringContaining('find_recipes')
			});
		});

		it('returns invalid arguments to the model instead of proposing the change', async () => {
			model.then(
				calls(call('set_plan_slot', { daysFromToday: 2, meal: 'DINNER', recipeId: 'curry' })),
				says('Let me look that up.')
			);
			const view = await send('Curry on Tuesday');
			expect(view.pendingActionId).toBeNull();
		});

		it('answers an unknown tool with a failure', async () => {
			model.then(calls(call('delete_everything')), says('I can’t do that.'));
			await send('Delete everything');
			expect(model.lastToolResult()).toMatchObject({
				failure: 'There is no tool called delete_everything.'
			});
		});

		it('apologises in words when the model cannot be reached', async () => {
			b = createBasil(new FailingAgentModel());
			const view = await send('Hello');
			expect(lastEntry(view)).toMatchObject({ kind: 'basil', text: MODEL_DOWN_REPLY });
		});
	});

	describe('the actor is bound', () => {
		let theirsId: string;

		beforeEach(async () => {
			theirsId = (
				await b.plannedMeals.create({
					userId: 'user-9',
					householdId: 'household-9',
					recipeId: curry.id,
					mealName: 'Their curry',
					plannedDate: at(6, 12),
					plannedCalories: 600,
					mealType: 'DINNER'
				})
			).id;
		});

		it('proposes no change to another household’s meal', async () => {
			model.then(
				calls(call('remove_plan_slot', { plannedMealId: theirsId })),
				says('I can’t find it.')
			);
			const view = await send('Remove their dinner');
			expect(view.pendingActionId).toBeNull();
		});

		it('leaves another household’s meal on its plan', async () => {
			model.then(
				calls(call('remove_plan_slot', { plannedMealId: theirsId })),
				says('I can’t find it.')
			);
			await send('Remove their dinner');
			expect(await b.plannedMeals.findById(theirsId)).not.toBeNull();
		});

		it('ignores a household id the model adds to the arguments', async () => {
			model.then(
				calls(call('remove_plan_slot', { plannedMealId: theirsId, householdId: 'household-9' })),
				says('I can’t do that.')
			);
			await send('Remove their dinner');
			expect(model.lastToolResult()).toMatchObject({ failure: expect.any(String) });
		});

		it('does not let another member approve the change', async () => {
			const actionId = await proposeRemoval();
			await expect(approve(actionId, sam)).rejects.toThrow('Action not found');
		});
	});

	describe('client tools', () => {
		it('hands a navigation to the browser', async () => {
			model.then(calls(call('navigate_to', { door: 'shop' })), says('Here’s the list.'));
			await send('Show me the list');
			expect(b.runs.events.map((record) => record.event)).toContainEqual({
				type: 'client_action',
				action: { tool: 'navigate_to', door: 'shop', recipeId: null }
			});
		});
	});

	describe('the conversation', () => {
		it('is kept per member', async () => {
			model.then(says('Hi Noor.'));
			await send('Hello');
			expect((await b.basil.getConversation(sam)).entries).toEqual([]);
		});

		it('shows the card after the words that proposed it', async () => {
			await proposeRemoval();
			const view = await b.basil.getConversation(actor);
			expect(view.entries.map((entry) => entry.kind)).toEqual(['user', 'action']);
		});
	});
});
