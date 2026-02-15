<script lang="ts">
	import { Search } from 'lucide-svelte';

	let {
		activeFilter = 'all',
		searchQuery = '',
		sortBy = 'confidence',
		categories = [],
		activeCategory = 'all',
		onfilterchange,
		onsearchchange,
		onsortchange,
		oncategorychange
	} = $props<{
		activeFilter: string;
		searchQuery: string;
		sortBy: string;
		categories: string[];
		activeCategory: string;
		onfilterchange: (filter: string) => void;
		onsearchchange: (query: string) => void;
		onsortchange: (sort: string) => void;
		oncategorychange: (category: string) => void;
	}>();

	const filters = [
		{ value: 'all', label: 'All' },
		{ value: 'in-stock', label: 'In Stock' },
		{ value: 'running-low', label: 'Running Low' },
		{ value: 'restock', label: 'Restock' }
	];

	const sortOptions = [
		{ value: 'confidence', label: 'Confidence' },
		{ value: 'name', label: 'Name A-Z' },
		{ value: 'expires', label: 'Expires Soonest' },
		{ value: 'recent', label: 'Recently Added' }
	];
</script>

<div class="space-y-3">
	<!-- Search bar -->
	<div class="relative">
		<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
		<input
			type="text"
			placeholder="Search your cupboard..."
			value={searchQuery}
			oninput={(e) => onsearchchange(e.currentTarget.value)}
			class="font-ui w-full rounded-lg border border-sand/60 bg-bg-input py-2 pr-3 pl-9 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
		/>
	</div>

	<!-- Status filter tabs -->
	<div class="flex gap-1.5">
		{#each filters as filter}
			<button
				type="button"
				class="rounded-full border px-3 py-1 text-xs font-medium transition-colors
					{activeFilter === filter.value
					? 'border-primary-300 bg-primary-100 text-primary-700'
					: 'border-sand/60 bg-bg-card text-text-muted hover:bg-bg-hover hover:text-text-secondary'}"
				onclick={() => onfilterchange(filter.value)}
			>
				{filter.label}
			</button>
		{/each}
	</div>

	<!-- Sort + Category row -->
	<div class="flex items-center gap-3">
		<select
			class="font-ui rounded-lg border border-sand/60 bg-bg-input px-2 py-1 text-xs text-text-secondary focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
			value={sortBy}
			onchange={(e) => onsortchange(e.currentTarget.value)}
		>
			{#each sortOptions as option}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>

		{#if categories.length > 0}
			<select
				class="font-ui rounded-lg border border-sand/60 bg-bg-input px-2 py-1 text-xs text-text-secondary focus:border-primary-400 focus:ring-1 focus:ring-primary-400 focus:outline-none"
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
