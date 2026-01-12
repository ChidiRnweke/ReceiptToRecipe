<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Plus, Receipt, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-svelte';

	let { data } = $props();

	function formatDate(date: Date | string) {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getStatusBadge(status: string) {
		switch (status) {
			case 'DONE':
				return { variant: 'secondary' as const, icon: CheckCircle, label: 'Processed' };
			case 'PROCESSING':
				return { variant: 'secondary' as const, icon: Loader2, label: 'Processing' };
			case 'QUEUED':
				return { variant: 'outline' as const, icon: Clock, label: 'Queued' };
			case 'FAILED':
				return { variant: 'destructive' as const, icon: XCircle, label: 'Failed' };
			default:
				return { variant: 'outline' as const, icon: Receipt, label: status };
		}
	}
</script>

<svelte:head>
	<title>Receipts - Receipt2Recipe</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="font-serif text-3xl font-medium text-ink">Your Receipts</h1>
			<p class="mt-1 text-ink-light">Upload and manage your grocery receipts</p>
		</div>
		<Button href="/receipts/upload">
			<Plus class="mr-2 h-4 w-4" />
			Upload Receipt
		</Button>
	</div>

	{#if data.receipts.length === 0}
		<Card.Root class="py-12 text-center">
			<Card.Content>
				<Receipt class="mx-auto h-12 w-12 text-ink-muted" />
				<h3 class="mt-4 font-serif text-xl font-medium text-ink">No receipts yet</h3>
				<p class="mt-2 text-ink-light">Upload your first receipt to get started</p>
				<Button href="/receipts/upload" class="mt-4">
					<Plus class="mr-2 h-4 w-4" />
					Upload Receipt
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each data.receipts as receipt}
				{@const status = getStatusBadge(receipt.status)}
				<a href="/receipts/{receipt.id}" class="group">
					<Card.Root class="transition-shadow hover:shadow-md">
						<Card.Header class="flex-row items-start justify-between space-y-0">
							<div>
								<Card.Title class="font-serif text-lg">
									{receipt.storeName || 'Unknown Store'}
								</Card.Title>
								<Card.Description>
									{formatDate(receipt.createdAt)}
								</Card.Description>
							</div>
							<Badge variant={status.variant}>
								{#if status.icon === Loader2}
									<status.icon class="mr-1 h-3 w-3 animate-spin" />
								{:else}
									<status.icon class="mr-1 h-3 w-3" />
								{/if}
								{status.label}
							</Badge>
						</Card.Header>
						{#if receipt.totalAmount}
							<Card.Content>
								<p class="text-2xl font-medium text-ink">
									${parseFloat(receipt.totalAmount).toFixed(2)}
								</p>
							</Card.Content>
						{/if}
					</Card.Root>
				</a>
			{/each}
		</div>
	{/if}
</div>
