import { describe, it, expect, beforeEach } from 'vitest';
import { createBasil, createBasilOver } from '../../fakes/basil';
import { FailingModel, ScriptedModel, call, calls, says } from '../../fakes/InMemoryModelProvider';
import { actor } from '../../fakes/tonight';
import { DAY0, at } from '../../helpers/kitchenEvents';
import {
	LOST_REPLY,
	MAX_TURNS,
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

describe('Basil’s agent', () => {
	let model: ScriptedModel;
	let b: ReturnType<typeof createBasil>;
	let curry: { id: string; title: string };
	let dinnerId: string;

	beforeEach(async () => {
		model = new ScriptedModel();
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
		const receipt = await b.basil.decide(who, { actionId }, yes, NOW);
		await b.runService.idle();
		return receipt;
	}
	const approve = (actionId: string, who: Actor = actor) => decideOn(actionId, true, who);
	const decline = (actionId: string) => decideOn(actionId, false);
	const eventsOf = (runId: string | null) => (runId ? b.runs.eventsOf(runId) : []);

	/** The person asks to take tonight's curry off; Basil proposes it. */
	async function proposeRemoval(): Promise<string> {
		model.queue(calls(call('remove_plan_slot', { plannedMealId: dinnerId })));
		const view = await send('Take the curry off tonight');
		return view.pendingActionId as string;
	}

	const lastEntry = (view: BasilConversationView) => view.entries.at(-1);

	describe('a read tool', () => {
		it('runs at once and its result goes back to the model', async () => {
			model.queue(calls(call('get_plan')), says('Chickpea curry tonight.'));
			await send('What are we eating?');
			expect(JSON.stringify(model.lastToolResult())).toContain('Chickpea curry');
		});

		it('needs no approval', async () => {
			model.queue(calls(call('get_plan')), says('Chickpea curry tonight.'));
			const view = await send('What are we eating?');
			expect(view.pendingActionId).toBeNull();
		});

		it('shows the model’s answer as Basil’s words', async () => {
			model.queue(calls(call('get_plan')), says('Chickpea curry tonight.'));
			const view = await send('What are we eating?');
			expect(lastEntry(view)).toMatchObject({ kind: 'basil', text: 'Chickpea curry tonight.' });
		});

		it('tells the model the page the person is on', async () => {
			model.queue(says('Hi.'));
			await send('Hello');
			expect(model.requests[0].systemInstructions).toContain('page_context');
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
			model.queue(says('Sure.'));
			await send('Never mind, what else is there?');
			expect((await b.actions.findById(actionId))?.status).toBe('declined');
		});

		it('tells the model nothing changed when the person moved on', async () => {
			await proposeRemoval();
			model.queue(says('Sure.'));
			await send('Never mind, what else is there?');
			expect(model.lastToolResult()).toMatchObject({
				declined: true,
				note: expect.stringContaining('new message')
			});
		});

		it('is not run when the person moved on', async () => {
			await proposeRemoval();
			model.queue(says('Sure.'));
			await send('Never mind, what else is there?');
			expect(await b.plannedMeals.findById(dinnerId)).not.toBeNull();
		});

		it('answers the new message without first replying to the dropped change', async () => {
			await proposeRemoval();
			model.queue(says('Sure.'));
			await send('Never mind, what else is there?');
			expect(model.requests).toHaveLength(2);
		});

		it('gets one card when the model proposes two at once', async () => {
			model.queue(
				calls(
					call('remove_plan_slot', { plannedMealId: dinnerId }),
					call('guests_for_meal', { plannedMealId: dinnerId, servings: 4 })
				)
			);
			await send('Take the curry off, or make it for four');
			expect(b.actions.actions).toHaveLength(1);
		});

		it('tells the model a second change must wait for the first', async () => {
			model.queue(
				calls(
					call('remove_plan_slot', { plannedMealId: dinnerId }),
					call('guests_for_meal', { plannedMealId: dinnerId, servings: 4 })
				)
			);
			const view = await send('Take the curry off, or make it for four');
			model.queue(says('Done.'));
			await approve(view.pendingActionId as string);
			expect(model.lastToolResult()).toMatchObject({
				failure: 'Only one change can wait for a yes at a time.'
			});
		});

		it('leaves the second change undone', async () => {
			model.queue(
				calls(
					call('guests_for_meal', { plannedMealId: dinnerId, servings: 4 }),
					call('remove_plan_slot', { plannedMealId: dinnerId })
				)
			);
			const view = await send('Make it for four, or take the curry off');
			model.queue(says('Done.'));
			await approve(view.pendingActionId as string);
			expect(await b.plannedMeals.findById(dinnerId)).not.toBeNull();
		});
	});

	describe('declining', () => {
		it('executes nothing', async () => {
			const actionId = await proposeRemoval();
			model.queue(says('No problem.'));
			await decline(actionId);
			expect(await b.plannedMeals.findById(dinnerId)).not.toBeNull();
		});

		it('records the decision', async () => {
			const actionId = await proposeRemoval();
			model.queue(says('No problem.'));
			await decline(actionId);
			expect((await b.actions.findById(actionId))?.status).toBe('declined');
		});

		it('lets the model reply', async () => {
			const actionId = await proposeRemoval();
			model.queue(says('No problem.'));
			await decline(actionId);
			expect(lastEntry(await b.basil.getConversation(actor))).toMatchObject({
				kind: 'basil',
				text: 'No problem.'
			});
		});

		it('tells the model the person said not now', async () => {
			const actionId = await proposeRemoval();
			model.queue(says('No problem.'));
			await decline(actionId);
			expect(model.lastToolResult()).toMatchObject({
				declined: true,
				note: expect.stringContaining('not now')
			});
		});
	});

	describe('approving', () => {
		it('executes the change', async () => {
			const actionId = await proposeRemoval();
			model.queue(says('Done, it’s off.'));
			await approve(actionId);
			expect(await b.plannedMeals.findById(dinnerId)).toBeNull();
		});

		it('records what the change touched', async () => {
			const actionId = await proposeRemoval();
			model.queue(says('Done, it’s off.'));
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
			model.queue(says('Done, it’s off.'));
			await approve(actionId);
			expect(model.lastToolResult()).toEqual({ message: 'Chickpea curry is off the plan.' });
		});

		it('names the doors whose data changed', async () => {
			const actionId = await proposeRemoval();
			model.queue(says('Done, it’s off.'));
			const receipt = await approve(actionId);
			const stale = eventsOf(receipt.runId).find((event) => event.type === 'resources_stale');
			expect(stale).toMatchObject({ doors: expect.arrayContaining(['plan']) });
		});

		it('runs the change only once when approved twice', async () => {
			const actionId = await proposeRemoval();
			model.queue(says('Done.'));
			await approve(actionId);
			const second = await approve(actionId);
			expect(second.runId).toBeNull();
		});

		it('sets the servings of a meal for guests', async () => {
			model.queue(calls(call('guests_for_meal', { plannedMealId: dinnerId, servings: 4 })));
			const view = await send('Friends over tonight, we are four');
			model.queue(says('It’s for four now.'));
			await approve(view.pendingActionId as string);
			expect((await b.plannedMeals.findById(dinnerId))?.servings).toBe(4);
		});

		it('records a change that failed when it ran', async () => {
			const actionId = await proposeRemoval();
			// Gone before the yes: the change can no longer happen.
			await b.plannedMeals.delete(dinnerId);
			model.queue(says('That didn’t work.'));
			await approve(actionId);
			expect((await b.actions.findById(actionId))?.status).toBe('failed');
		});

		it('resumes from the stored state in a fresh process', async () => {
			const actionId = await proposeRemoval();
			const restarted = createBasilOver(b);
			model.queue(says('Done, it’s off.'));
			await restarted.basil.decide(actor, { actionId }, true, NOW);
			await restarted.runService.idle();
			expect(await b.plannedMeals.findById(dinnerId)).toBeNull();
		});
	});

	describe('the turn limit', () => {
		it('stops a model that keeps calling tools', async () => {
			const looping = new ScriptedModel([], () => calls(call('get_plan')));
			b = createBasil(looping);
			const view = await send('Plan forever');
			expect(lastEntry(view)).toMatchObject({ kind: 'basil', text: STEP_LIMIT_REPLY });
		});

		it('calls the model at most eight times in a turn', async () => {
			const looping = new ScriptedModel([], () => calls(call('get_plan')));
			b = createBasil(looping);
			await send('Plan forever');
			expect(looping.requests).toHaveLength(MAX_TURNS);
		});
	});

	describe('an empty answer', () => {
		it('is replaced by an apology, so a run never ends in silence', async () => {
			model.queue(calls(call('get_plan')), says(''));
			const view = await send('What are we eating?');
			expect(lastEntry(view)).toMatchObject({ kind: 'basil', text: LOST_REPLY });
		});

		it('streams the apology', async () => {
			model.queue(calls(call('get_plan')), says(''));
			await send('What are we eating?');
			expect(b.runs.events.map((record) => record.event)).toContainEqual({
				type: 'text_delta',
				text: LOST_REPLY
			});
		});
	});

	describe('failures', () => {
		it('returns a tool failure to the model with a way to recover', async () => {
			model.queue(
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
			model.queue(
				calls(call('set_plan_slot', { daysFromToday: 2, meal: 'DINNER', recipeId: 'curry' })),
				says('Let me look that up.')
			);
			const view = await send('Curry on Tuesday');
			expect(view.pendingActionId).toBeNull();
		});

		it('answers an unknown tool with a failure', async () => {
			model.queue(calls(call('delete_everything')), says('I can’t do that.'));
			await send('Delete everything');
			expect(model.lastToolResult()).toMatchObject({
				failure: 'There is no tool called delete_everything.'
			});
		});

		it('apologises in words when the model cannot be reached', async () => {
			b = createBasil(new FailingModel());
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
			model.queue(
				calls(call('remove_plan_slot', { plannedMealId: theirsId })),
				says('I can’t find it.')
			);
			const view = await send('Remove their dinner');
			expect(view.pendingActionId).toBeNull();
		});

		it('leaves another household’s meal on its plan', async () => {
			model.queue(
				calls(call('remove_plan_slot', { plannedMealId: theirsId })),
				says('I can’t find it.')
			);
			await send('Remove their dinner');
			expect(await b.plannedMeals.findById(theirsId)).not.toBeNull();
		});

		it('ignores a household id the model adds to the arguments', async () => {
			model.queue(
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
			model.queue(calls(call('navigate_to', { door: 'shop' })), says('Here’s the list.'));
			await send('Show me the list');
			expect(b.runs.events.map((record) => record.event)).toContainEqual({
				type: 'client_action',
				action: { tool: 'navigate_to', door: 'shop', recipeId: null }
			});
		});
	});

	describe('the conversation', () => {
		it('is kept per member', async () => {
			model.queue(says('Hi Noor.'));
			await send('Hello');
			expect((await b.basil.getConversation(sam)).entries).toEqual([]);
		});

		it('shows the card after the words that proposed it', async () => {
			model.queue({
				text: 'I’ll ask first.',
				calls: [call('remove_plan_slot', { plannedMealId: dinnerId })]
			});
			const view = await send('Take the curry off tonight');
			expect(view.entries.map((entry) => entry.kind)).toEqual(['user', 'basil', 'action']);
		});

		it('gives the model what was said before', async () => {
			model.queue(says('Hi Noor.'));
			await send('Hello');
			model.queue(says('Curry.'));
			await send('And dinner?');
			expect(JSON.stringify(model.requests.at(-1)?.input)).toContain('Hi Noor.');
		});
	});
});
