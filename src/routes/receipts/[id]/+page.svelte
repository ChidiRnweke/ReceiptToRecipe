<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		ArrowLeft,
		ChefHat,
		ShoppingCart,
		CheckCircle,
		XCircle,
		Loader2,
		Clock
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
				return { variant: 'success' as const, icon: CheckCircle, label: 'Processed' };
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
					<Card.Header>
						<Card.Title>Items ({data.receipt.items?.length || 0})</Card.Title>
					</Card.Header>
					<Card.Content>
						{#if data.receipt.items && data.receipt.items.length > 0}
							<div class="divide-y divide-sand">
								{#each data.receipt.items as item}
									<div class="flex items-center justify-between py-3">
										<div>
											<p class="font-medium text-ink">{item.normalizedName}</p>
											<p class="text-sm text-ink-light">
												{item.quantity} {item.unit}
												{#if item.category && item.category !== 'other'}
													<span class="text-ink-muted">· {item.category}</span>
												{/if}
											</p>
										</div>
										{#if item.price}
											<p class="font-medium text-ink">${parseFloat(item.price).toFixed(2)}</p>
										{/if}
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
					<Button variant="outline" class="flex-1">
						<ShoppingCart class="mr-2 h-4 w-4" />
						Add to Shopping List
					</Button>
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
