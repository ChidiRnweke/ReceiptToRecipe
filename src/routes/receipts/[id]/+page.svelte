<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		ArrowLeft,
		ChefHat,
		ShoppingCart,
		CheckCircle,
		XCircle,
		Loader2,
		Clock,
		X
	} from 'lucide-svelte';

	let { data } = $props();

	let pollingInterval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		// Poll for status updates if processing
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
				return { variant: 'secondary' as const, icon: CheckCircle, label: 'Processed' };
			case 'PROCESSING':
				return { variant: 'secondary' as const, icon: Loader2, label: 'Processing...' };
			case 'QUEUED':
				return { variant: 'outline' as const, icon: Clock, label: 'In Queue' };
			case 'FAILED':
				return { variant: 'destructive' as const, icon: XCircle, label: 'Failed' };
			default:
				return { variant: 'outline' as const, icon: Clock, label: status };
		}
	}

	const status = $derived(getStatusInfo(data.receipt.status));
</script>

<svelte:head>
	<title>{data.receipt.storeName || 'Receipt'} - Receipt2Recipe</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/receipts">
			<ArrowLeft class="h-5 w-5" />
		</Button>
		<div class="flex-1">
			<h1 class="font-serif text-3xl font-medium text-ink">
				{data.receipt.storeName || 'Receipt Details'}
			</h1>
			<p class="text-ink-light">{formatDate(data.receipt.purchaseDate)}</p>
		</div>
		<Badge variant={status.variant}>
			{#if status.icon === Loader2}
				<status.icon class="mr-1 h-3 w-3 animate-spin" />
			{:else}
				<status.icon class="mr-1 h-3 w-3" />
			{/if}
			{status.label}
		</Badge>
	</div>

	{#if data.receipt.status === 'PROCESSING' || data.receipt.status === 'QUEUED'}
		<Card.Root>
			<Card.Content class="py-12 text-center">
				<Loader2 class="mx-auto h-12 w-12 animate-spin text-sage-600" />
				<h3 class="mt-4 font-serif text-xl font-medium text-ink">Scanning your receipt...</h3>
				<p class="mt-2 text-ink-light">This usually takes about 10-30 seconds</p>
			</Card.Content>
		</Card.Root>
	{:else if data.receipt.status === 'FAILED'}
		<Card.Root class="border-sienna-200 bg-sienna-50">
			<Card.Content class="py-8 text-center">
				<XCircle class="mx-auto h-12 w-12 text-sienna-600" />
				<h3 class="mt-4 font-serif text-xl font-medium text-ink">Failed to process receipt</h3>
				<p class="mt-2 text-ink-light">{data.receipt.errorMessage || 'Unknown error occurred'}</p>
				<Button href="/receipts/upload" class="mt-4">Try Again</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-6 lg:grid-cols-3">
			<div class="lg:col-span-2 space-y-6">
				<!-- Items List -->
						<Card.Root>
							<Card.Header class="flex items-center justify-between">
								<div>
									<Card.Title>Items ({data.receipt.items?.length || 0})</Card.Title>
									<p class="text-sm text-ink-light">Tap to edit or add missing lines</p>
								</div>
								<form method="POST" action="?/addItem" use:enhance={() => {}} class="flex gap-2">
									<input type="hidden" name="name" value="New item" />
									<input type="hidden" name="quantity" value="1" />
									<Button type="submit" variant="outline" size="sm">Quick add</Button>
								</form>
							</Card.Header>
							<Card.Content>
								{#if data.receipt.items && data.receipt.items.length > 0}
									<div class="divide-y divide-sand">
										{#each data.receipt.items as item}
											<div class="space-y-2 py-3">
												<form
													method="POST"
													action="?/updateItem"
													use:enhance={() => {}}
													class="grid gap-3 md:grid-cols-5 md:items-center"
												>
													<input type="hidden" name="itemId" value={item.id} />
													<div class="md:col-span-2 space-y-1">
														<label for={`name-${item.id}`} class="text-xs uppercase tracking-wide text-ink-muted">Name</label>
														<Input id={`name-${item.id}`} name="name" value={item.rawName} />
													</div>
													<div class="space-y-1">
														<label for={`qty-${item.id}`} class="text-xs uppercase tracking-wide text-ink-muted">Qty</label>
														<Input id={`qty-${item.id}`} name="quantity" value={item.quantity} />
													</div>
													<div class="space-y-1">
														<label for={`unit-${item.id}`} class="text-xs uppercase tracking-wide text-ink-muted">Unit</label>
														<Input id={`unit-${item.id}`} name="unit" value={item.unit} />
													</div>
													<div class="space-y-1">
														<label for={`price-${item.id}`} class="text-xs uppercase tracking-wide text-ink-muted">Price</label>
														<Input id={`price-${item.id}`} name="price" value={item.price ?? ''} />
													</div>
													<div class="space-y-1 md:col-span-4">
														<label for={`category-${item.id}`} class="text-xs uppercase tracking-wide text-ink-muted">Category</label>
														<Input id={`category-${item.id}`} name="category" value={item.category ?? ''} />
													</div>
													<div class="flex items-center gap-2 md:col-span-1">
														<Button type="submit" size="sm" variant="outline">Save</Button>
													</div>
												</form>
												<form method="POST" action="?/deleteItem" use:enhance={() => {}} class="flex justify-end">
													<input type="hidden" name="itemId" value={item.id} />
													<Button type="submit" size="icon" variant="ghost" class="text-ink-muted hover:text-sienna-600">
														<X class="h-4 w-4" />
													</Button>
												</form>
											</div>
										{/each}
									</div>
								{:else}
									<p class="text-ink-light">No items found</p>
								{/if}
							</Card.Content>
						</Card.Root>

				<!-- Actions -->
				<div class="flex gap-3">
					<Button href="/recipes/generate?receipt={data.receipt.id}" class="flex-1">
						<ChefHat class="mr-2 h-4 w-4" />
						Generate Recipe
					</Button>
					{#if data.receipt.status === 'DONE'}
						<form method="POST" action="?/addToShopping" use:enhance={() => {}} class="flex-1">
							<Button type="submit" variant="outline" class="w-full">
								<ShoppingCart class="mr-2 h-4 w-4" />
								Add to Shopping List
							</Button>
						</form>
					{/if}
				</div>
			</div>

			<!-- Receipt Image -->
			<div>
				<Card.Root>
					<Card.Header>
						<Card.Title>Receipt Image</Card.Title>
					</Card.Header>
					<Card.Content>
						<img
							src={data.receipt.imageUrl}
							alt="Receipt"
							class="w-full rounded-lg"
						/>
					</Card.Content>
				</Card.Root>

				{#if data.receipt.totalAmount}
					<Card.Root class="mt-4">
						<Card.Content class="pt-6">
							<div class="text-center">
								<p class="text-sm text-ink-light">Total</p>
								<p class="font-serif text-3xl font-medium text-ink">
									${parseFloat(data.receipt.totalAmount).toFixed(2)}
								</p>
							</div>
						</Card.Content>
					</Card.Root>
				{/if}
			</div>
		</div>
	{/if}
</div>
