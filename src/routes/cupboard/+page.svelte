<script lang="ts">
	import type { PantryItem } from '$services';
	import Notepad from '$lib/components/Notepad.svelte';
	import WashiTape from '$lib/components/WashiTape.svelte';
	import PinnedNote from '$lib/components/PinnedNote.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import CupboardItem from '$lib/components/CupboardItem.svelte';
	import CupboardStats from '$lib/components/CupboardStats.svelte';
	import CupboardFilters from '$lib/components/CupboardFilters.svelte';
	import AddItemForm from '$lib/components/AddItemForm.svelte';
	import { Warehouse, Upload, ChefHat, Clock, ShoppingCart } from 'lucide-svelte';

	let { data } = $props();

	// Filter & sort state
	let activeFilter = $state('all');
	let searchQuery = $state('');
	let sortBy = $state('confidence');
	let activeCategory = $state('all');

	// Derive filtered + sorted items
	const filteredItems = $derived.by(() => {
		let items = data.items as PantryItem[];

		// Status filter
		if (activeFilter === 'in-stock') {
			items = items.filter((i) => i.stockConfidence > 0.7);
		} else if (activeFilter === 'running-low') {
			items = items.filter((i) => i.stockConfidence > 0.4 && i.stockConfidence <= 0.7);
		} else if (activeFilter === 'restock') {
			items = items.filter((i) => i.stockConfidence <= 0.4);
		}

		// Category filter
		if (activeCategory !== 'all') {
			items = items.filter((i) => i.category?.toLowerCase() === activeCategory.toLowerCase());
		}

		// Search filter
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			items = items.filter((i) => i.itemName.toLowerCase().includes(q));
		}

		// Sort
		if (sortBy === 'name') {
			items = [...items].sort((a, b) => a.itemName.localeCompare(b.itemName));
		} else if (sortBy === 'expires') {
			items = [...items].sort((a, b) => {
				const aLeft = a.confidenceFactors
					? a.confidenceFactors.effectiveLifespanDays - a.daysSincePurchase
					: 0;
				const bLeft = b.confidenceFactors
					? b.confidenceFactors.effectiveLifespanDays - b.daysSincePurchase
					: 0;
				return aLeft - bLeft;
			});
		} else if (sortBy === 'recent') {
			items = [...items].sort((a, b) => b.lastPurchased.getTime() - a.lastPurchased.getTime());
		}
		// Default: confidence (already sorted from server)

		return items;
	});

	// Group by category
	const groupedItems = $derived.by(() => {
		const groups = new Map<string, PantryItem[]>();
		for (const item of filteredItems) {
			const cat = item.category || 'Other';
			const existing = groups.get(cat) || [];
			existing.push(item);
			groups.set(cat, existing);
		}
		return groups;
	});

	const hasItems = $derived((data.items as PantryItem[]).length > 0);
	const expiredItems = $derived(data.expiredItems as PantryItem[]);
	const hasExpired = $derived(expiredItems.length > 0);
	const hasAnything = $derived(hasItems || hasExpired);
</script>

<svelte:head>
	<title>Cupboard | ReceiptToRecipe</title>
</svelte:head>

<div class="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
	<!-- Header -->
	<div class="mb-6">
		<div class="flex items-center gap-3">
			<Warehouse class="h-6 w-6 text-primary-600" />
			<h1 class="font-display text-2xl font-bold text-text-primary sm:text-3xl">Your Cupboard</h1>
		</div>
		<p class="font-hand mt-1 text-sm text-text-muted">Everything we think you have, and why</p>
	</div>

	{#if hasAnything}
		<div class="flex flex-col gap-6 lg:flex-row">
			<!-- Main content -->
			<div class="flex-1 space-y-6">
				{#if hasItems}
					<Notepad>
						<div class="space-y-5 p-4 sm:p-6">
							<!-- Add item form -->
							<div class="border-b border-sand/40 pb-4">
								<AddItemForm existingItems={data.existingItemNames} />
							</div>

							<!-- Filters -->
							<CupboardFilters
								{activeFilter}
								{searchQuery}
								{sortBy}
								categories={data.categories}
								{activeCategory}
								onfilterchange={(f) => (activeFilter = f)}
								onsearchchange={(q) => (searchQuery = q)}
								onsortchange={(s) => (sortBy = s)}
								oncategorychange={(c) => (activeCategory = c)}
							/>

							<!-- Item count -->
							<div class="flex items-center justify-between">
								<span class="font-ui text-xs text-text-muted">
									{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
									{activeFilter !== 'all' || searchQuery || activeCategory !== 'all'
										? `(filtered from ${(data.items as PantryItem[]).length})`
										: ''}
								</span>
							</div>

							<!-- Items grouped by category -->
							{#if filteredItems.length > 0}
								<div class="space-y-4">
									{#each [...groupedItems.entries()] as [category, items]}
										<div>
											<!-- Category header -->
											<div class="mb-2 flex items-center gap-2 border-b border-sand/30 pb-1">
												<span class="font-ui text-[11px] tracking-wider text-text-muted uppercase">
													{category}
												</span>
												<span class="text-[10px] text-text-muted/60">
													({items.length})
												</span>
											</div>

											<!-- Items in category -->
											<div class="space-y-2">
												{#each items as item (item.id)}
													<CupboardItem {item} />
												{/each}
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="py-8 text-center">
									<p class="font-body text-sm text-text-muted">No items match your filters.</p>
								</div>
							{/if}
						</div>
					</Notepad>
				{:else}
					<!-- No active items but there are expired ones — show the add form -->
					<Notepad>
						<div class="p-4 sm:p-6">
							<AddItemForm existingItems={data.existingItemNames} />
						</div>
					</Notepad>
				{/if}

				<!-- Recently expired section -->
				{#if hasExpired}
					<div class="rounded-xl border border-dashed border-rose-200/60 bg-rose-50/30 p-4 sm:p-6">
						<div class="mb-4 flex items-center gap-2">
							<Clock class="h-4 w-4 text-rose-400" />
							<h2 class="font-display text-sm font-semibold text-rose-700">Recently Expired</h2>
							<span
								class="font-ui rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-600"
							>
								{expiredItems.length}
							</span>
						</div>
						<p class="font-body mb-4 text-xs leading-relaxed text-rose-600/80">
							These items have likely been used up. Rescue them if you still have them, or add them
							to your shopping list.
						</p>
						<div class="space-y-2">
							{#each expiredItems as item (item.id)}
								<CupboardItem {item} mode="expired" />
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Sidebar -->
			<aside class="w-full shrink-0 lg:w-72">
				<div class="sticky top-8 space-y-4">
					<!-- Stats card -->
					<div class="rounded-xl border border-sand/60 bg-bg-card p-4 shadow-sm">
						<div class="mb-3 flex items-center gap-2">
							<WashiTape color="sage" />
							<h2 class="font-ui text-xs tracking-wider text-text-muted uppercase">
								Cupboard Health
							</h2>
						</div>
						<CupboardStats stats={data.stats} />
						{#if data.stats.lastStocked}
							<p class="font-ui mt-3 text-[11px] text-text-muted">
								Last stocked: {data.stats.lastStocked.toLocaleDateString('en-GB', {
									day: 'numeric',
									month: 'short'
								})}
							</p>
						{/if}
					</div>

					<!-- Quick actions -->
					<PinnedNote color="yellow">
						<div class="space-y-2">
							<h3 class="font-hand text-sm font-medium text-text-primary">Quick Actions</h3>
							<a
								href="/receipts/upload"
								class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
							>
								<Upload class="h-4 w-4" />
								Scan a receipt
							</a>
							<a
								href="/recipes/generate"
								class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
							>
								<ChefHat class="h-4 w-4" />
								Cook with what you have
							</a>
							<a
								href="/shopping"
								class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-hover"
							>
								<ShoppingCart class="h-4 w-4" />
								View shopping list
							</a>
						</div>
					</PinnedNote>
				</div>
			</aside>
		</div>
	{:else}
		<!-- Empty state -->
		<EmptyState
			icon={Warehouse}
			title="Your Cupboard is Empty"
			description="Scan a receipt to start stocking your cupboard, or add items manually."
			action={{ label: 'Scan a Receipt', href: '/receipts/upload' }}
		/>

		<!-- Also show the add form even when empty -->
		<div class="mx-auto mt-8 max-w-md">
			<Notepad>
				<div class="p-4">
					<p class="font-hand mb-3 text-sm text-text-muted">Or add something manually:</p>
					<AddItemForm existingItems={data.existingItemNames} />
				</div>
			</Notepad>
		</div>
	{/if}
</div>
