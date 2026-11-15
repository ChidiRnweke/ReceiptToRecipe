<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { ADD_CATEGORIES, type HomeItem, type ItemSave } from '$lib/models/useitup';

	interface Props {
		open: boolean;
		/** The item to change, or null to add something new. */
		item: HomeItem | null;
		busy?: boolean;
		onsave: (input: ItemSave) => void;
	}

	let { open = $bindable(), item, busy = false, onsave }: Props = $props();

	let name = $state('');
	let quantity = $state('');
	let unit = $state('');
	let category = $state('');

	// Each opening starts from the item it opens on.
	$effect(() => {
		if (!open) return;
		name = item?.name ?? '';
		quantity = item ? String(Math.round(item.quantity * 100) / 100) : '';
		unit = item && item.unit !== 'count' ? item.unit : '';
		category = '';
	});

	const editing = $derived(item !== null);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const amount = quantity.trim() === '' ? null : Number(quantity);
		if (!editing && !name.trim()) return;
		if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return;
		onsave({
			name: name.trim(),
			quantity: amount,
			unit: unit.trim() || null,
			category: category || null
		});
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side="bottom"
		class="mx-auto max-h-[85dvh] w-full max-w-lg gap-3 overflow-y-auto rounded-t-3xl bg-bg-paper px-4 pt-3 pb-8"
	>
		<span class="mx-auto h-1.5 w-10 rounded-full bg-border" aria-hidden="true"></span>
		<Sheet.Header class="p-0 text-left">
			<Sheet.Title class="font-display text-2xl font-semibold text-ink">
				{editing ? item?.name : 'Add something'}
			</Sheet.Title>
			<Sheet.Description class="text-[13px] text-text-muted">
				{editing
					? 'How much is left? The kitchen counts from this amount.'
					: 'Something that came home without a receipt.'}
			</Sheet.Description>
		</Sheet.Header>
		<form class="grid gap-3" onsubmit={submit}>
			{#if !editing}
				<div class="grid gap-1.5">
					<Label for="item-name">Name</Label>
					<Input id="item-name" bind:value={name} placeholder="Eggs" maxlength={120} required />
				</div>
			{/if}
			<div class="grid grid-cols-[1fr_7rem] gap-2">
				<div class="grid gap-1.5">
					<Label for="item-quantity">{editing ? 'Left' : 'How much'}</Label>
					<Input
						id="item-quantity"
						bind:value={quantity}
						inputmode="decimal"
						placeholder="6"
						required={editing}
					/>
				</div>
				<div class="grid gap-1.5">
					<Label for="item-unit">Unit</Label>
					<Input id="item-unit" bind:value={unit} placeholder="g, ml…" maxlength={20} />
				</div>
			</div>
			{#if !editing}
				<div class="grid gap-1.5">
					<Label for="item-category">Kind</Label>
					<select
						id="item-category"
						bind:value={category}
						class="h-9 rounded-md border border-border bg-bg-input px-2 text-sm"
					>
						<option value="">Not sure</option>
						{#each ADD_CATEGORIES as option (option)}
							<option value={option}>{option[0].toUpperCase() + option.slice(1)}</option>
						{/each}
					</select>
				</div>
			{/if}
			<Button type="submit" class="h-10 bg-sage-600 text-white hover:bg-sage-700" disabled={busy}>
				{editing ? 'Save' : 'Add it'}
			</Button>
		</form>
	</Sheet.Content>
</Sheet.Root>
