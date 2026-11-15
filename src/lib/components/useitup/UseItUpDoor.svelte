<script lang="ts">
	import { page } from '$app/state';
	import { Plus } from 'lucide-svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PinnedNote from '$lib/components/PinnedNote.svelte';
	import { DoorHeader, SlimState } from '$lib/components/doors';
	import type { ChangeResult, HomeItem, ItemSave } from '$lib/models/useitup';
	import {
		addItem,
		getUseItUp,
		markGone,
		setQuantity,
		stillGood,
		undoCorrection
	} from '$lib/remote/useitup/useitup.remote';
	import { notice } from '$lib/state/notice.svelte';
	import { undoToastState } from '$lib/state/undoToast.svelte';
	import HomeRow from './HomeRow.svelte';
	import IdeasSheet from './IdeasSheet.svelte';
	import ItemSheet from './ItemSheet.svelte';

	const door = getUseItUp();
	const view = $derived(await door);

	let busy = $state(false);
	let showAll = $state(false);
	let ideasFor = $state<Pick<HomeItem, 'itemKey' | 'name'> | null>(null);
	let ideasOpen = $state(false);
	let editing = $state<HomeItem | null>(null);
	let itemOpen = $state(false);

	const total = $derived(view.eatFirst.length + view.everything.length);
	const empty = $derived(!view.tracks && total === 0);

	// "Ideas" in Needs you opens the door with the item's ideas: `?ideas=<item key>`.
	$effect(() => {
		const key = page.url.searchParams.get('ideas');
		if (!key) return;
		const item = [...view.eatFirst, ...view.everything].find((x) => x.itemKey === key);
		ideasFor = item ?? { itemKey: key, name: key };
		ideasOpen = true;
	});

	async function change(action: () => Promise<ChangeResult>) {
		busy = true;
		try {
			const result = await action();
			undoToastState.show({
				message: result.message,
				onUndo: async () => {
					try {
						await undoCorrection({ undoId: result.undoId });
					} catch {
						notice.show('That couldn’t be undone.');
					}
				}
			});
		} catch {
			notice.show('That didn’t go through. Try again in a moment.');
		} finally {
			busy = false;
		}
	}

	const gone = (item: HomeItem) => change(() => markGone({ itemKey: item.itemKey }));
	const still = (item: HomeItem) => change(() => stillGood({ itemKey: item.itemKey }));
	const ideas = (item: HomeItem) => {
		ideasFor = item;
		ideasOpen = true;
	};
	const edit = (item: HomeItem | null) => {
		editing = item;
		itemOpen = true;
	};

	async function save(input: ItemSave) {
		const item = editing;
		await change(() =>
			item
				? setQuantity({ itemKey: item.itemKey, quantity: input.quantity ?? 0, unit: input.unit })
				: addItem(input)
		);
		itemOpen = false;
	}
</script>

<div class="mx-auto grid max-w-md gap-4 pb-8">
	<DoorHeader greeting={view.greeting} question={view.question} />

	{#if empty}
		<EmptyState
			art="jar"
			title="Nothing to keep track of"
			description="You don’t keep a kitchen here, and that’s fine. Snap a receipt in Shop and what you bought shows up here for a few days."
			action={{ label: 'Add something', onclick: () => edit(null) }}
		/>
	{:else}
		{#if view.frontNames}
			<PinnedNote rotate="-rotate-1" class="w-full">
				<p class="font-hand text-[17px] leading-snug text-ink">
					First in, first out. Put the <b>{view.frontNames}</b> at the front.
				</p>
			</PinnedNote>
		{/if}

		{#if view.eatFirst.length}
			<ul aria-label="Eat first">
				{#each view.eatFirst as item (item.itemKey)}
					<HomeRow
						{item}
						detailed
						disabled={busy}
						onideas={ideas}
						ongone={gone}
						onstill={still}
						onedit={edit}
					/>
				{/each}
			</ul>
		{:else}
			<SlimState
				art="jar"
				title="Nothing needs rescuing"
				hand="Everything has a few good days left."
			/>
		{/if}

		<div class="flex items-center justify-between gap-2">
			<button
				type="button"
				class="text-sm font-semibold text-sage-700 underline underline-offset-2"
				aria-expanded={showAll}
				onclick={() => (showAll = !showAll)}
			>
				{showAll ? 'Hide' : 'Everything at home'} ({total})
			</button>
			<button
				type="button"
				class="inline-flex items-center gap-1 text-sm text-ink-light hover:text-ink"
				onclick={() => edit(null)}
			>
				<Plus class="size-4" aria-hidden="true" /> Add something
			</button>
		</div>

		{#if showAll}
			<ul aria-label="Everything at home">
				{#each view.everything as item (item.itemKey)}
					<HomeRow {item} disabled={busy} ongone={gone} onedit={edit} />
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<IdeasSheet bind:open={ideasOpen} item={ideasFor} />
<ItemSheet bind:open={itemOpen} item={editing} {busy} onsave={save} />
