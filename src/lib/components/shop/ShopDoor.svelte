<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Notepad from '$lib/components/Notepad.svelte';
	import { DoorHeader } from '$lib/components/doors';
	import RecipePhoto from '$lib/components/tonight/RecipePhoto.svelte';
	import {
		addItem,
		getShop,
		gotEverything,
		removeItem,
		toggleItem
	} from '$lib/remote/shop/shop.remote';
	import { ideaList, thingsCount } from '$lib/services/shop';
	import { formatAmount } from '$lib/services/tonight';
	import { notice } from '$lib/state/notice.svelte';
	import IdeaPick from './IdeaPick.svelte';
	import ReceiptSheet from './ReceiptSheet.svelte';
	import ShopEnd from './ShopEnd.svelte';
	import ShopItemRow from './ShopItemRow.svelte';

	const shop = getShop();
	const view = $derived(await shop);

	/** Ticks shown before the server has them; a tick is one row, so it never waits. */
	let ticks = $state<Record<string, boolean>>({});
	/** Dinners picked from the ideas, for a household that does not plan. */
	let picked = $state<string[]>([]);
	let busy = $state(false);
	let receiptOpen = $state(false);
	let newItem = $state('');

	const ideaItems = $derived(ideaList(view.ideas, picked));
	const hasList = $derived(view.hasList || ideaItems.length > 0);
	const isTicked = (id: string, checked: boolean) => ticks[id] ?? checked;

	// Another member may have changed the list; look again when the page comes back.
	$effect(() => {
		const onVisible = () => {
			if (document.visibilityState === 'visible' && !receiptOpen) shop.refresh();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	});

	async function tick(itemId: string, checked: boolean) {
		ticks[itemId] = checked;
		try {
			await toggleItem({ itemId, checked });
		} catch {
			ticks[itemId] = !checked;
			notice.show('That didn’t go through. Try again in a moment.');
		}
	}

	async function run<T>(action: () => Promise<T>, onDone: (result: T) => void) {
		busy = true;
		try {
			onDone(await action());
		} catch {
			notice.show('That didn’t go through. Try again in a moment.');
		} finally {
			busy = false;
		}
	}

	function gotIt() {
		run(
			() => gotEverything({ ideas: view.mode === 'ideas' ? picked : [] }),
			(result) => {
				ticks = {};
				picked = [];
				notice.show(result.message);
			}
		);
	}

	function add(event: SubmitEvent) {
		event.preventDefault();
		const name = newItem.trim();
		if (!name) return;
		run(
			() => addItem({ name }),
			() => (newItem = '')
		);
	}

	function togglePick(recipeId: string) {
		picked = picked.includes(recipeId)
			? picked.filter((id) => id !== recipeId)
			: [...picked, recipeId];
	}
</script>

<div class="mx-auto grid max-w-md gap-4 pb-8">
	<DoorHeader greeting={view.greeting} question={view.question} />

	{#if view.mode === 'ideas'}
		<p class="font-hand px-0.5 text-lg text-ink-light">
			Tick a few dinners and the list fills itself.
		</p>
		<div class="grid gap-2">
			{#each view.ideas as idea (idea.recipeId)}
				<IdeaPick
					{idea}
					picked={picked.includes(idea.recipeId)}
					ontoggle={() => togglePick(idea.recipeId)}
				/>
			{/each}
		</div>
		{#if ideaItems.length}
			<section class="rounded-2xl border border-border bg-bg-card p-3" aria-labelledby="your-list">
				<h3 id="your-list" class="font-display text-lg text-ink">Your list</h3>
				<ul>
					{#each ideaItems as item (item.itemKey)}
						<ShopItemRow
							name={item.name}
							amount={item.quantity === null ? '' : formatAmount(item.quantity, item.unit ?? '')}
							checked={ticks[item.itemKey] ?? false}
							ontoggle={(checked) => (ticks[item.itemKey] = checked)}
						/>
					{/each}
				</ul>
			</section>
		{/if}
	{:else}
		<div class="flex items-baseline justify-between px-0.5">
			<h2 class="text-[15px] font-bold text-ink">{view.title}</h2>
			<span class="text-[13px] text-text-muted">{thingsCount(view.count)}</span>
		</div>

		{#if view.empty === 'plan-first'}
			<EmptyState
				art="cal"
				title="Nothing planned yet"
				description="Plan a few dinners and the list writes itself."
				action={{ label: 'Plan first', href: resolve('/planning') }}
			/>
		{:else if view.empty === 'nothing-needed'}
			<EmptyState
				art="basket"
				title="Nothing you need right now"
				description="Everything planned until then is already at home."
			/>
		{/if}

		{#if view.groups.length}
			<Notepad class="bg-transparent">
				<div class="px-3 pt-4 pb-1.5">
					{#each view.groups as group (group.mealId)}
						<section
							class="border-b border-dashed border-border pt-1 pb-2 last:border-b-0"
							aria-label="For {group.title}"
						>
							<div class="flex items-center gap-2.5 py-1">
								<RecipePhoto
									title={group.title}
									imageUrl={group.imageUrl}
									small
									class="size-[34px]! rounded-lg!"
								/>
								<span class="grid leading-tight">
									<b class="text-[13.5px] text-ink">{group.title}</b>
									<small class="text-[11.5px] text-text-muted">{group.when}</small>
								</span>
							</div>
							<ul>
								{#each group.items as item (item.id)}
									<ShopItemRow
										name={item.name}
										amount={item.amount}
										also={item.also}
										checked={isTicked(item.id, item.checked)}
										ontoggle={(checked) => tick(item.id, checked)}
									/>
								{/each}
							</ul>
						</section>
					{/each}
				</div>
			</Notepad>
		{/if}

		{#if view.usuals.length}
			<section
				class="rounded-2xl border border-border bg-bg-card p-3"
				aria-labelledby="running-low"
			>
				<h3 id="running-low" class="font-display text-lg text-ink">Running low</h3>
				<ul>
					{#each view.usuals as item (item.id)}
						<ShopItemRow
							name={item.name}
							amount={item.amount}
							checked={isTicked(item.id, item.checked)}
							ontoggle={(checked) => tick(item.id, checked)}
						/>
					{/each}
				</ul>
			</section>
		{/if}

		{#if view.held}
			<section
				class="grid gap-0.5 rounded-2xl border border-border bg-bg-card p-3 opacity-60"
				aria-labelledby="held-back"
			>
				<h3 id="held-back" class="font-display text-lg text-ink">Waiting for {view.held.shop}</h3>
				<span class="text-xs text-text-muted">Not needed before then, so it stays fresh.</span>
				<ul>
					{#each view.held.items as item, i (i)}
						<li
							class="flex items-center gap-2.5 border-b border-dashed border-border py-1.5 text-sm last:border-b-0"
						>
							<span class="flex-1 text-ink">
								{item.name} <span class="text-xs text-text-muted">{item.days.join(', ')}</span>
							</span>
							<span class="text-[13px] text-text-muted tabular-nums">{item.amount}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}

	{#if view.manual.length}
		<section class="rounded-2xl border border-border bg-bg-card p-3" aria-labelledby="also-list">
			<h3 id="also-list" class="font-display text-lg text-ink">Also on the list</h3>
			<ul>
				{#each view.manual as item (item.id)}
					<ShopItemRow
						name={item.name}
						amount={item.amount}
						checked={isTicked(item.id, item.checked)}
						ontoggle={(checked) => tick(item.id, checked)}
						onremove={item.source === 'MANUAL'
							? () =>
									run(
										() => removeItem({ itemId: item.id }),
										() => {}
									)
							: undefined}
					/>
				{/each}
			</ul>
		</section>
	{/if}

	<form class="flex gap-2" onsubmit={add}>
		<label for="add-item" class="sr-only">Add something to the list</label>
		<input
			id="add-item"
			bind:value={newItem}
			maxlength="120"
			placeholder="Add something…"
			class="h-10 min-w-0 flex-1 rounded-xl border border-border bg-bg-card px-3 text-sm text-ink placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none"
		/>
		<Button type="submit" variant="secondary" class="h-10" disabled={busy || !newItem.trim()}>
			Add
		</Button>
	</form>

	<ShopEnd
		habit={view.doneHabit}
		{hasList}
		{busy}
		onsnap={() => (receiptOpen = true)}
		ongot={gotIt}
	/>
</div>

<ReceiptSheet bind:open={receiptOpen} onconfirmed={(message) => notice.show(message)} />
