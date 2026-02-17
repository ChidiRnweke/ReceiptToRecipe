<script lang="ts">
	import type { PantryItem } from '$services';
	import { Button } from '$lib/components/ui/button';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		Warehouse,
		ShoppingCart,
		Plus,
		History,
		Lightbulb,
		Filter,
		ChevronRight,
		ChevronDown,
		Calendar,
		Store,
		CheckCircle2,
		AlertCircle,
		LeafyGreen,
		Clock,
		AlertTriangle
	} from 'lucide-svelte';
	import { slide } from 'svelte/transition';
	import Notepad from '$lib/components/Notepad.svelte';
	import PinnedNote from '$lib/components/PinnedNote.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import CupboardItem from '$lib/components/CupboardItem.svelte';
	import CupboardFilters from '$lib/components/CupboardFilters.svelte';
	import CategoryIcon from '$lib/components/CategoryIcon.svelte';
	import CupboardItemDetail from '$lib/components/CupboardItemDetail.svelte';
	import AddItemForm from '$lib/components/AddItemForm.svelte';
	import CupboardSkeleton from '$lib/components/skeletons/CupboardSkeleton.svelte';
	import { workflowStore } from '$lib/state/workflow.svelte';

	let { data } = $props();

	// State
	let showAddModal = $state(false);
	let showExpiredModal = $state(false);
	let expandedReceiptId = $state<string | null>(null);

	// Item detail modal state
	let selectedItem = $state<PantryItem | null>(null);
	let selectedItemMode = $state<'active' | 'expired'>('active');
	let showItemDetail = $state(false);

	function openItemDetail(item: PantryItem, mode: 'active' | 'expired' = 'active') {
		selectedItem = item;
		selectedItemMode = mode;
		showItemDetail = true;
	}

	// Listen for mobile bottom nav CTA event
	$effect(() => {
		const handler = () => (showAddModal = true);
		window.addEventListener('cupboard-add-item', handler);
		return () => window.removeEventListener('cupboard-add-item', handler);
	});

	// Filter & Sort State (no more activeFilter — the lanes ARE the filter)
	let searchQuery = $state('');
	let sortBy = $state('confidence');
	let activeCategory = $state('all');

	// Mobile accordion state — 'useSoon' open by default (most actionable)
	let openLane = $state<string | null>('useSoon');

	function toggleLane(lane: string) {
		openLane = openLane === lane ? null : lane;
	}

	// Time-based greeting
	let greeting = $state('Good evening');
	$effect(() => {
		const hour = new Date().getHours();
		greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
	});

	// Random tip
	const tips = [
		'Store grains in airtight containers to keep them fresh.',
		'Keep spices away from heat and light.',
		'Practice FIFO: First In, First Out.',
		'Check expiry dates regularly.',
		'Group similar items together for easier finding.'
	];
	let randomTip = $state(tips[0]);
	$effect(() => {
		randomTip = tips[Math.floor(Math.random() * tips.length)];
	});

	function checkStockStatus(
		items: PantryItem[],
		receiptItemName: string
	): 'in-stock' | 'low' | 'out' {
		const match = items.find((i) => i.itemName.toLowerCase() === receiptItemName.toLowerCase());
		if (!match) return 'out';
		if (match.stockConfidence > 0.4) return 'in-stock';
		return 'low';
	}

	// Filter logic (search + category only — status is handled by lanes)
	function filterItems(items: PantryItem[]) {
		let result = items;

		if (activeCategory !== 'all') {
			result = result.filter((i) => i.category?.toLowerCase() === activeCategory.toLowerCase());
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter((i) => i.itemName.toLowerCase().includes(q));
		}

		if (sortBy === 'name') {
			result = [...result].sort((a, b) => a.itemName.localeCompare(b.itemName));
		} else if (sortBy === 'expires') {
			result = [...result].sort((a, b) => {
				const aLeft = a.confidenceFactors
					? a.confidenceFactors.effectiveLifespanDays - a.daysSincePurchase
					: 0;
				const bLeft = b.confidenceFactors
					? b.confidenceFactors.effectiveLifespanDays - b.daysSincePurchase
					: 0;
				return aLeft - bLeft;
			});
		} else if (sortBy === 'recent') {
			result = [...result].sort((a, b) => b.lastPurchased.getTime() - a.lastPurchased.getTime());
		}

		return result;
	}

	// Group by status into 3 Kanban lanes
	function groupByStatus(items: PantryItem[]) {
		const fresh: PantryItem[] = [];
		const useSoon: PantryItem[] = [];
		const runningLow: PantryItem[] = [];

		for (const item of items) {
			if (item.stockConfidence > 0.7) fresh.push(item);
			else if (item.stockConfidence > 0.4) useSoon.push(item);
			else runningLow.push(item);
		}

		return { fresh, useSoon, runningLow };
	}

	// Sub-group items by category within a lane
	function subGroupByCategory(items: PantryItem[]) {
		const groups = new Map<string, PantryItem[]>();
		for (const item of items) {
			const cat = item.category || 'Other';
			const existing = groups.get(cat) || [];
			existing.push(item);
			groups.set(cat, existing);
		}
		return groups;
	}

	// Lane config
	const lanes = [
		{
			key: 'fresh',
			title: 'Fresh & Stocked',
			tapeColor: 'teal' as const,
			tapeRotate: '-rotate-1',
			emptyText: 'Nothing here right now'
		},
		{
			key: 'useSoon',
			title: 'Use Soon',
			tapeColor: 'yellow' as const,
			tapeRotate: 'rotate-1',
			emptyText: 'All clear — nothing urgent'
		},
		{
			key: 'runningLow',
			title: 'Running Low',
			tapeColor: 'white' as const,
			tapeRotate: '-rotate-1',
			emptyText: 'Cupboard is well stocked!'
		}
	] as const;

	function getLaneIcon(key: string) {
		if (key === 'fresh') return LeafyGreen;
		if (key === 'useSoon') return Clock;
		return AlertTriangle;
	}

	function getLaneColor(key: string) {
		if (key === 'fresh') return 'text-emerald-600';
		if (key === 'useSoon') return 'text-amber-600';
		return 'text-rose-500';
	}

	function getLaneBadgeColor(key: string) {
		if (key === 'fresh') return 'bg-emerald-100 text-emerald-700';
		if (key === 'useSoon') return 'bg-amber-100 text-amber-700';
		return 'bg-rose-100 text-rose-700';
	}
</script>

<svelte:head>
	<title>Cupboard | Receipt2Recipe</title>
</svelte:head>

<div
	class="paper-card relative flex min-h-screen gap-0 rounded-4xl border border-sand bg-bg-paper shadow-[0_30px_80px_-50px_rgba(45,55,72,0.6)]"
>
	<!-- Background Pattern -->
	<div
		class="pointer-events-none absolute inset-0 rounded-4xl bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.08),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.08),transparent_28%)]"
	></div>

	<!-- Sidebar -->
	<aside
		class="hidden w-[320px] shrink-0 flex-col gap-6 rounded-tl-4xl rounded-bl-4xl border-r border-sand bg-bg-paper-dark/80 px-6 py-8 backdrop-blur-sm lg:flex"
	>
		<div class="space-y-1">
			<div class="flex items-center gap-2 text-xs tracking-[0.18em] text-ink-muted uppercase">
				<span>{greeting}, {data.user?.name?.split(' ')[0] || 'chef'}</span>
			</div>
			<h2 class="font-display text-2xl text-ink">Your Kitchen</h2>
		</div>

		<PinnedNote>
			<div class="flex items-start gap-3">
				<div class="mt-0.5 text-amber-600">
					<Lightbulb class="h-4 w-4" />
				</div>
				<p class="font-hand text-sm leading-snug text-ink/80">{randomTip}</p>
			</div>
		</PinnedNote>

		{#await Promise.all([data.streamed.recentReceipts, data.streamed.items])}
			<div class="space-y-3">
				<h3 class="font-ui text-xs tracking-wider text-ink-muted uppercase">Recent Receipts</h3>
				<div class="space-y-2">
					{#each Array(3) as _}
						<div class="rounded-lg border border-sand/60 bg-bg-card p-3">
							<Skeleton class="mb-2 h-4 w-3/4 bg-sand/20" />
							<Skeleton class="h-3 w-1/2 bg-sand/20" />
						</div>
					{/each}
				</div>
			</div>
		{:then [recentReceipts, items]}
			{#if recentReceipts.length > 0}
				<div class="space-y-3">
					<h3 class="font-ui text-xs tracking-wider text-ink-muted uppercase">Recent Receipts</h3>
					<div class="space-y-2">
						{#each recentReceipts as receipt (receipt.id)}
							<div
								class="overflow-hidden rounded-lg border border-sand/60 bg-bg-card transition-all hover:border-sand hover:shadow-sm"
							>
								<button
									class="flex w-full items-center justify-between p-3 text-left"
									onclick={() =>
										(expandedReceiptId = expandedReceiptId === receipt.id ? null : receipt.id)}
								>
									<div>
										<div class="flex items-center gap-2 text-sm font-medium text-ink">
											<Store class="h-3.5 w-3.5 text-primary" />
											<span class="max-w-[140px] truncate"
												>{receipt.storeName || 'Unknown Store'}</span
											>
										</div>
										<div class="mt-0.5 flex items-center gap-2 text-[10px] text-ink-muted">
											<Calendar class="h-3 w-3" />
											<span>
												{new Date(receipt.purchaseDate || receipt.createdAt).toLocaleDateString(
													'en-GB',
													{ day: 'numeric', month: 'short' }
												)}
											</span>
											<span>•</span>
											<span>{receipt.items?.length || 0} items</span>
										</div>
									</div>
									<ChevronRight
										class="h-4 w-4 text-ink-muted transition-transform {expandedReceiptId ===
										receipt.id
											? 'rotate-90'
											: ''}"
									/>
								</button>

								{#if expandedReceiptId === receipt.id}
									<div
										transition:slide={{ duration: 200 }}
										class="border-t border-sand/40 bg-bg-paper"
									>
										<ul class="space-y-1 p-2">
											{#each receipt.items || [] as item}
												{@const status = checkStockStatus(items, item.normalizedName)}
												<li class="flex items-center justify-between rounded px-2 py-1.5 text-xs">
													<span class="truncate pr-2 text-ink-light">{item.rawName}</span>
													{#if status === 'in-stock'}
														<CheckCircle2 class="h-3.5 w-3.5 shrink-0 text-emerald-500" />
													{:else if status === 'low'}
														<AlertCircle class="h-3.5 w-3.5 shrink-0 text-amber-500" />
													{:else}
														<div
															class="bg-sand-400 h-1.5 w-1.5 shrink-0 rounded-full"
															title="Used up"
														></div>
													{/if}
												</li>
											{/each}
										</ul>
										<div class="border-t border-sand/40 bg-bg-paper-dark/30 p-2 text-center">
											<a
												href="/receipts/{receipt.id}"
												class="text-[10px] font-medium tracking-wide text-primary uppercase hover:text-primary/80 hover:underline"
											>
												View Receipt Detail →
											</a>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/await}

		{#await data.streamed.expiredItems then expiredItems}
			{#if expiredItems.length > 0}
				<div
					class="mt-auto rounded-xl border border-dashed border-destructive/30 bg-destructive/5 p-4"
				>
					<div class="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
						<History class="h-4 w-4" />
						<span>Recent History</span>
					</div>
					<p class="mb-3 text-xs leading-relaxed text-destructive/80">
						{expiredItems.length} item{expiredItems.length > 1 ? 's' : ''} recently expired or used up.
					</p>
					<Button
						variant="outline"
						size="sm"
						class="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
						onclick={() => (showExpiredModal = true)}
					>
						Review Items
					</Button>
				</div>
			{/if}
		{/await}

		<div class="mt-4 space-y-2">
			<Button
				variant="ghost"
				class="w-full justify-start gap-2 text-ink-muted hover:text-ink"
				href="/shopping"
			>
				<ShoppingCart class="h-4 w-4" />
				Shopping List ({workflowStore.shoppingItems})
			</Button>
		</div>
	</aside>

	<!-- Main Content -->
	<main
		class="relative z-10 flex flex-1 flex-col overflow-hidden rounded-4xl bg-white lg:rounded-l-none lg:rounded-r-4xl"
	>
		<div class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
			<div class="mx-auto w-full max-w-6xl space-y-6">
				<!-- Header -->
				<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h1 class="font-display text-3xl text-ink sm:text-4xl">
							Your <span class="marker-highlight">Cupboard</span>
							{#await data.streamed.items}
								<span class="animate-pulse text-2xl font-normal text-ink-muted">(...)</span>
							{:then items}
								{@const filtered = filterItems(items)}
								<span class="text-2xl font-normal text-ink-muted">({filtered.length})</span>
							{/await}
						</h1>
						<p class="mt-1 text-ink-light">Manage your stock and ingredients.</p>
					</div>
					<div class="flex gap-2">
						{#await data.streamed.expiredItems then expiredItems}
							{#if expiredItems && expiredItems.length > 0}
								<Button
									variant="outline"
									size="icon"
									class="border-destructive/30 text-destructive lg:hidden"
									onclick={() => (showExpiredModal = true)}
								>
									<History class="h-4 w-4" />
								</Button>
							{/if}
						{/await}
						<Button onclick={() => (showAddModal = true)} class="gap-2 shadow-sm">
							<Plus class="h-4 w-4" />
							<span class="hidden sm:inline">Add Item</span>
							<span class="sm:hidden">Add</span>
						</Button>
					</div>
				</div>

				{#await data.streamed.items}
					<div class="mt-8">
						<CupboardSkeleton />
					</div>
				{:then items}
					{@const filtered = filterItems(items)}
					{@const statusGroups = groupByStatus(filtered)}
					{@const hasItems = items.length > 0}

					<!-- Filters -->
					{#if hasItems}
						<CupboardFilters
							{searchQuery}
							{sortBy}
							{activeCategory}
							categories={[...new Set(items.map((i) => i.category).filter(Boolean))] as string[]}
							onsearchchange={(q) => (searchQuery = q)}
							onsortchange={(s) => (sortBy = s)}
							oncategorychange={(c) => (activeCategory = c)}
						/>
					{/if}

					<!-- Kanban Board -->
					{#if hasItems}
						{#if filtered.length > 0}
							<!-- Desktop: 3-column notepads -->
							<div class="hidden gap-4 md:grid md:grid-cols-3">
								{#each lanes as lane}
									{@const laneItems = statusGroups[lane.key as keyof typeof statusGroups]}
									{@const categoryGroups = subGroupByCategory(laneItems)}
									{@const LaneIcon = getLaneIcon(lane.key)}

									<div class="flex flex-col">
										<Notepad tapeWidth="w-20" tapeRotate={lane.tapeRotate} class="bg-stone-200/30">
											<div class="min-h-[280px] p-3">
												<!-- Lane header -->
												<div class="mb-3 flex items-center gap-2 border-b border-sand/40 pb-3">
													<LaneIcon class="h-4 w-4 {getLaneColor(lane.key)}" />
													<h3 class="font-hand text-lg text-ink">{lane.title}</h3>
													<span
														class="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold {getLaneBadgeColor(
															lane.key
														)}"
													>
														{laneItems.length}
													</span>
												</div>

												<!-- Lane content -->
												{#if laneItems.length > 0}
													<div class="space-y-4">
														{#each [...categoryGroups.entries()] as [category, catItems]}
															<div>
																<!-- Category sub-header -->
																<div
																	class="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-medium tracking-wider text-ink-muted/60 uppercase"
																>
																	<CategoryIcon {category} class="h-3 w-3" />
																	<span>{category}</span>
																</div>
																<!-- Items -->
																<div class="divide-y divide-sand/20">
																	{#each catItems as item (item.id)}
																		<CupboardItem {item} onclick={() => openItemDetail(item)} />
																	{/each}
																</div>
															</div>
														{/each}
													</div>
												{:else}
													<div class="flex flex-col items-center py-8 text-center">
														<p class="font-hand text-sm text-ink-muted/50">
															{lane.emptyText}
														</p>
													</div>
												{/if}
											</div>
										</Notepad>
									</div>
								{/each}
							</div>

							<!-- Mobile: Collapsible accordion sections -->
							<div class="space-y-3 md:hidden">
								{#each lanes as lane}
									{@const laneItems = statusGroups[lane.key as keyof typeof statusGroups]}
									{@const categoryGroups = subGroupByCategory(laneItems)}
									{@const LaneIcon = getLaneIcon(lane.key)}
									{@const isOpen = openLane === lane.key}

									<div class="overflow-hidden rounded-xl border border-sand/50 bg-white shadow-sm">
										<!-- Accordion header -->
										<button
											type="button"
											class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-paper/50"
											onclick={() => toggleLane(lane.key)}
										>
											<LaneIcon class="h-4 w-4 shrink-0 {getLaneColor(lane.key)}" />
											<span class="font-hand flex-1 text-lg text-ink">{lane.title}</span>
											<span
												class="rounded-full px-2 py-0.5 text-[10px] font-bold {getLaneBadgeColor(
													lane.key
												)}"
											>
												{laneItems.length}
											</span>
											<ChevronDown
												class="h-4 w-4 text-ink-muted transition-transform {isOpen
													? 'rotate-180'
													: ''}"
											/>
										</button>

										<!-- Accordion content -->
										{#if isOpen}
											<div transition:slide={{ duration: 200 }} class="border-t border-sand/30">
												{#if laneItems.length > 0}
													<div class="space-y-3 px-2 pt-2 pb-3">
														{#each [...categoryGroups.entries()] as [category, catItems]}
															<div>
																<div
																	class="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-medium tracking-wider text-ink-muted/60 uppercase"
																>
																	<CategoryIcon {category} class="h-3 w-3" />
																	<span>{category}</span>
																</div>
																<div class="divide-y divide-sand/20">
																	{#each catItems as item (item.id)}
																		<CupboardItem {item} onclick={() => openItemDetail(item)} />
																	{/each}
																</div>
															</div>
														{/each}
													</div>
												{:else}
													<div class="px-4 py-6 text-center">
														<p class="font-hand text-sm text-ink-muted/50">
															{lane.emptyText}
														</p>
													</div>
												{/if}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{:else}
							<div class="flex flex-col items-center justify-center py-16 text-center">
								<div class="mb-4 rounded-full bg-sand/20 p-4">
									<Filter class="h-8 w-8 text-ink-muted" />
								</div>
								<p class="font-display text-lg text-ink">No items found</p>
								<Button
									variant="link"
									onclick={() => {
										searchQuery = '';
										activeCategory = 'all';
									}}
									class="mt-2 text-sage-600"
								>
									Clear filters
								</Button>
							</div>
						{/if}
					{:else}
						<div class="mt-12">
							<EmptyState
								icon={Warehouse}
								title="Your Cupboard is Empty"
								description="Scan a receipt to get started, or add items manually."
								action={{ label: 'Scan Receipt', href: '/receipts/upload' }}
							/>
						</div>
					{/if}
				{/await}
			</div>
		</div>
	</main>

	<!-- Add Item Modal -->
	<AlertDialog.Root bind:open={showAddModal}>
		<AlertDialog.Content
			class="max-w-md overflow-hidden bg-bg-paper p-0"
			interactOutsideBehavior="close"
		>
			<AlertDialog.Header class="border-b border-sand/40 bg-white p-4">
				<AlertDialog.Title class="font-display text-lg text-ink">Add Item</AlertDialog.Title>
			</AlertDialog.Header>
			<div class="bg-white p-6">
				{#await data.streamed.existingItemNames then existingItems}
					<AddItemForm {existingItems} />
				{/await}
			</div>
			<AlertDialog.Footer class="border-t border-sand/40 bg-white p-4 sm:justify-between">
				<AlertDialog.Cancel>Close</AlertDialog.Cancel>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>

	<!-- Expired Items Modal -->
	<AlertDialog.Root bind:open={showExpiredModal}>
		<AlertDialog.Content
			class="flex h-[80vh] max-w-2xl flex-col bg-bg-paper p-0"
			interactOutsideBehavior="close"
		>
			<AlertDialog.Header class="shrink-0 border-b border-sand/40 bg-white p-4">
				<AlertDialog.Title class="font-display flex items-center gap-2 text-lg text-ink">
					<History class="h-5 w-5 text-destructive" />
					Recently Expired
				</AlertDialog.Title>
				<AlertDialog.Description>
					Rescue items you still have or dismiss them.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<div class="flex-1 overflow-y-auto bg-bg-paper/30 p-4 sm:p-6">
				{#await data.streamed.expiredItems then expiredItems}
					{#if expiredItems.length > 0}
						<div class="divide-y divide-sand/30">
							{#each expiredItems as item (item.id)}
								<CupboardItem {item} onclick={() => openItemDetail(item, 'expired')} />
							{/each}
						</div>
					{:else}
						<div class="py-12 text-center text-ink-muted">
							<p>No recently expired items.</p>
						</div>
					{/if}
				{/await}
			</div>
			<AlertDialog.Footer class="shrink-0 border-t border-sand/40 bg-white p-4">
				<AlertDialog.Cancel>Close</AlertDialog.Cancel>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>

	<!-- Item Detail Modal -->
	<CupboardItemDetail item={selectedItem} mode={selectedItemMode} bind:open={showItemDetail} />
</div>
