<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Plus, ChefHat, Clock, Users, Loader2 } from 'lucide-svelte';

	let { data } = $props();

	function formatTime(minutes: number | null) {
		if (!minutes) return null;
		if (minutes < 60) return `${minutes}min`;
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
	}
</script>

<svelte:head>
	<title>Recipes - Receipt2Recipe</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="font-serif text-3xl font-medium text-ink">Your Recipes</h1>
			<p class="mt-1 text-ink-light">AI-generated recipes from your ingredients</p>
		</div>
		<Button href="/recipes/generate">
			<Plus class="mr-2 h-4 w-4" />
			Generate Recipe
		</Button>
	</div>

	{#if data.recipes.length === 0}
		<Card.Root class="py-12 text-center">
			<Card.Content>
				<ChefHat class="mx-auto h-12 w-12 text-ink-muted" />
				<h3 class="mt-4 font-serif text-xl font-medium text-ink">No recipes yet</h3>
				<p class="mt-2 text-ink-light">Generate your first recipe from your ingredients</p>
				<Button href="/recipes/generate" class="mt-4">
					<Plus class="mr-2 h-4 w-4" />
					Generate Recipe
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each data.recipes as recipe}
				<a href="/recipes/{recipe.id}" class="group">
					<Card.Root class="overflow-hidden transition-shadow hover:shadow-md">
						{#if recipe.imageStatus === 'DONE' && recipe.imageUrl}
							<div class="aspect-video overflow-hidden">
								<img
									src={recipe.imageUrl}
									alt={recipe.title}
									class="h-full w-full object-cover transition-transform group-hover:scale-105"
								/>
							</div>
						{:else if recipe.imageStatus === 'PROCESSING' || recipe.imageStatus === 'QUEUED'}
							<div class="aspect-video">
								<Skeleton class="h-full w-full" />
							</div>
						{:else}
							<div class="flex aspect-video items-center justify-center bg-paper-dark">
								<ChefHat class="h-12 w-12 text-ink-muted" />
							</div>
						{/if}

						<Card.Header>
							<Card.Title class="font-serif text-xl line-clamp-1">{recipe.title}</Card.Title>
							{#if recipe.description}
								<Card.Description class="line-clamp-2">{recipe.description}</Card.Description>
							{/if}
						</Card.Header>

						<Card.Content class="flex items-center gap-4 text-sm text-ink-light">
							{#if recipe.prepTime || recipe.cookTime}
								<span class="flex items-center gap-1">
									<Clock class="h-4 w-4" />
									{formatTime((recipe.prepTime || 0) + (recipe.cookTime || 0))}
								</span>
							{/if}
							<span class="flex items-center gap-1">
								<Users class="h-4 w-4" />
								{recipe.servings} servings
							</span>
							{#if recipe.cuisineType}
								<Badge variant="outline">{recipe.cuisineType}</Badge>
							{/if}
						</Card.Content>
					</Card.Root>
				</a>
			{/each}
		</div>
	{/if}
</div>
