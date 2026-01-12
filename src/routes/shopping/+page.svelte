<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Badge } from '$lib/components/ui/badge';
	import {
		ShoppingCart,
		Plus,
		Trash2,
		Sparkles,
		ListPlus,
		ChevronDown,
		ChevronUp,
		Check
	} from 'lucide-svelte';

	let { data, form } = $props();
	let loading = $state(false);
	let newListName = $state('');
	let expandedLists = $state<Set<string>>(new Set(data.lists.slice(0, 1).map((l: any) => l.id)));

	// New item inputs per list
	let newItemInputs = $state<Record<string, { name: string; quantity: string; unit: string }>>({});

	function getNewItemInput(listId: string) {
		if (!newItemInputs[listId]) {
			newItemInputs[listId] = { name: '', quantity: '1', unit: '' };
		}
		return newItemInputs[listId];
	}

	function toggleList(listId: string) {
		if (expandedLists.has(listId)) {
			expandedLists.delete(listId);
		} else {
			expandedLists.add(listId);
		}
		expandedLists = new Set(expandedLists);
	}

	function getCompletionPercentage(items: any[]) {
		if (items.length === 0) return 0;
		const checked = items.filter((i) => i.checked).length;
		return Math.round((checked / items.length) * 100);
	}
</script>

<svelte:head>
	<title>Shopping Lists - Receipt2Recipe</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="font-serif text-3xl font-medium text-ink">Shopping Lists</h1>
			<p class="mt-1 text-ink-light">Manage your grocery shopping</p>
		</div>
	</div>

	{#if form?.error}
		<div class="rounded-lg bg-sienna-50 p-3 text-sm text-sienna-700">
			{form.error}
		</div>
	{/if}

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Main Content -->
		<div class="lg:col-span-2 space-y-4">
			<!-- Restock CTA -->
			<Card.Root>
				<Card.Content class="flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
					<div>
						<p class="text-xs uppercase tracking-wide text-ink-muted">Restock</p>
						<h3 class="font-serif text-xl text-ink">Build a new list from what you usually buy</h3>
						<p class="text-ink-light">We look at your purchase history and suggest what’s likely running low.</p>
					</div>
					<form method="POST" action="?/generateRestock" use:enhance={() => {}}>
						<Button type="submit" variant="outline">Generate restock list</Button>
					</form>
				</Card.Content>
			</Card.Root>

			<!-- Create New List -->
			<Card.Root>
				<Card.Content class="pt-6">
					<form
						method="POST"
						action="?/createList"
						use:enhance={() => {
							loading = true;
							return async ({ result }) => {
								loading = false;
								if (result.type === 'success') {
									newListName = '';
									await invalidateAll();
								}
							};
						}}
						class="flex gap-2"
					>
						<Input
							type="text"
							name="name"
							placeholder="New shopping list name..."
							bind:value={newListName}
						/>
						<Button type="submit" disabled={loading || !newListName.trim()}>
							<ListPlus class="mr-2 h-4 w-4" />
							Create
						</Button>
					</form>
				</Card.Content>
			</Card.Root>

			<!-- Shopping Lists -->
			{#if data.lists.length === 0}
				<Card.Root>
					<Card.Content class="py-12 text-center">
						<ShoppingCart class="mx-auto h-12 w-12 text-ink-muted" />
						<h3 class="mt-4 font-medium text-ink">No shopping lists yet</h3>
						<p class="mt-1 text-sm text-ink-light">
							Create a new list to start tracking your groceries
						</p>
					</Card.Content>
				</Card.Root>
			{:else}
				{#each data.lists as list}
					{@const completion = getCompletionPercentage(list.items || [])}
					{@const isExpanded = expandedLists.has(list.id)}
					<Card.Root>
						<Card.Header class="cursor-pointer" onclick={() => toggleList(list.id)}>
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-3">
									{#if isExpanded}
										<ChevronUp class="h-5 w-5 text-ink-muted" />
									{:else}
										<ChevronDown class="h-5 w-5 text-ink-muted" />
									{/if}
									<div>
										<Card.Title>{list.name}</Card.Title>
										<Card.Description>
											{list.items?.length || 0} items
											{#if completion === 100 && list.items?.length > 0}
												<Badge variant="secondary" class="ml-2">
													<Check class="mr-1 h-3 w-3" />
													Complete
												</Badge>
											{/if}
										</Card.Description>
									</div>
								</div>
								<div class="flex items-center gap-4">
									{#if list.items?.length > 0}
										<div class="flex items-center gap-2">
											<div class="h-2 w-24 rounded-full bg-sand">
												<div
													class="h-2 rounded-full bg-sage-500 transition-all"
													style="width: {completion}%"
												></div>
											</div>
											<span class="text-sm text-ink-muted">{completion}%</span>
										</div>
									{/if}
									<form
										method="POST"
										action="?/deleteList"
										use:enhance={() => {
											return async () => {
												await invalidateAll();
											};
										}}
									>
										<input type="hidden" name="listId" value={list.id} />
										<Button
											type="submit"
											variant="ghost"
											size="icon"
											class="text-ink-muted hover:text-sienna-600"
											onclick={(e) => e.stopPropagation()}
										>
											<Trash2 class="h-4 w-4" />
										</Button>
									</form>
								</div>
							</div>
						</Card.Header>

						{#if isExpanded}
				<Card.Content class="space-y-4">
					<!-- Add Item Form -->
					{#key list.id}
						{@const input = getNewItemInput(list.id)}
						<form
							method="POST"
							action="?/addItem"
							use:enhance={() => {
								return async ({ result }) => {
									if (result.type === 'success') {
										newItemInputs[list.id] = { name: '', quantity: '1', unit: '' };
										await invalidateAll();
									}
								};
							}}
						class="flex gap-2"
					>
						<input type="hidden" name="listId" value={list.id} />
						<Input
							type="text"
							name="name"
							placeholder="Add item..."
							bind:value={input.name}
							class="flex-1"
						/>
						<Input
							type="text"
							name="quantity"
							placeholder="Qty"
							bind:value={input.quantity}
							class="w-16"
						/>
						<Input
							type="text"
							name="unit"
							placeholder="Unit"
							bind:value={input.unit}
							class="w-20"
						/>
						<Button type="submit" variant="outline" size="icon">
							<Plus class="h-4 w-4" />
						</Button>
					</form>
					{/key}

								<!-- Items List -->
								{#if list.items && list.items.length > 0}
									<ul class="space-y-2">
										{#each list.items as item}
											<li class="flex items-center gap-3 rounded-lg border border-sand p-3">
												<form
													method="POST"
													action="?/toggleItem"
													use:enhance={() => {
														return async () => {
															await invalidateAll();
														};
													}}
												>
													<input type="hidden" name="itemId" value={item.id} />
													<input type="hidden" name="checked" value={!item.checked} />
													<button type="submit">
														<Checkbox checked={!!item.checked} />
													</button>
												</form>
												<span
													class="flex-1 {item.checked
														? 'text-ink-muted line-through'
														: 'text-ink'}"
												>
													<span class="font-medium">
														{item.quantity} {item.unit}
													</span>
													{item.name}
												</span>
												<form
													method="POST"
													action="?/deleteItem"
													use:enhance={() => {
														return async () => {
															await invalidateAll();
														};
													}}
												>
													<input type="hidden" name="itemId" value={item.id} />
													<Button
														type="submit"
														variant="ghost"
														size="icon"
														class="h-8 w-8 text-ink-muted hover:text-sienna-600"
													>
														<Trash2 class="h-4 w-4" />
													</Button>
												</form>
											</li>
										{/each}
									</ul>
								{:else}
									<p class="py-4 text-center text-sm text-ink-muted">
										No items in this list yet
									</p>
								{/if}
							</Card.Content>
						{/if}
					</Card.Root>
				{/each}
			{/if}
		</div>

		<!-- Sidebar -->
		<div class="space-y-6">
			<!-- Smart Suggestions -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<Sparkles class="h-5 w-5 text-sage-600" />
						Smart Suggestions
					</Card.Title>
					<Card.Description>Based on your purchase history</Card.Description>
				</Card.Header>
			<Card.Content>
				{#if data.suggestions && data.suggestions.length > 0}
					<ul class="space-y-3">
						{#each data.suggestions as suggestion}
							<li class="flex items-center justify-between gap-3">
								<div>
									<p class="font-medium text-ink">{suggestion.itemName}</p>
									<p class="text-xs text-ink-muted">
										Usually buy every {suggestion.avgFrequencyDays ?? '—'} days
									</p>
								</div>
								<form method="POST" action="?/addSuggestion" use:enhance={() => {}} class="flex items-center gap-2">
									<input type="hidden" name="listId" value={data.activeList?.id} />
									<input type="hidden" name="itemName" value={suggestion.itemName} />
									<input type="hidden" name="suggestedQuantity" value={suggestion.suggestedQuantity || ''} />
									<input type="hidden" name="avgFrequencyDays" value={suggestion.avgFrequencyDays || ''} />
									<input type="hidden" name="lastPurchased" value={suggestion.lastPurchased} />
									<input type="hidden" name="daysSinceLastPurchase" value={suggestion.daysSinceLastPurchase} />
									<Button type="submit" size="sm" variant="outline">
										Add
									</Button>
								</form>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="py-4 text-center text-sm text-ink-muted">
						Upload receipts to get personalized suggestions
					</p>
				{/if}
			</Card.Content>
		</Card.Root>

			<!-- Quick Actions -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Quick Actions</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-2">
					<Button variant="outline" class="w-full" href="/recipes">
						<ShoppingCart class="mr-2 h-4 w-4" />
						Generate from Recipes
					</Button>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
