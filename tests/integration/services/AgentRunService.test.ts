import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuid } from 'uuid';
import { createBasil } from '../../fakes/basil';
import { ScriptedAgentModel, call, calls, holds, says } from '../../fakes/ScriptedAgentModel';
import { actor } from '../../fakes/tonight';
import { DAY0, at } from '../../helpers/kitchenEvents';
import {
	BasilBusyError,
	BasilRunForbiddenError,
	RESTARTED_REPLY,
	type BasilEvent,
	type BasilRunInput,
	type PageContext
} from '../../../src/lib/models/agent';
import type { Actor } from '../../../src/lib/models/household';

const NOW = at(6, 10);
const TODAY = DAY0 + 6;
const ON_PLAN: PageContext = { door: 'plan', route: '/plan' };
const sam: Actor = { ...actor, userId: 'user-2', memberId: 'member-2', displayName: 'Sam Haddad' };
const REPLY = 'Chickpea curry tonight, and shakshuka on Tuesday.';

const textOf = (events: BasilEvent[]) =>
	events.map((event) => (event.type === 'text_delta' ? event.text : '')).join('');

describe('Basil’s runs', () => {
	let model: ScriptedAgentModel;
	let b: ReturnType<typeof createBasil>;
	let dinnerId: string;

	beforeEach(async () => {
		model = new ScriptedAgentModel();
		b = createBasil(model);
		const curry = await b.addRecipe('Chickpea curry', [
			{ name: 'Chickpeas', quantity: 1, unit: 'can' }
		]);
		dinnerId = (await b.planOn(curry, TODAY)).id;
	});

	const submit = (text: string, requestId = uuid(), who: Actor = actor) =>
		b.basil.submit(who, { text, pageContext: ON_PLAN, requestId }, NOW, 'UTC');

	async function answered(text: string) {
		const receipt = await submit(text);
		await b.runService.idle();
		return receipt.runId;
	}

	const runOf = async (runId: string) => (await b.runs.findById(runId))!;
	const lastEntry = async () => (await b.basil.getConversation(actor)).entries.at(-1);

	/** A run that has said its words and keeps going until it is stopped. */
	async function runningRun(text = 'Thursday is'): Promise<string> {
		model.then(holds(text));
		const held = model.held();
		const { runId } = await submit('What’s on Thursday?');
		await held;
		return runId;
	}

	describe('streaming', () => {
		it('streams Basil’s words in order', async () => {
			model.then(says(REPLY));
			const runId = await answered('What are we eating?');
			expect(textOf(b.runs.eventsOf(runId))).toBe(REPLY);
		});

		it('starts with the run being queued and started, and ends with completed', async () => {
			model.then(says(REPLY));
			const runId = await answered('What are we eating?');
			const types = b.runs.eventsOf(runId).map((event) => event.type);
			expect([types[0], types[1], types.at(-1)]).toEqual([
				'run_queued',
				'run_started',
				'completed'
			]);
		});

		it('writes many pieces of words as one event within the flush window', async () => {
			b = createBasil(model, { flushMs: 10_000 });
			const curry = await b.addRecipe('Curry', []);
			await b.planOn(curry, TODAY);
			model.then(says(REPLY));
			const runId = await answered('What are we eating?');
			const deltas = b.runs.eventsOf(runId).filter((event) => event.type === 'text_delta');
			expect(deltas).toHaveLength(1);
		});

		it('names the tool it is using, in the doors’ words', async () => {
			model.then(calls(call('get_plan')), says('Curry tonight.'));
			const runId = await answered('What are we eating?');
			expect(b.runs.eventsOf(runId)).toContainEqual(
				expect.objectContaining({ type: 'tool_started', label: 'Looking at your plan…' })
			);
		});

		it('says when the tool has finished', async () => {
			model.then(calls(call('get_plan')), says('Curry tonight.'));
			const runId = await answered('What are we eating?');
			expect(b.runs.eventsOf(runId)).toContainEqual(
				expect.objectContaining({ type: 'tool_finished', name: 'get_plan', ok: true })
			);
		});

		it('is complete for the stream once settled and every event was read', async () => {
			model.then(says(REPLY));
			const runId = await answered('What are we eating?');
			const last = await b.runs.latestCursor(runId);
			expect(await b.basil.isStreamComplete(actor, runId, last)).toBe(true);
		});

		it('is not complete for the stream while events remain unread', async () => {
			model.then(says(REPLY));
			const runId = await answered('What are we eating?');
			expect(await b.basil.isStreamComplete(actor, runId, 0)).toBe(false);
		});
	});

	describe('a change', () => {
		async function proposed() {
			model.then(calls(call('remove_plan_slot', { plannedMealId: dinnerId })));
			return answered('Take the curry off tonight');
		}

		it('leaves the run waiting for approval', async () => {
			const runId = await proposed();
			expect((await runOf(runId)).status).toBe('awaiting_approval');
		});

		it('ends the stream with the approval card', async () => {
			const runId = await proposed();
			expect(b.runs.eventsOf(runId).at(-1)).toMatchObject({
				type: 'approval_required',
				action: { summary: 'Take chickpea curry off today’s dinner.' }
			});
		});

		it('lets Basil go on in a new run once approved', async () => {
			await proposed();
			const { pendingActionId } = await b.basil.getConversation(actor);
			model.then(says('Done, it’s off.'));
			await b.basil.decide(
				actor,
				{ actionId: pendingActionId!, requestId: uuid(), pageContext: ON_PLAN },
				true,
				NOW,
				'UTC'
			);
			await b.runService.idle();
			expect(await lastEntry()).toMatchObject({ kind: 'basil', text: 'Done, it’s off.' });
		});

		it('runs the decision as a run of its own kind', async () => {
			await proposed();
			const { pendingActionId } = await b.basil.getConversation(actor);
			const receipt = await b.basil.decide(
				actor,
				{ actionId: pendingActionId!, requestId: uuid(), pageContext: ON_PLAN },
				false,
				NOW,
				'UTC'
			);
			await b.runService.idle();
			expect((await runOf(receipt.runId!)).kind).toBe('decision');
		});
	});

	describe('submitting', () => {
		it('returns the same run for the same request id', async () => {
			const requestId = uuid();
			const first = await submit('Hello', requestId);
			const second = await submit('Hello', requestId);
			await b.runService.idle();
			expect(second.runId).toBe(first.runId);
		});

		it('stores the message once for the same request id', async () => {
			const requestId = uuid();
			await submit('Hello', requestId);
			await submit('Hello', requestId);
			await b.runService.idle();
			const users = b.messages.messages.filter((message) => message.role === 'user');
			expect(users).toHaveLength(1);
		});

		it('refuses a second message while Basil is still answering', async () => {
			const runId = await runningRun();
			await expect(submit('And Friday?')).rejects.toThrow(BasilBusyError);
			await b.basil.cancel(actor, runId, NOW);
		});

		it('shows the run still answering in the conversation', async () => {
			const runId = await runningRun();
			const view = await b.basil.getConversation(actor);
			await b.basil.cancel(actor, runId, NOW);
			expect(view.activeRun?.id).toBe(runId);
		});
	});

	describe('stopping', () => {
		it('keeps what Basil had said as its reply', async () => {
			const runId = await runningRun('Thursday is shakshuka, and');
			await b.basil.cancel(actor, runId, NOW);
			await b.runService.idle();
			expect(await lastEntry()).toMatchObject({
				kind: 'basil',
				text: 'Thursday is shakshuka, and'
			});
		});

		it('settles the run as cancelled', async () => {
			const runId = await runningRun();
			await b.basil.cancel(actor, runId, NOW);
			await b.runService.idle();
			expect((await runOf(runId)).status).toBe('cancelled');
		});

		it('ends the stream with cancelled', async () => {
			const runId = await runningRun();
			await b.basil.cancel(actor, runId, NOW);
			await b.runService.idle();
			expect(b.runs.eventsOf(runId).at(-1)).toEqual({ type: 'cancelled' });
		});

		it('cancels a queued run at once', async () => {
			const conversation = await b.service.conversationFor(actor, NOW);
			const { run } = await b.runService.submit(
				actor,
				{
					conversationId: conversation.id,
					requestId: uuid(),
					input: inputFor('Hi'),
					userMessage: 'Hi'
				},
				NOW
			);
			await b.basil.cancel(actor, run.id, NOW);
			expect((await runOf(run.id)).status).toBe('cancelled');
		});

		it('settles a run that does not stop by itself after the grace period', async () => {
			const stuck = new ScriptedAgentModel();
			stuck.stream = async function* () {
				yield { type: 'text' as const, text: 'Hmm' };
				await new Promise(() => undefined);
			};
			b = createBasil(stuck, { graceMs: 20 });
			const { runId } = await submit('Hello');
			await new Promise((done) => setTimeout(done, 5));
			await b.basil.cancel(actor, runId, NOW);
			await new Promise((done) => setTimeout(done, 60));
			expect((await runOf(runId)).status).toBe('cancelled');
		});

		it('refuses to stop another member’s run', async () => {
			const runId = await runningRun();
			await expect(b.basil.cancel(sam, runId, NOW)).rejects.toThrow(BasilRunForbiddenError);
			await b.basil.cancel(actor, runId, NOW);
		});
	});

	describe('after a restart', () => {
		/** A run stored as it was when the server went down, without executing it. */
		async function storedRun(text: string, status: 'queued' | 'running') {
			const conversation = await b.service.conversationFor(actor, NOW);
			const { run } = await b.runService.submit(
				actor,
				{
					conversationId: conversation.id,
					requestId: uuid(),
					input: inputFor(text),
					userMessage: text
				},
				NOW
			);
			if (status === 'running') {
				await b.runs.transition(run.id, ['queued'], { status: 'running' }, null);
			}
			return run.id;
		}

		it('fails a run that was running', async () => {
			const runId = await storedRun('Hello', 'running');
			await b.basil.recoverInterruptedRuns(NOW);
			expect((await runOf(runId)).status).toBe('failed');
		});

		it('says in the conversation that it was interrupted', async () => {
			await storedRun('Hello', 'running');
			await b.basil.recoverInterruptedRuns(NOW);
			expect(await lastEntry()).toMatchObject({ kind: 'basil', text: RESTARTED_REPLY });
		});

		it('starts a queued run again', async () => {
			model.then(says('Hi Noor.'));
			const runId = await storedRun('Hello', 'queued');
			await b.basil.recoverInterruptedRuns(NOW);
			await b.runService.idle();
			expect((await runOf(runId)).status).toBe('completed');
		});
	});
});

function inputFor(text: string): BasilRunInput {
	return {
		request: { kind: 'message', text, pageContext: ON_PLAN },
		actor,
		timeZone: 'UTC'
	};
}
