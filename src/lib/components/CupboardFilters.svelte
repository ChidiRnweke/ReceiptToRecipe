<script lang="ts">
	import { Search, SlidersHorizontal, X } from 'lucide-svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import { slide } from 'svelte/transition';

	let {
		searchQuery = '',
		sortBy = 'confidence',
		categories = [],
		activeCategory = 'all',
		onsearchchange,
		onsortchange,
		oncategorychange
	} = $props<{
		searchQuery: string;
		sortBy: string;
		categories: string[];
		activeCategory: string;
		onsearchchange: (query: string) => void;
		onsortchange: (sort: string) => void;
		oncategorychange: (category: string) => void;
	}>();

	let showMobileFilters = $state(false);

	const sortOptions = [
		{ value: 'confidence', label: 'Confidence' },
		{ value: 'name', label: 'Name A-Z' },
		{ value: 'expires', label: 'Expires Soonest' },
		{ value: 'recent', label: 'Recently Added' }
	];

	const hasActiveFilters = $derived(
		searchQuery.trim() !== '' || sortBy !== 'confidence' || activeCategory !== 'all'
	);
</script>

<!-- Desktop: inline filters -->
<div class="hidden sm:flex sm:items-center sm:gap-3">
	<div class="relative flex-1">
		<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
		<input
			type="text"
			placeholder="Search your cupboard..."
			value={searchQuery}
			oninput={(e) => onsearchchange(e.currentTarget.value)}
			class="font-ui w-full rounded-lg border border-sand/60 bg-bg-input py-2 pr-3 pl-9 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
		/>
	</div>

	<div class="flex items-center gap-2">
		<select
			class="font-ui rounded-lg border border-sand/60 bg-bg-input px-2 py-2 text-xs text-text-secondary focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
			value={sortBy}
			onchange={(e) => onsortchange(e.currentTarget.value)}
		>
			{#each sortOptions as option}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>

		{#if categories.length > 0}
			<select
				class="font-ui rounded-lg border border-sand/60 bg-bg-input px-2 py-2 text-xs text-text-secondary focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
				value={activeCategory}
				onchange={(e) => oncategorychange(e.currentTarget.value)}
			>
				<option value="all">All Categories</option>
				{#each categories as cat}
					<option value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
				{/each}
			</select>
		{/if}
	</div>
</div>

<!-- Mobile: compact search + filter button -->
<div class="flex items-center gap-2 sm:hidden">
	<div class="relative flex-1">
		<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
		<input
			type="text"
			placeholder="Search..."
			value={searchQuery}
			oninput={(e) => onsearchchange(e.currentTarget.value)}
			class="font-ui w-full rounded-lg border border-sand/60 bg-bg-input py-2 pr-3 pl-9 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
		/>
	</div>

	<Button
		variant="outline"
		size="sm"
		class="shrink-0 gap-1.5 {hasActiveFilters
			? 'border-primary-300 bg-primary-50 text-primary-700'
			: ''}"
		onclick={() => (showMobileFilters = true)}
	>
		<SlidersHorizontal class="h-3.5 w-3.5" />
		Filters
		{#if hasActiveFilters}
			<span
				class="flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[9px] font-bold text-white"
			>
				!
			</span>
		{/if}
	</Button>
</div>

<!-- Mobile filter modal -->
<AlertDialog.Root bind:open={showMobileFilters}>
	<AlertDialog.Content
		class="max-w-sm overflow-hidden bg-bg-paper p-0"
		interactOutsideBehavior="close"
	>
		<AlertDialog.Header class="relative border-b border-sand/40 bg-white p-4 pr-12">
			<button
				type="button"
				class="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-bg-hover hover:text-ink"
				onclick={() => (showMobileFilters = false)}
			>
				<X class="h-4 w-4" />
				<span class="sr-only">Close</span>
			</button>
			<AlertDialog.Title class="font-display text-lg text-ink">Filter & Sort</AlertDialog.Title>
			<AlertDialog.Description class="text-xs text-ink-muted">
				Narrow down your cupboard items.
			</AlertDialog.Description>
		</AlertDialog.Header>

		<div class="space-y-5 bg-white p-5">
			<!-- Sort -->
			<div class="space-y-2">
				<label
					for="mobile-sort"
					class="font-ui text-xs font-medium tracking-wide text-ink-muted uppercase"
				>
					Sort by
				</label>
				<select
					id="mobile-sort"
					class="font-ui w-full rounded-lg border border-sand/60 bg-bg-input px-3 py-2.5 text-sm text-text-secondary focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
					value={sortBy}
					onchange={(e) => onsortchange(e.currentTarget.value)}
				>
					{#each sortOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<!-- Category -->
			{#if categories.length > 0}
				<div class="space-y-2">
					<label
						for="mobile-category"
						class="font-ui text-xs font-medium tracking-wide text-ink-muted uppercase"
					>
						Category
					</label>
					<select
						id="mobile-category"
						class="font-ui w-full rounded-lg border border-sand/60 bg-bg-input px-3 py-2.5 text-sm text-text-secondary focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
						value={activeCategory}
						onchange={(e) => oncategorychange(e.currentTarget.value)}
					>
						<option value="all">All Categories</option>
						{#each categories as cat}
							<option value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
						{/each}
					</select>
				</div>
			{/if}
		</div>

		<AlertDialog.Footer class="flex gap-2 border-t border-sand/40 bg-bg-paper-dark/30 p-4">
			{#if hasActiveFilters}
				<Button
					variant="ghost"
					size="sm"
					onclick={() => {
						onsearchchange('');
						onsortchange('confidence');
						oncategorychange('all');
					}}
				>
					Clear all
				</Button>
			{/if}
			<Button size="sm" class="ml-auto" onclick={() => (showMobileFilters = false)}>Done</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
