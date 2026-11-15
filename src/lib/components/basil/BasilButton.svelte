<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { page } from '$app/state';
	import * as Sheet from '$lib/components/ui/sheet';
	import type {
		BasilConversationView,
		BasilRunEventRecord,
		ClientAction,
		Touched
	} from '$lib/models/agent';
	import {
		approve,
		cancel,
		decline,
		getConversation,
		sendMessage,
		startOver
	} from '$lib/remote/basil/basil.remote';
	import { notice } from '$lib/state/notice.svelte';
	import ActionCard from './ActionCard.svelte';
	import { BASIL_HELLO, SUGGESTIONS } from './suggestions';
	import { RunStream, sessionRunMemory } from './runStream';
	import {
		basilDoorOf,
		highlightWhenShown,
		open as openDoor,
		readPageContext,
		refreshDoors,
		runClientActions
	} from './browser';

	const conversation = getConversation();
	let open = $state(false);
	let draft = $state('');
	/** Waiting for the server to take a message or a decision. */
	let sending = $state(false);
	/** What the person just sent, shown until the conversation has it. */
	let sent = $state<string | null>(null);
	let list = $state<HTMLElement | null>(null);

	/** The run Basil is answering in, while it answers. */
	let runId = $state<string | null>(null);
	/** Basil's words of the current step, as they stream in. */
	let streaming = $state('');
	/** What the last tool did, until Basil says more: "Looking at your plan…". */
	let toolLabel = $state<string | null>(null);
	let stopping = $state(false);
	let stream: RunStream | null = null;
	/** Steps for the browser, carried out once Basil has finished. */
	let pendingClientActions: ClientAction[] = [];
	/**
	 * The run that just ended and its last cursor. The conversation may name it active for a
	 * moment longer; a decision resumes it later with new events.
	 */
	let finished: { runId: string; cursor: number } | null = null;
	let lastCursor = 0;

	const view = $derived<BasilConversationView>(
		conversation.current ?? { entries: [], pendingActionId: null, activeRun: null }
	);
	const busy = $derived(sending || runId !== null);
	const door = $derived(basilDoorOf(page.url.pathname));
	const suggestions = $derived(door ? SUGGESTIONS[door] : []);

	async function scrollDown() {
		await tick();
		list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
	}

	/** Follows a run. After a reload, events up to `appliedUpTo` rebuild the words only. */
	function follow(id: string, after: number, appliedUpTo = after) {
		stream?.close();
		runId = id;
		streaming = '';
		toolLabel = null;
		stopping = false;
		pendingClientActions = [];
		stream = new RunStream(
			{ runId: id, after, appliedUpTo, onEvent: handle },
			undefined,
			sessionRunMemory
		);
	}

	async function handle(record: BasilRunEventRecord, replayed: boolean) {
		const event = record.event;
		lastCursor = record.cursor;
		switch (event.type) {
			case 'text_delta':
				toolLabel = null;
				streaming += event.text;
				await scrollDown();
				return;
			case 'tool_started':
				// The words before a tool are stored with its call; show them from the conversation.
				toolLabel = event.label;
				await conversation.refresh();
				streaming = '';
				await scrollDown();
				return;
			case 'client_action':
				if (!replayed) pendingClientActions.push(event.action);
				return;
			case 'resources_stale':
				if (!replayed) refreshDoors(event.doors);
				return;
			case 'approval_required':
			case 'completed':
			case 'failed':
			case 'cancelled':
				await finish();
				return;
			default:
				return;
		}
	}

	/** The run ended: show the stored conversation, then carry out Basil's browser steps. */
	async function finish() {
		await conversation.refresh();
		streaming = '';
		toolLabel = null;
		finished = runId ? { runId, cursor: lastCursor } : null;
		runId = null;
		stopping = false;
		stream = null;
		await scrollDown();
		const actions = pendingClientActions;
		pendingClientActions = [];
		if (actions.length) {
			// Let the answer show for a moment, then step aside so the page can be seen.
			await new Promise((done) => setTimeout(done, 700));
			open = false;
			await runClientActions(actions);
		}
	}

	// Follow the run still answering after a reload, or one started in another tab.
	$effect(() => {
		const active = conversation.current?.activeRun;
		if (!active || sending || runId === active.id) return;
		if (finished?.runId === active.id && active.cursor <= finished.cursor) return;
		const remembered = sessionRunMemory.load();
		const appliedUpTo = remembered?.runId === active.id ? remembered.cursor : active.cursor;
		follow(active.id, 0, appliedUpTo);
	});

	onDestroy(() => stream?.close());

	async function start(submit: () => Promise<{ runId: string | null; cursor: number }>) {
		sending = true;
		await scrollDown();
		try {
			const receipt = await submit();
			if (receipt.runId) follow(receipt.runId, receipt.cursor);
		} catch {
			notice.show('Basil couldn’t answer just now. Try again in a moment.');
		} finally {
			sending = false;
			sent = null;
			await scrollDown();
		}
	}

	async function send(text: string) {
		const message = text.trim();
		if (!message || busy) return;
		draft = '';
		sent = message;
		await start(() =>
			sendMessage({
				text: message,
				pageContext: readPageContext(page.url.pathname),
				requestId: crypto.randomUUID()
			})
		);
	}

	const decide = (actionId: string, yes: boolean) =>
		start(() => (yes ? approve : decline)({ actionId }));

	async function stop() {
		if (!runId || stopping) return;
		stopping = true;
		try {
			await cancel({ runId });
		} catch {
			stopping = false;
			notice.show('Basil couldn’t stop just now. Try again in a moment.');
		}
	}

	async function freshStart() {
		if (busy) return;
		try {
			await startOver();
		} catch {
			notice.show('Couldn’t start over just now. Try again in a moment.');
		}
	}

	async function openTouched(item: Touched) {
		open = false;
		if (item.kind === 'recipe') await openDoor(null, item.id);
		else if (basilDoorOf(page.url.pathname) !== item.door) await openDoor(item.door, null);
		if (item.key) await highlightWhenShown(item.key);
	}
</script>

<button
	type="button"
	class="font-display grid size-8 place-items-center rounded-full bg-sage-600 text-[15px] font-semibold text-white shadow-sm hover:bg-sage-700 focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 focus-visible:outline-none"
	aria-label="Ask Basil"
	onclick={async () => {
		open = true;
		await scrollDown();
	}}
>
	B
</button>

<Sheet.Root bind:open>
	<Sheet.Content
		side="bottom"
		class="mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col gap-3 rounded-t-3xl bg-bg-paper px-4 pt-3 pb-6"
	>
		<span class="mx-auto h-1.5 w-10 flex-none rounded-full bg-border" aria-hidden="true"></span>
		<Sheet.Header class="flex-none flex-row items-center gap-2.5 p-0 text-left">
			<span
				class="font-display grid size-8 flex-none place-items-center rounded-full bg-sage-600 text-[15px] font-semibold text-white"
				aria-hidden="true">B</span
			>
			<div class="grid">
				<Sheet.Title class="font-display text-2xl leading-tight font-semibold text-ink"
					>Basil</Sheet.Title
				>
				<Sheet.Description class="text-xs text-text-muted">
					Asks before it changes anything.
				</Sheet.Description>
			</div>
			{#if view.entries.length}
				<button
					type="button"
					class="ml-auto rounded-full border border-border px-2.5 py-1 text-[12.5px] text-ink-light hover:border-sage-300 disabled:opacity-60"
					disabled={busy}
					onclick={freshStart}>Start over</button
				>
			{/if}
		</Sheet.Header>

		<div
			bind:this={list}
			class="grid min-h-24 flex-1 content-start gap-2 overflow-y-auto overscroll-contain"
			aria-live="polite"
			data-basil-conversation
		>
			{#if view.entries.length === 0 && !sent}
				<p
					class="max-w-[88%] rounded-2xl border border-border bg-bg-card px-3 py-2 text-sm leading-snug text-ink"
				>
					{BASIL_HELLO}
				</p>
			{/if}
			{#each view.entries as entry (entry.id)}
				{#if entry.kind === 'user'}
					<p
						class="max-w-[88%] justify-self-end rounded-2xl bg-sage-100 px-3 py-2 text-sm leading-snug text-ink"
					>
						{entry.text}
					</p>
				{:else if entry.kind === 'basil'}
					<p
						class="max-w-[88%] rounded-2xl border border-border bg-bg-card px-3 py-2 text-sm leading-snug whitespace-pre-line text-ink"
					>
						{entry.text}
					</p>
				{:else}
					<ActionCard
						summary={entry.summary}
						status={entry.status}
						touched={entry.touched}
						{busy}
						onapprove={() => decide(entry.id, true)}
						ondecline={() => decide(entry.id, false)}
						onopen={openTouched}
					/>
				{/if}
			{/each}
			{#if sent}
				<p
					class="max-w-[88%] justify-self-end rounded-2xl bg-sage-100 px-3 py-2 text-sm leading-snug text-ink"
				>
					{sent}
				</p>
			{/if}
			{#if streaming}
				<p
					class="max-w-[88%] rounded-2xl border border-border bg-bg-card px-3 py-2 text-sm leading-snug whitespace-pre-line text-ink"
					data-basil-streaming
				>
					{streaming}<span
						class="ml-0.5 inline-block animate-pulse text-sage-600"
						aria-hidden="true">▍</span
					>
				</p>
			{/if}
			{#if toolLabel}
				<p
					class="flex max-w-[88%] items-center gap-1.5 justify-self-start rounded-full border border-sage-200 bg-sage-50 px-2.5 py-1 text-[12.5px] text-sage-800"
					data-basil-tool
				>
					<span class="size-1.5 animate-pulse rounded-full bg-sage-600" aria-hidden="true"></span>
					{toolLabel}
				</p>
			{:else if busy && !streaming}
				<p
					class="font-hand max-w-[88%] animate-pulse rounded-2xl border border-border bg-bg-card px-3 py-2 text-base text-ink-light"
				>
					{stopping ? 'Stopping…' : 'Basil is thinking…'}
				</p>
			{/if}
		</div>

		{#if suggestions.length && !view.pendingActionId}
			<div class="flex flex-none flex-wrap gap-1.5">
				{#each suggestions as suggestion (suggestion)}
					<button
						type="button"
						class="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[12.5px] text-ink hover:border-sage-300 disabled:opacity-60"
						disabled={busy}
						onclick={() => send(suggestion)}>{suggestion}</button
					>
				{/each}
			</div>
		{/if}

		<form
			class="flex flex-none gap-1.5"
			onsubmit={(event) => {
				event.preventDefault();
				send(draft);
			}}
		>
			<input
				bind:value={draft}
				class="h-10 min-w-0 flex-1 rounded-lg border border-border bg-white px-3 text-sm text-ink placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none"
				placeholder="Ask Basil…"
				aria-label="Message Basil"
				maxlength={1000}
				disabled={busy}
			/>
			{#if runId}
				<button
					type="button"
					class="h-10 rounded-lg border border-sienna-300 bg-white px-4 text-sm font-semibold text-sienna-700 hover:bg-sienna-50 disabled:opacity-60"
					disabled={stopping}
					onclick={stop}>Stop</button
				>
			{:else}
				<button
					type="submit"
					class="h-10 rounded-lg bg-sage-600 px-4 text-sm font-semibold text-white hover:bg-sage-700 disabled:opacity-60"
					disabled={busy || !draft.trim()}>Send</button
				>
			{/if}
		</form>
	</Sheet.Content>
</Sheet.Root>
