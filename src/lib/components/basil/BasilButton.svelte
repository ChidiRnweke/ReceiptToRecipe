<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import * as Sheet from '$lib/components/ui/sheet';
	import type { BasilConversationView, BasilTurnResult, Touched } from '$lib/models/agent';
	import { approve, decline, getConversation, sendMessage } from '$lib/remote/basil/basil.remote';
	import { notice } from '$lib/state/notice.svelte';
	import ActionCard from './ActionCard.svelte';
	import { BASIL_HELLO, SUGGESTIONS } from './suggestions';
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
	let thinking = $state(false);
	/** What the person just sent, shown until Basil's answer comes back. */
	let sent = $state<string | null>(null);
	let latest = $state<BasilConversationView | null>(null);
	let list = $state<HTMLElement | null>(null);

	const view = $derived(latest ?? conversation.current ?? { entries: [], pendingActionId: null });
	const door = $derived(basilDoorOf(page.url.pathname));
	const suggestions = $derived(door ? SUGGESTIONS[door] : []);

	async function scrollDown() {
		await tick();
		list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
	}

	async function settle(result: BasilTurnResult) {
		latest = result.conversation;
		refreshDoors(result.staleDoors);
		await scrollDown();
		if (result.clientActions.length) {
			// Let the answer show for a moment, then step aside so the page can be seen.
			await new Promise((done) => setTimeout(done, 700));
			open = false;
			await runClientActions(result.clientActions);
		}
	}

	async function turn(run: () => Promise<BasilTurnResult>) {
		thinking = true;
		await scrollDown();
		try {
			await settle(await run());
		} catch {
			notice.show('Basil couldn’t answer just now. Try again in a moment.');
		} finally {
			thinking = false;
			sent = null;
		}
	}

	async function send(text: string) {
		const message = text.trim();
		if (!message || thinking) return;
		draft = '';
		sent = message;
		await turn(() =>
			sendMessage({ text: message, pageContext: readPageContext(page.url.pathname) })
		);
	}

	const decide = (actionId: string, yes: boolean) =>
		turn(() =>
			(yes ? approve : decline)({ actionId, pageContext: readPageContext(page.url.pathname) })
		);

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
						busy={thinking}
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
			{#if thinking}
				<p
					class="font-hand max-w-[88%] animate-pulse rounded-2xl border border-border bg-bg-card px-3 py-2 text-base text-ink-light"
				>
					Basil is thinking…
				</p>
			{/if}
		</div>

		{#if suggestions.length && !view.pendingActionId}
			<div class="flex flex-none flex-wrap gap-1.5">
				{#each suggestions as suggestion (suggestion)}
					<button
						type="button"
						class="rounded-full border border-border bg-bg-card px-2.5 py-1 text-[12.5px] text-ink hover:border-sage-300 disabled:opacity-60"
						disabled={thinking}
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
				disabled={thinking}
			/>
			<button
				type="submit"
				class="h-10 rounded-lg bg-sage-600 px-4 text-sm font-semibold text-white hover:bg-sage-700 disabled:opacity-60"
				disabled={thinking || !draft.trim()}>Send</button
			>
		</form>
	</Sheet.Content>
</Sheet.Root>
