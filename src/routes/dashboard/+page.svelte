<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Receipt, ChefHat, ShoppingCart } from 'lucide-svelte';

	let { data } = $props();
</script>

<section class="w-full space-y-10">
	<div class="flex items-center justify-between">
		<div>
			<p class="text-sm uppercase tracking-wide text-ink-muted">Welcome back</p>
			<h1 class="font-serif text-4xl font-medium tracking-tight text-ink">Your kitchen at a glance</h1>
		</div>
		<div class="flex gap-2">
			<Button href="/receipts/upload" size="sm"><Receipt class="mr-2 h-4 w-4" /> Upload receipt</Button>
			<Button href="/recipes/generate" variant="outline" size="sm"><ChefHat class="mr-2 h-4 w-4" /> New recipe</Button>
		</div>
	</div>

	<div class="grid gap-4 md:grid-cols-4">
		<Card.Root class="border-sand bg-paper"><Card.Content class="space-y-2 p-4"><p class="text-xs uppercase tracking-wide text-ink-muted">Receipts</p><p class="text-3xl font-semibold text-ink">{data.metrics?.receipts ?? 0}</p></Card.Content></Card.Root>
		<Card.Root class="border-sand bg-paper"><Card.Content class="space-y-2 p-4"><p class="text-xs uppercase tracking-wide text-ink-muted">Recipes</p><p class="text-3xl font-semibold text-ink">{data.metrics?.recipes ?? 0}</p></Card.Content></Card.Root>
		<Card.Root class="border-sand bg-paper"><Card.Content class="space-y-2 p-4"><p class="text-xs uppercase tracking-wide text-ink-muted">Saved</p><p class="text-3xl font-semibold text-ink">{data.metrics?.saved ?? 0}</p></Card.Content></Card.Root>
		<Card.Root class="border-sand bg-paper"><Card.Content class="space-y-2 p-4"><p class="text-xs uppercase tracking-wide text-ink-muted">Items in list</p><p class="text-3xl font-semibold text-ink">{data.metrics?.activeListItems ?? 0}</p></Card.Content></Card.Root>
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<Card.Root class="border-sand bg-paper">
			<Card.Header class="flex items-center justify-between">
				<Card.Title>Recent receipts</Card.Title>
				<Button href="/receipts" variant="outline" size="sm">View all</Button>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#if data.recentReceipts?.length}
					{#each data.recentReceipts as r}
						<a href={`/receipts/${r.id}`} class="flex items-center justify-between rounded-lg border border-sand p-3 hover:bg-paper-dark">
							<div>
								<p class="font-medium text-ink">{r.storeName || 'Receipt'}</p>
								<p class="text-xs text-ink-light">{new Date(r.createdAt).toLocaleDateString()}</p>
							</div>
							<Badge variant="outline">{r.status}</Badge>
						</a>
					{/each}
				{:else}
					<p class="text-ink-light">No receipts yet</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root class="border-sand bg-paper">
			<Card.Header class="flex items-center justify-between">
				<Card.Title>Smart suggestions</Card.Title>
				<Button href="/shopping" variant="outline" size="sm">Go to list</Button>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#if data.suggestions?.length}
					{#each data.suggestions as s}
						<div class="flex items-center justify-between rounded-lg border border-sand p-3">
							<div>
								<p class="font-medium text-ink">{s.itemName}</p>
								<p class="text-xs text-ink-muted">Usually every {s.avgFrequencyDays ?? '—'} days</p>
							</div>
							<Badge variant="outline">{s.suggestedQuantity ?? '1'}</Badge>
						</div>
					{/each}
				{:else}
					<p class="text-ink-light">No suggestions yet</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<Card.Root class="border-sand bg-paper">
		<Card.Header class="flex items-center justify-between">
			<Card.Title>Recent recipes</Card.Title>
			<Button href="/recipes" variant="outline" size="sm">View all</Button>
		</Card.Header>
		<Card.Content class="grid gap-4 md:grid-cols-3">
			{#if data.recentRecipes?.length}
				{#each data.recentRecipes as r}
					<a href={`/recipes/${r.id}`} class="rounded-lg border border-sand p-3 hover:bg-paper-dark">
						<p class="font-serif text-lg text-ink">{r.title}</p>
						{#if r.cuisineType}<p class="text-xs text-ink-muted">{r.cuisineType}</p>{/if}
					</a>
				{/each}
			{:else}
				<p class="text-ink-light">No recipes yet</p>
			{/if}
		</Card.Content>
	</Card.Root>
</section>
