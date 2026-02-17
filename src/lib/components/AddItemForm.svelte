<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Package, Hash, Calendar, Tag } from 'lucide-svelte';
	import CategoryIcon from './CategoryIcon.svelte';
	import { cn } from '$lib/utils';

	let { existingItems = [] } = $props<{
		existingItems?: string[];
	}>();

	let itemName = $state('');
	let quantity = $state('');
	let unit = $state('');
	let category = $state('');
	let shelfLifeDays = $state('');
	let showAdvanced = $state(false);
	let isSubmitting = $state(false);

	const categories = [
		{ value: 'produce', label: 'Produce' },
		{ value: 'dairy', label: 'Dairy' },
		{ value: 'meat', label: 'Meat' },
		{ value: 'seafood', label: 'Seafood' },
		{ value: 'frozen', label: 'Frozen' },
		{ value: 'pantry', label: 'Pantry' },
		{ value: 'bakery', label: 'Bakery' },
		{ value: 'beverages', label: 'Beverages' },
		{ value: 'snacks', label: 'Snacks' },
		{ value: 'household', label: 'Household' },
		{ value: 'eggs', label: 'Eggs' },
		{ value: 'other', label: 'Other' }
	];

	const commonUnits = ['unit', 'pcs', 'g', 'kg', 'ml', 'l', 'oz', 'lb', 'cups', 'tbsp', 'tsp'];

	function handleSubmit() {
		isSubmitting = true;
	}

	function resetForm() {
		itemName = '';
		quantity = '';
		unit = '';
		category = '';
		shelfLifeDays = '';
		showAdvanced = false;
		isSubmitting = false;
	}
</script>

<form
	method="POST"
	action="?/addItem"
	use:enhance={() => {
		isSubmitting = true;
		return async ({ update }) => {
			await update();
			resetForm();
		};
	}}
	class="space-y-5"
>
	<div class="relative">
		<label
			for="itemName"
			class="font-ui mb-1.5 block text-xs font-medium tracking-wide text-ink-muted uppercase"
		>
			What did you buy?
		</label>
		<div class="relative">
			<Package class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted/50" />
			<input
				type="text"
				id="itemName"
				name="itemName"
				bind:value={itemName}
				placeholder="e.g. Organic tomatoes, Greek yogurt..."
				autocomplete="off"
				list="cupboard-suggestions"
				required
				class="font-body w-full rounded-lg border border-sand/60 bg-bg-input py-2.5 pr-3 pl-10 text-sm text-ink placeholder:text-ink-muted/50 focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
			/>
			{#if existingItems.length > 0}
				<datalist id="cupboard-suggestions">
					{#each existingItems as item}
						<option value={item}></option>
					{/each}
				</datalist>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-2 gap-3">
		<div>
			<label
				for="quantity"
				class="font-ui mb-1.5 block text-xs font-medium tracking-wide text-ink-muted uppercase"
			>
				Quantity
			</label>
			<div class="relative">
				<Hash class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted/50" />
				<input
					type="number"
					id="quantity"
					name="quantity"
					bind:value={quantity}
					placeholder="1"
					min="0"
					step="any"
					class="font-body w-full rounded-lg border border-sand/60 bg-bg-input py-2.5 pr-3 pl-9 text-sm text-ink placeholder:text-ink-muted/50 focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
				/>
			</div>
		</div>

		<div>
			<label
				for="unit"
				class="font-ui mb-1.5 block text-xs font-medium tracking-wide text-ink-muted uppercase"
			>
				Unit
			</label>
			<select
				id="unit"
				name="unit"
				bind:value={unit}
				class="font-body w-full rounded-lg border border-sand/60 bg-bg-input px-3 py-2.5 text-sm text-ink focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
			>
				<option value="">Select...</option>
				{#each commonUnits as u}
					<option value={u}>{u}</option>
				{/each}
			</select>
		</div>
	</div>

	<div>
		<label
			for="category"
			class="font-ui mb-1.5 block text-xs font-medium tracking-wide text-ink-muted uppercase"
		>
			Category
		</label>
		<select
			id="category"
			name="category"
			bind:value={category}
			class="font-body w-full rounded-lg border border-sand/60 bg-bg-input px-3 py-2.5 text-sm text-ink focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
		>
			<option value="">Select a category...</option>
			{#each categories as cat}
				<option value={cat.value}>
					{cat.label}
				</option>
			{/each}
		</select>
		<p class="mt-1 text-[10px] text-ink-muted/70">This helps estimate how long items stay fresh.</p>
	</div>

	<button
		type="button"
		class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-sand/60 py-2 text-xs text-ink-muted transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700"
		onclick={() => (showAdvanced = !showAdvanced)}
	>
		<Calendar class="h-3.5 w-3.5" />
		{showAdvanced ? 'Hide' : 'Custom'} shelf life
	</button>

	{#if showAdvanced}
		<div class="rounded-lg bg-bg-paper-dark/30 p-3">
			<label
				for="shelfLifeDays"
				class="font-ui mb-1.5 block text-xs font-medium tracking-wide text-ink-muted uppercase"
			>
				Days until expiration
			</label>
			<div class="relative">
				<Calendar class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted/50" />
				<input
					type="number"
					id="shelfLifeDays"
					name="shelfLifeDays"
					bind:value={shelfLifeDays}
					placeholder="e.g. 7 for a week"
					min="1"
					class="font-body w-full rounded-lg border border-sand/60 bg-bg-input py-2.5 pr-3 pl-9 text-sm text-ink placeholder:text-ink-muted/50 focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
				/>
			</div>
			<p class="mt-1.5 text-[10px] text-ink-muted/70">
				Override the default shelf life for this item.
			</p>
		</div>
	{/if}

	<div class="flex items-center justify-end gap-3 pt-2">
		<button
			type="button"
			class="font-ui rounded-lg px-4 py-2 text-sm text-ink-muted transition-colors hover:bg-bg-hover hover:text-ink"
			onclick={resetForm}
		>
			Clear
		</button>
		<button
			type="submit"
			disabled={!itemName.trim() || isSubmitting}
			class={cn(
				'flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all',
				itemName.trim() && !isSubmitting
					? 'bg-primary-600 hover:bg-primary-700 active:scale-[0.98]'
					: 'cursor-not-allowed bg-primary-300'
			)}
		>
			{#if isSubmitting}
				<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					/>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					/>
				</svg>
				Adding...
			{:else}
				<Plus class="h-4 w-4" />
				Add to Cupboard
			{/if}
		</button>
	</div>
</form>
