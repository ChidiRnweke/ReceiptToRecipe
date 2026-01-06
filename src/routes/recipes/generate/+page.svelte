<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { ChefHat, Plus, X, Sparkles } from 'lucide-svelte';

	let { data, form } = $props();
	let loading = $state(false);
	let customIngredients = $state<string[]>([]);
	let newIngredient = $state('');
	let selectedReceiptItems = $state<Set<string>>(new Set());
	let useRag = $state(false);
	let servings = $state(data.preferences?.defaultServings || 2);
	let cuisineHint = $state('');

	function addIngredient() {
		if (newIngredient.trim()) {
			customIngredients = [...customIngredients, newIngredient.trim()];
			newIngredient = '';
		}
	}

	function removeIngredient(index: number) {
		customIngredients = customIngredients.filter((_, i) => i !== index);
	}

	function toggleReceiptItem(itemId: string) {
		if (selectedReceiptItems.has(itemId)) {
			selectedReceiptItems.delete(itemId);
		} else {
			selectedReceiptItems.add(itemId);
		}
		selectedReceiptItems = new Set(selectedReceiptItems);
	}
</script>

<svelte:head>
	<title>Generate Recipe - Receipt2Recipe</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<div>
		<h1 class="font-serif text-3xl font-medium text-ink">Generate Recipe</h1>
		<p class="mt-1 text-ink-light">Create a recipe based on your available ingredients</p>
	</div>

	<form
		method="POST"
		use:enhance={() => {
			loading = true;
			return async ({ result }) => {
				loading = false;
				if (result.type === 'redirect') {
					goto(result.location);
				}
			};
		}}
		class="space-y-6"
	>
		{#if form?.error}
			<div class="rounded-lg bg-sienna-50 p-3 text-sm text-sienna-700">
				{form.error}
			</div>
		{/if}

		<!-- Receipt Items Selection -->
		{#if data.recentReceipts && data.recentReceipts.length > 0}
			<Card.Root>
				<Card.Header>
					<Card.Title>From Recent Receipts</Card.Title>
					<Card.Description>Select ingredients from your uploaded receipts</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="space-y-4">
						{#each data.recentReceipts as receipt}
							{#if receipt.items && receipt.items.length > 0}
								<div>
									<p class="mb-2 font-medium text-ink">{receipt.storeName || 'Unknown Store'}</p>
									<div class="flex flex-wrap gap-2">
										{#each receipt.items as item}
											<button
												type="button"
												onclick={() => toggleReceiptItem(item.id)}
												class="rounded-full border px-3 py-1 text-sm transition-colors {selectedReceiptItems.has(
													item.id
												)
													? 'border-sage-500 bg-sage-100 text-sage-700'
													: 'border-sand bg-paper hover:border-sage-400'}"
											>
												{item.normalizedName}
											</button>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</div>
					<input type="hidden" name="ingredientIds" value={Array.from(selectedReceiptItems).join(',')} />
				</Card.Content>
			</Card.Root>
		{/if}

		<!-- Custom Ingredients -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Add Custom Ingredients</Card.Title>
				<Card.Description>Add any ingredients not from your receipts</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex gap-2">
					<Input
						type="text"
						placeholder="e.g., garlic, olive oil, onion"
						bind:value={newIngredient}
						onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addIngredient())}
					/>
					<Button type="button" variant="outline" onclick={addIngredient}>
						<Plus class="h-4 w-4" />
					</Button>
				</div>

				{#if customIngredients.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each customIngredients as ingredient, i}
							<span
								class="flex items-center gap-1 rounded-full border border-sage-500 bg-sage-100 px-3 py-1 text-sm text-sage-700"
							>
								{ingredient}
								<button type="button" onclick={() => removeIngredient(i)} class="hover:text-sage-900">
									<X class="h-3 w-3" />
								</button>
							</span>
						{/each}
					</div>
				{/if}
				<input type="hidden" name="customIngredients" value={customIngredients.join(',')} />
			</Card.Content>
		</Card.Root>

		<!-- Options -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Options</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="servings">Servings</Label>
						<Input
							id="servings"
							name="servings"
							type="number"
							min="1"
							max="20"
							bind:value={servings}
						/>
					</div>
					<div class="space-y-2">
						<Label for="cuisineHint">Cuisine Style (optional)</Label>
						<Input
							id="cuisineHint"
							name="cuisineHint"
							type="text"
							placeholder="e.g., Italian, Mexican, Asian"
							bind:value={cuisineHint}
						/>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<Checkbox id="useRag" name="useRag" bind:checked={useRag} />
					<Label for="useRag" class="font-normal">
						<Sparkles class="mr-1 inline h-4 w-4 text-sage-600" />
						Use cookbook knowledge for inspiration
					</Label>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Submit -->
		<div class="flex gap-3">
			<Button type="button" variant="outline" href="/recipes" class="flex-1">Cancel</Button>
			<Button
				type="submit"
				disabled={loading || (selectedReceiptItems.size === 0 && customIngredients.length === 0)}
				class="flex-1"
			>
				{#if loading}
					Generating...
				{:else}
					<ChefHat class="mr-2 h-4 w-4" />
					Generate Recipe
				{/if}
			</Button>
		</div>
	</form>
</div>
