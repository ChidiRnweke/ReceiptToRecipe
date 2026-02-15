<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatCurrency } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Plus,
		Receipt,
		Clock,
		CheckCircle,
		XCircle,
		Loader2,
		Store,
		ShoppingBag,
		Sparkles,
		ArrowRight,
		ChefHat,
		ShoppingCart,
		Filter,
		Search,
		FileText,
		Trash2,
		Archive,
		Check,
		Lightbulb
	} from 'lucide-svelte';
	import WashiTape from '$lib/components/WashiTape.svelte';
	import PinnedNote from '$lib/components/PinnedNote.svelte';
	import Notepad from '$lib/components/Notepad.svelte';

	let { data } = $props();
	let addingToShoppingId = $state<string | null>(null);

	// Subscribe to streamed data
	let receipts = $state<any[]>([]);
	let recipeCounts = $state<Record<string, number>>({});
	let receiptsLoading = $state(true);

	$effect(() => {
		if (data.streamed?.receipts) {
			receiptsLoading = true;
			data.streamed.receipts
				.then((r) => {
					receipts = r;
					receiptsLoading = false;
				})
				.catch(() => {
					receipts = [];
					receiptsLoading = false;
				});
		}
		if (data.streamed?.recipeCounts) {
			data.streamed.recipeCounts
				.then((counts) => {
					recipeCounts = counts;
				})
				.catch(() => {
					recipeCounts = {};
				});
		}
	});

	// Dialog state
	let deleteDialogOpen = $state(false);
	let receiptToDelete = $state<string | null>(null);
	let isDeleting = $state(false);

	function confirmDelete(id: string) {
		receiptToDelete = id;
		deleteDialogOpen = true;
	}

	function formatDate(date: Date | string) {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getRelativeTime(date: Date | string) {
		const now = new Date();
		const then = new Date(date);
		const diffDays = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		return formatDate(date);
	}

	const tips = [
		'Scan receipts to update your stock instantly.',
		'Review scanned items to ensure accuracy before cooking.',
		'Recipes are generated based on available ingredients in your receipts.',
		'Track your spending habits over time with digital archives.',
		'Categorize your grocery hauls to optimize your shopping list.'
	];
	const randomTip = tips[Math.floor(Math.random() * tips.length)];
</script>

<svelte:head>
	<title>Receipts - Ledger</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-4rem)]">
	<!-- Ledger Main Content -->
	<main class="relative flex-1 overflow-y-auto bg-bg-paper p-6 md:p-10">
		<!-- Desk Texture Overlay -->
		<div
			class="pointer-events-none absolute inset-0 opacity-[0.03]"
			style="background-image: url('https://www.transparenttextures.com/patterns/cardboard-flat.png')"
		></div>

		<div class="relative z-10 mx-auto max-w-5xl space-y-8">
			<!-- Header Action -->
			<div
				class="flex flex-col gap-6 border-b border-border pb-6 md:flex-row md:items-end md:justify-between"
			>
				<div>
					<h1
						class="font-display text-4xl leading-[1.1] text-ink drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]"
					>
						Track your <span class="marker-highlight">kitchen inventory</span>.
					</h1>
					<p class="font-ui mt-2 text-sm text-text-muted">
						Verify scans and manage your culinary assets.
					</p>
				</div>

				<div class="flex items-center gap-4 self-start md:self-end">
					<!-- Compact Tip -->
					<div class="hidden lg:block">
						<PinnedNote color="red" rotate="-rotate-2" class="max-w-50 text-xs">
							<div class="flex flex-col gap-1 p-1">
								<span class="flex items-center gap-2 font-bold text-ink/80"
									><Lightbulb class="h-3 w-3 text-amber-600" /> Quick Tip</span
								>
								<p class="leading-snug text-ink/60 italic">"{randomTip}"</p>
							</div>
						</PinnedNote>
					</div>

					<Button
						href="/receipts/upload"
						class="group relative h-11 overflow-hidden rounded-lg border border-sage-300 bg-white px-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sage-400 hover:bg-[#fafaf9] hover:shadow-md active:scale-95"
					>
						<div class="flex items-center gap-2">
							<Plus
								class="h-4 w-4 text-sage-600 transition-transform duration-500 group-hover:rotate-90 group-hover:text-sage-700"
							/>
							<span class="font-display text-base font-medium text-ink">Archive New Entry</span>
						</div>
					</Button>
				</div>
			</div>

			<!-- Skeleton loading state -->
			{#if receiptsLoading}
				<Notepad class="w-full border border-amber-100/50 bg-amber-50/50" showTape={false}>
					<div class="flex flex-col">
						{#each Array(5) as _}
							<div class="animate-pulse border-b border-dashed border-border bg-white px-6 py-5">
								<div class="flex flex-col gap-4 md:flex-row md:items-center">
									<div class="flex items-center gap-3 md:w-1/3">
										<div class="h-10 w-10 rounded-lg bg-gray-200"></div>
										<div class="flex-1 space-y-2">
											<div class="h-5 w-32 rounded bg-gray-200"></div>
											<div class="h-3 w-20 rounded bg-gray-200"></div>
										</div>
									</div>
									<div class="h-8 w-24 rounded bg-gray-200 md:w-32"></div>
									<div class="flex-1"></div>
									<div class="h-8 w-32 rounded bg-gray-200"></div>
								</div>
							</div>
						{/each}
					</div>
				</Notepad>
			{:else if receipts.length === 0}
				<div class="flex flex-col items-center justify-center py-24 text-center">
					<Receipt class="mb-6 h-16 w-16 text-sage-200" />
					<h3 class="font-serif text-2xl text-ink">Your ledger is empty</h3>
					<p class="mx-auto mt-2 max-w-xs font-medium text-ink-light">
						Start by adding your first receipt to track your kitchen inventory.
					</p>
				</div>
			{:else}
				<Notepad class="w-full border border-amber-100/50 bg-amber-50/50" showTape={false}>
					<div class="flex flex-col">
						{#each receipts as receipt}
							<!-- 
                    Row Structure
                -->
							<div
								class="group relative block border-b border-dashed border-border bg-white transition-colors duration-200 last:border-0 hover:bg-[#fffdf5]"
							>
								<a
									href="/receipts/{receipt.id}"
									class="absolute inset-0 z-20"
									aria-label="View receipt"
								></a>
								<div
									class="pointer-events-none relative flex flex-col items-start gap-4 px-6 py-5 md:flex-row md:items-center md:gap-6"
								>
									<!-- Notebook Margin Line -->
									<div class="absolute top-0 bottom-0 left-6 w-px bg-red-300/40"></div>

									<!-- 1. Merchant Block -->
									<div class="w-full overflow-hidden pl-6 md:w-1/3 md:min-w-60">
										<div class="flex items-center gap-3">
											<div
												class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-100 transition-colors group-hover:bg-amber-50"
											>
												<Store class="h-5 w-5 text-amber-700" />
											</div>
											<div class="min-w-0 flex-1">
												<h3
													class="truncate font-serif text-xl font-bold text-ink transition-colors group-hover:text-amber-700"
													title={receipt.storeName || 'Unknown Merchant'}
												>
													{receipt.storeName || 'Unknown Merchant'}
												</h3>
												<div class="mt-1 flex items-center gap-2">
													<!-- Barcode lines -->
													<div class="flex h-3 shrink-0 gap-px opacity-30">
														{#each Array(8) as _}
															<div class="w-px bg-black"></div>
															<div class="w-0.5 bg-transparent"></div>
														{/each}
													</div>
													<p class="font-ui truncate text-xs text-text-muted">
														{(receipt as any).items?.length || 0} items scanned
													</p>
												</div>
											</div>
										</div>
									</div>

									<!-- 2. Financials -->
									<div class="w-full shrink-0 pl-6 md:w-32 md:pl-0">
										{#if receipt.totalAmount}
											<div
												class="font-ui text-ink-dark inline-block -rotate-1 transform rounded border border-border/50 bg-[#fffdf5] px-2 py-1 text-lg font-bold tracking-tight opacity-90 shadow-sm transition-all group-hover:scale-105 group-hover:bg-white"
											>
												{formatCurrency(receipt.totalAmount!, receipt.currency || 'EUR')}
											</div>
										{:else}
											<span class="text-sm text-text-muted italic">Processing...</span>
										{/if}
									</div>

									<!-- 3. The Launchpad (Focus) -->
									<div
										class="flex w-full min-w-0 items-center justify-start gap-4 overflow-hidden pl-6 md:flex-1 md:justify-end md:pl-0"
									>
										{#if receipt.status === 'DONE'}
											<!-- Generate Button (Editorial Style) -->
											<Button
												href="/recipes/generate?receipt={receipt.id}"
												class="group pointer-events-auto relative z-20 h-8 shrink-0 overflow-hidden rounded-md border border-sage-300 bg-white px-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sage-400 hover:bg-[#fafaf9] hover:shadow-md active:scale-95"
												onclick={(e: MouseEvent) => e.stopPropagation()}
											>
												<div class="flex items-center gap-2">
													<ChefHat
														class="h-3.5 w-3.5 text-sage-600 transition-transform duration-500 group-hover:scale-110 group-hover:text-sage-700"
													/>
													<span class="font-display text-xs font-medium text-ink"
														>Generate Recipes</span
													>
												</div>
											</Button>

											<!-- Verified Stamp (Green) -->
											<div
												class="pointer-events-none hidden shrink-0 rotate-[-8deg] items-center justify-center rounded-sm border-2 border-emerald-500/30 p-1 text-emerald-600/60 select-none sm:flex"
											>
												<span class="text-[10px] leading-none font-bold tracking-widest uppercase"
													>Verified</span
												>
											</div>
										{:else}
											<!-- Status Badge (Amber/Yellow for Processing) -->
											<div
												class="font-ui flex items-center gap-2 truncate rounded-sm border border-amber-200 bg-amber-50 px-2 py-1 text-xs tracking-wider text-amber-700 uppercase"
												title={receipt.status}
											>
												{#if receipt.status === 'PROCESSING'}
													<Loader2 class="h-3 w-3 shrink-0 animate-spin" />
												{/if}
												<span class="truncate">{receipt.status}</span>
											</div>
										{/if}
									</div>

									<!-- 4. Actions -->
									<div
										class="mt-2 flex w-full items-center justify-end border-none border-border pl-0 md:mt-0 md:w-auto md:border-l md:pl-2"
									>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onclick={(e) => {
												e.stopPropagation();
												e.preventDefault();
												confirmDelete(receipt.id);
											}}
											class="pointer-events-auto relative z-20 hover:bg-red-50 hover:text-red-600"
										>
											{#if isDeleting && receiptToDelete === receipt.id}
												<Loader2 class="h-4 w-4 animate-spin" />
											{:else}
												<Trash2 class="h-4 w-4" />
											{/if}
										</Button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</Notepad>
			{/if}
		</div>
	</main>

	<AlertDialog.Root bind:open={deleteDialogOpen}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Delete Receipt?</AlertDialog.Title>
				<AlertDialog.Description>
					This will permanently delete this receipt and all its associated items from your ledger.
					This action cannot be undone.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
				<form
					method="POST"
					action="?/delete"
					use:enhance={() => {
						isDeleting = true;
						return async ({ update }) => {
							isDeleting = false;
							deleteDialogOpen = false;
							await update();
						};
					}}
					class="inline-block"
				>
					<input type="hidden" name="id" value={receiptToDelete} />
					<AlertDialog.Action
						type="submit"
						class="bg-red-600 text-white hover:bg-red-700"
						disabled={isDeleting}
					>
						{#if isDeleting}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Deleting...
						{:else}
							Delete Receipt
						{/if}
					</AlertDialog.Action>
				</form>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
</div>
