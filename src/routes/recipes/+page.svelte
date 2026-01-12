<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		Plus,
		ChefHat,
		Clock,
		Users,
		Trash2,
		Sparkles,
		Flame,
		Utensils,
		Heart
	} from 'lucide-svelte';

	let { data } = $props();
	let deletingId = $state<string | null>(null);

	function formatTime(minutes: number | null) {
		if (!minutes) return null;
		if (minutes < 60) return `${minutes}min`;
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
	}

	// Fun cooking quotes
	const quotes = [
		"Cooking is like love. It should be entered into with abandon or not at all.",
		"The secret ingredient is always love.",
		"Good food is the foundation of genuine happiness.",
		"Life is too short for boring meals."
	];
	const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
</script>

<svelte:head>
	<title>Recipes - Receipt2Recipe</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="relative">
			<div
				class="absolute -left-4 -top-2 h-20 w-20 rounded-full bg-sage-100/50 blur-2xl"
			></div>
			<p class="text-sm uppercase tracking-wide text-ink-muted">Step 2</p>
			<h1 class="font-serif text-3xl font-medium text-ink">Your Recipes</h1>
			<p class="mt-1 text-ink-light">
				{data.recipes.length === 0
					? 'Create delicious meals from your groceries'
					: `${data.recipes.length} recipe${data.recipes.length === 1 ? '' : 's'} in your collection`}
			</p>
		</div>
		<Button href="/recipes/generate">
			<Sparkles class="mr-2 h-4 w-4" />
			Generate Recipe
		</Button>
	</div>

	{#if data.recipes.length === 0}
		<Card.Root class="relative overflow-hidden border-dashed py-16 text-center">
			<div
				class="absolute right-0 top-0 h-32 w-32 rounded-full bg-sage-50 blur-3xl"
			></div>
			<Card.Content class="relative">
				<div class="relative mx-auto w-fit">
					<div class="flex h-20 w-20 items-center justify-center rounded-2xl bg-sage-50">
						<ChefHat class="h-10 w-10 text-sage-600" />
					</div>
					<Sparkles
						class="absolute -right-2 -top-2 h-6 w-6 text-sage-500"
					/>
				</div>
				<h3 class="mt-6 font-serif text-2xl font-medium text-ink">
					Your cookbook awaits
				</h3>
				<p class="mx-auto mt-2 max-w-md text-ink-light">
					Tell us what you're craving, and we'll create a custom recipe using ingredients you already have. Complete with images and step-by-step instructions.
				</p>
				<div class="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
					<Button href="/recipes/generate" size="lg">
						<Sparkles class="mr-2 h-4 w-4" />
						Generate your first recipe
					</Button>
				</div>
				<p class="mx-auto mt-6 max-w-sm text-sm italic text-ink-muted">
					"{randomQuote}"
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each data.recipes as recipe}
				<Card.Root class="group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
					<!-- Gradient accent on hover -->
					<div
						class="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-sage-400 to-sage-200 opacity-0 transition-opacity group-hover:opacity-100"
					></div>

					<a href="/recipes/{recipe.id}" class="block">
						{#if recipe.imageStatus === 'DONE' && recipe.imageUrl}
							<div class="aspect-video overflow-hidden">
								<img
									src={recipe.imageUrl}
									alt={recipe.title}
									class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
								/>
							</div>
						{:else if recipe.imageStatus === 'PROCESSING' || recipe.imageStatus === 'QUEUED'}
							<div class="relative aspect-video bg-paper-dark">
								<Skeleton class="h-full w-full" />
								<div class="absolute inset-0 flex items-center justify-center">
									<div class="flex items-center gap-2 rounded-full bg-paper/90 px-3 py-1.5 text-xs font-medium text-ink-muted">
										<Sparkles class="h-3 w-3 animate-pulse" />
										Creating image...
									</div>
								</div>
							</div>
						{:else}
							<div class="flex aspect-video items-center justify-center bg-gradient-to-br from-paper-dark to-sage-50">
								<div class="text-center">
									<ChefHat class="mx-auto h-12 w-12 text-sage-400" />
									<p class="mt-2 text-xs text-ink-muted">No image</p>
								</div>
							</div>
						{/if}

						<Card.Header class="pb-2">
							<Card.Title class="font-serif text-xl line-clamp-1 group-hover:text-sage-700 transition-colors">
								{recipe.title}
							</Card.Title>
							{#if recipe.description}
								<Card.Description class="line-clamp-2">{recipe.description}</Card.Description>
							{/if}
						</Card.Header>

						<Card.Content class="flex flex-wrap items-center gap-3 text-sm text-ink-light">
							{#if recipe.prepTime || recipe.cookTime}
								<span class="flex items-center gap-1">
									<Clock class="h-4 w-4 text-ink-muted" />
									{formatTime((recipe.prepTime || 0) + (recipe.cookTime || 0))}
								</span>
							{/if}
							<span class="flex items-center gap-1">
								<Users class="h-4 w-4 text-ink-muted" />
								{recipe.servings}
							</span>
							{#if recipe.calories}
								<span class="flex items-center gap-1">
									<Flame class="h-4 w-4 text-ink-muted" />
									{recipe.calories} cal
								</span>
							{/if}
							{#if recipe.cuisineType}
								<Badge variant="outline" class="ml-auto">{recipe.cuisineType}</Badge>
							{/if}
						</Card.Content>
					</a>
					<Card.Footer class="flex items-center justify-between border-t border-sand pt-3">
						<p class="text-xs text-ink-muted">
							{new Date(recipe.createdAt).toLocaleDateString()}
						</p>
						<form method="POST" action="?/delete" use:enhance={({ cancel }) => {
							const confirmed = confirm('Are you sure you want to delete this recipe?');
							if (!confirmed) {
								cancel();
								return;
							}
							deletingId = recipe.id;
						}}>
							<input type="hidden" name="recipeId" value={recipe.id} />
							<Button variant="ghost" size="sm" class="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100" disabled={deletingId === recipe.id}>
								<Trash2 class="h-4 w-4 text-ink-muted hover:text-sienna-600" />
							</Button>
						</form>
					</Card.Footer>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
