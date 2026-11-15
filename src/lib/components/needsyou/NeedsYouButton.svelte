<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { Info } from 'lucide-svelte';
	import * as Sheet from '$lib/components/ui/sheet';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import type { NeedsYouAction, NeedsYouItem, NeedsYouKind } from '$lib/models/needsyou';
	import { answer, getNeedsYou } from '$lib/remote/needsyou/needsyou.remote';
	import { notice } from '$lib/state/notice.svelte';

	const needsYou = getNeedsYou();
	let open = $state(false);
	let busyKey = $state<string | null>(null);

	const count = $derived(needsYou.current?.count ?? 0);
	const items = $derived(needsYou.current?.items ?? []);

	// Questions change with what other members do; look again on every door and every opening.
	afterNavigate(() => {
		needsYou.refresh();
	});

	/** A small dot that says what kind of question it is, as in the prototype. */
	const DOT: Record<NeedsYouKind, string> = {
		ProbablyGoneOff: 'bg-[repeating-linear-gradient(-45deg,#c9a99a_0_2px,#eadfd6_2px_4px)]',
		StillGotForTonight: 'bg-sienna-500',
		GoesOffToday: 'bg-sienna-500',
		MissingBeforeMeal: 'bg-amber-300',
		BackFromShop: 'bg-amber-300',
		ShopDayOffer: 'bg-amber-300',
		OpenPlanDays: 'bg-sage-500',
		PrepDay: 'bg-sage-500',
		HouseholdEvent: 'bg-slate-400'
	};

	async function act(item: NeedsYouItem, action: NeedsYouAction) {
		if (action.command === 'open' && action.href) {
			if (item.kind === 'HouseholdEvent') await answer({ key: item.key, command: 'open' });
			open = false;
			// The link comes from the server's list of doors and the door's own query.
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(action.href);
			return;
		}
		busyKey = item.key;
		try {
			const result = await answer({ key: item.key, command: action.command });
			if (result.message) notice.show(result.message);
		} catch {
			notice.show('That didn’t go through. Try again in a moment.');
		} finally {
			busyKey = null;
		}
	}
</script>

<button
	type="button"
	class="relative grid size-8 place-items-center rounded-full border border-border bg-bg-card text-ink-light hover:text-ink focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none"
	aria-label={count ? `Needs you: ${count}` : 'Needs you'}
	onclick={() => {
		open = true;
		needsYou.refresh();
	}}
>
	<Info class="size-4.5" aria-hidden="true" />
	{#if count}
		<span
			class="absolute -top-1.5 -right-1.5 grid h-4.25 min-w-4.25 place-items-center rounded-full bg-sienna-500 px-1 text-[10.5px] leading-none font-bold text-white"
			aria-hidden="true">{count}</span
		>
	{/if}
</button>

<Sheet.Root bind:open>
	<Sheet.Content
		side="bottom"
		class="mx-auto max-h-[85dvh] w-full max-w-lg gap-3 overflow-y-auto rounded-t-3xl bg-bg-paper px-4 pt-3 pb-8"
	>
		<span class="mx-auto h-1.5 w-10 rounded-full bg-border" aria-hidden="true"></span>
		<Sheet.Header class="p-0 text-left">
			<Sheet.Title class="font-display text-2xl font-semibold text-ink">Needs you</Sheet.Title>
			<Sheet.Description class="sr-only">Questions the app has for you.</Sheet.Description>
		</Sheet.Header>
		{#if items.length}
			<ul class="grid gap-2" aria-live="polite">
				{#each items as item (item.key)}
					<li
						class="grid gap-2 rounded-xl border border-border bg-bg-card px-3 py-2.5 text-sm"
						data-kind={item.kind}
					>
						<p class="flex items-start gap-2 text-ink">
							<i class="mt-1.25 size-2.5 flex-none rounded-full {DOT[item.kind]}" aria-hidden="true"
							></i>
							{item.text}
						</p>
						{#if item.actions.length}
							<div class="flex flex-wrap gap-2 pl-4.5">
								{#each item.actions as action (action.label)}
									<button
										type="button"
										class="h-8 rounded-lg px-3 text-[13px] font-semibold disabled:opacity-60 {action.ghost
											? 'border border-border bg-transparent text-ink-light'
											: 'bg-sage-600 text-white hover:bg-sage-700'}"
										disabled={busyKey === item.key}
										onclick={() => act(item, action)}
									>
										{action.label}
									</button>
								{/each}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<EmptyState
				art="jar"
				title="All caught up"
				description="Nothing needs you right now. Go cook something nice."
				class="[&_p]:font-hand py-8 [&_p]:text-base"
			/>
		{/if}
	</Sheet.Content>
</Sheet.Root>
