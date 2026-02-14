<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { formatCurrency } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import PushPin from '$lib/components/PushPin.svelte';
	import WashiTape from '$lib/components/WashiTape.svelte';
	import {
		ArrowLeft,
		CheckCircle,
		XCircle,
		Loader2,
		Clock,
		Receipt,
		Plus,
		Check,
		ChefHat,
		Pencil,
		Save,
		ImageIcon
	} from 'lucide-svelte';
	import LoadingState from '$lib/components/LoadingState.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';

	let { data } = $props();

	let pollingInterval: ReturnType<typeof setInterval> | null = null;
	let addingItems = $state<Record<string, boolean>>({});
	let addedItems = $state<Record<string, boolean>>({});
	let isEditing = $state(false);

	onMount(() => {
		if (data.receipt.status === 'QUEUED' || data.receipt.status === 'PROCESSING') {
			pollingInterval = setInterval(async () => {
				await invalidateAll();
				if (data.receipt.status === 'DONE' || data.receipt.status === 'FAILED') {
					if (pollingInterval) clearInterval(pollingInterval);
				}
			}, 2000);
		}

		return () => {
			if (pollingInterval) clearInterval(pollingInterval);
		};
	});

	function formatDate(date: Date | string | null) {
		if (!date) return 'Unknown';
		return new Date(date).toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getStatusInfo(status: string) {
		switch (status) {
			case 'DONE':
				return {
					variant: 'secondary' as const,
					icon: CheckCircle,
					label: 'Processed'
				};
			case 'PROCESSING':
				return {
					variant: 'secondary' as const,
					icon: Loader2,
					label: 'Processing...'
				};
			case 'QUEUED':
				return { variant: 'outline' as const, icon: Clock, label: 'In Queue' };
			case 'FAILED':
				return {
					variant: 'destructive' as const,
					icon: XCircle,
					label: 'Failed'
				};
			default:
				return { variant: 'outline' as const, icon: Clock, label: status };
		}
	}

	function formatQuantity(qty: string | number | null) {
		if (qty === null || qty === undefined || qty === '') return '-';
		const num = typeof qty === 'string' ? parseFloat(qty) : qty;
		if (isNaN(num)) return '-';
		// Format to max 1 decimal, remove trailing zeros
		return parseFloat(num.toFixed(1)).toString();
	}

	const status = $derived(getStatusInfo(data.receipt.status));
</script>

<svelte:head>
	<title>{data.receipt.storeName || 'Receipt'} - Receipt2Recipe</title>
</svelte:head>

<div class="min-h-screen bg-bg-paper p-4 font-sans md:p-8">
	<div class="mx-auto max-w-7xl">
		<!-- Header with Typewriter Action -->
		<div class="mb-8 flex items-center justify-between">
			<div class="flex items-center gap-4">
				<Button
					variant="ghost"
					size="icon"
					href="/receipts"
					class="text-text-secondary hover:bg-bg-hover hover:text-text-primary"
				>
					<ArrowLeft class="h-5 w-5" />
				</Button>
				<div class="flex flex-col">
					<h1
						class="font-display text-4xl leading-[1.1] text-text-primary drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]"
					>
						Chef's Prep <span class="marker-highlight">Worksheet</span>
					</h1>
					<div class="font-ui mt-2 flex items-center gap-2 text-xs text-text-muted">
						<!-- Clean simple date, minimal noise -->
						<span
							>Scanned {formatDate(data.receipt.createdAt || new Date())} • {data.receipt.items
								.length} items</span
						>
					</div>
				</div>
			</div>

			<div class="hidden lg:block">
				<Button
					href={`/recipes/generate?receiptId=${data.receipt.id}`}
					class="group btn-accent-filled relative h-12 px-6 shadow-[4px_4px_0px_0px_rgba(120,53,15,1)] transition-all hover:-translate-y-[1px] hover:shadow-[5px_5px_0px_0px_rgba(120,53,15,1)] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
				>
					<ChefHat class="mr-2 h-5 w-5" />
					Generate Recipes
				</Button>
			</div>
		</div>

		<!-- MAIN CONTENT -->
		{#if data.receipt.status === 'PROCESSING' || data.receipt.status === 'QUEUED'}
			<LoadingState
				size="lg"
				text="Reading your receipt... This usually takes about 10-30 seconds."
				class="py-20"
			/>
		{:else if data.receipt.status === 'FAILED'}
			<div class="mx-auto max-w-lg rounded-xl border-2 border-red-100 bg-red-50 p-8 text-center">
				<XCircle class="mx-auto h-12 w-12 text-red-400" />
				<h3 class="mt-4 font-serif text-xl font-bold text-red-900">Extraction Failed</h3>
				<p class="mt-2 text-red-700">
					We couldn't read the details from this receipt. Please try uploading a clearer image.
				</p>
			</div>
		{:else}
			<div class="flex flex-col gap-12 lg:flex-row lg:items-start">
				<!-- LEFT COLUMN: The Worksheet Card -->
				<!-- Background: Warm #FDFBF7 -->
				<div class="relative order-2 min-h-[800px] flex-1 bg-bg-paper shadow-xl lg:order-1">
					<!-- Notebook Styling Lines -->
					<!-- Blue lines with Red Margin -->
					<div
						class="pointer-events-none absolute inset-0 z-0"
						style="
              background-image: linear-gradient(#f0f9ff 1px, transparent 1px);
              background-size: 100% 3rem;
              margin-top: 10rem;
            "
					></div>

					<!-- Red Margin Line: Placed with spacing from count -->
					<div
						class="pointer-events-none absolute top-0 bottom-0 left-28 z-0 border-r border-red-300/60"
					></div>

					<!-- Header Section (Pinned) -->
					<div class="relative z-10 px-8 pt-8 pb-0">
						<div class="absolute -top-3 left-[50%] z-20 -translate-x-1/2 drop-shadow-md">
							<PushPin color="red" />
						</div>

						<!-- Minimal Header -->
						<div class="flex items-end justify-between border-b-2 border-stone-800 pb-6">
							<div>
								<h2 class="mt-4 font-serif text-4xl leading-none font-bold text-text-primary">
									{data.receipt.storeName || 'Unknown Store'}
								</h2>
								<div class="font-handwriting mt-2 text-sm text-text-muted">
									{formatDate(data.receipt.purchaseDate)}
								</div>
							</div>

							<!-- Edit Toggle -->
							<Button
								variant="ghost"
								size="sm"
								onclick={() => (isEditing = !isEditing)}
								class="text-text-muted hover:text-text-primary"
							>
								{#if isEditing}
									<Save class="mr-2 h-4 w-4" /> Save
								{:else}
									<Pencil class="mr-2 h-4 w-4" /> Edit
								{/if}
							</Button>
						</div>
					</div>

					<!-- Worksheet Items -->
					<div class="relative z-10 pt-4 pb-12">
						<div class="space-y-0">
							{#each data.receipt.items as item (item.id)}
								<div class="group relative flex h-[3rem] items-center hover:bg-blue-50/20">
									<!-- LEFT GUTTER (Width 6rem / 96px) - Contains Qty & Add Button -->
									<div class="flex w-24 items-center justify-end border-r border-transparent pr-3">
										<!-- Add Action (Mini) -->
										<form
											method="POST"
											action="?/addSingleItemToShopping"
											use:enhance={() => {
												addingItems[item.id] = true;
												return async ({ result, update }) => {
													addingItems[item.id] = false;
													if (result.type === 'success') {
														addedItems[item.id] = true;
														setTimeout(() => {
															addedItems[item.id] = false;
														}, 2000);
													}
													await update();
												};
											}}
											class="mr-2"
										>
											<input
												type="hidden"
												name="name"
												value={item.normalizedName || item.rawName || 'Unknown'}
											/>
											<input
												type="hidden"
												name="quantity"
												value={item.quantity === null ? '' : item.quantity}
											/>
											<input type="hidden" name="unit" value={item.unit || ''} />

											<Button
												type="submit"
												variant="ghost"
												size="icon"
												disabled={addingItems[item.id]}
												title="Add to Shopping List"
												class="h-5 w-5 rounded-full text-text-muted transition-all hover:scale-110 hover:text-success-600 disabled:opacity-50 {addedItems[
													item.id
												]
													? 'text-emerald-500'
													: ''}"
											>
												{#if addingItems[item.id]}
													<Loader2 class="h-3 w-3 animate-spin" />
												{:else if addedItems[item.id]}
													<Check class="h-4 w-4" />
												{:else}
													<Plus class="h-4 w-4" />
												{/if}
											</Button>
										</form>

										<!-- Quantity (Handwritten style) -->
										<div class="font-handwriting w-10 text-right text-lg text-text-secondary">
											{#if isEditing}
												<Input
													value={formatQuantity(item.quantity) === '-'
														? ''
														: formatQuantity(item.quantity)}
													class="font-handwriting h-6 w-full border-border bg-transparent px-1 text-right"
												/>
											{:else}
												{formatQuantity(item.quantity)}<span class="ml-0.5 text-xs"
													>{item.unit || ''}</span
												>
											{/if}
										</div>
									</div>

									<!-- RIGHT CONTENT (After Red Margin) - Normalized Name Only -->
									<div class="flex-1 pr-8 pl-8">
										{#if isEditing}
											<Input
												value={item.normalizedName || item.rawName}
												class="h-8 border-transparent bg-transparent px-0 font-serif text-lg text-text-primary focus-visible:ring-0"
											/>
										{:else}
											<div class="flex flex-col">
												<span
													class="font-serif text-xl leading-none font-medium tracking-normal text-text-primary"
												>
													{item.normalizedName || item.rawName}
												</span>
												{#if item.normalizedName && item.normalizedName !== item.rawName}
													<span class="font-ui mt-1 truncate text-xs text-text-muted">
														{item.rawName}
													</span>
												{/if}
											</div>
										{/if}
									</div>
								</div>
							{/each}

							{#if data.receipt.items.length === 0}
								<div class="flex h-32 items-center justify-center text-text-muted italic">
									No items found.
								</div>
							{/if}
						</div>

						<!-- Footer Note -->
						<div class="mt-12 flex justify-center px-8">
							<div class="font-handwriting rotate-1 text-sm text-text-muted">Verified by Chef</div>
						</div>
					</div>
				</div>

				<!-- RIGHT COLUMN: Sticky Receipt -->
				<div class="relative order-1 w-full lg:sticky lg:top-8 lg:order-2 lg:w-96 lg:shrink-0">
					<div class="relative w-full rotate-1 transition-transform hover:rotate-0">
						<!-- Image Container -->
						<div
							class="flex flex-col overflow-hidden rounded-sm bg-white p-4 pb-8 shadow-xl ring-1 ring-black/5"
						>
							{#if data.receipt.imageUrl}
								<div class="relative overflow-hidden rounded-sm bg-bg-paper-dark">
									<!-- Washi Tape -->
									<WashiTape
										color="yellow"
										width="w-20"
										class="absolute -top-2 right-1/2 z-20 translate-x-1/2 rotate-2 shadow-sm"
									/>
									<img
										src={`/uploads/receipts/${data.receipt.imageUrl.split('/').pop()}`}
										alt="Original Receipt"
										class="mx-auto h-auto w-full opacity-95 mix-blend-multiply brightness-105 contrast-105"
									/>

									<!-- Paper Overlay Texture -->
									<div
										class="pointer-events-none absolute inset-0 bg-white/10 mix-blend-overlay"
									></div>
								</div>
							{:else}
								<EmptyState
									icon={ImageIcon}
									title="Receipt image missing"
									description="The original image could not be loaded."
									class="border-0 bg-transparent py-12"
								/>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
