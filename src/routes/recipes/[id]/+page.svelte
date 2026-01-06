<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		ArrowLeft,
		Clock,
		Users,
		Flame,
		ShoppingCart,
		Share2,
		Heart,
		Minus,
		Plus
	} from 'lucide-svelte';

	let { data } = $props();

	let servings = $state(data.recipe.servings);
	let pollingInterval: ReturnType<typeof setInterval> | null = null;

	const scaleFactor = $derived(servings / data.recipe.servings);

	onMount(() => {
		if (data.recipe.imageStatus === 'QUEUED' || data.recipe.imageStatus === 'PROCESSING') {
			pollingInterval = setInterval(async () => {
				await invalidateAll();
				if (data.recipe.imageStatus === 'DONE' || data.recipe.imageStatus === 'FAILED') {
					if (pollingInterval) clearInterval(pollingInterval);
				}
			}, 3000);
		}

		return () => {
			if (pollingInterval) clearInterval(pollingInterval);
		};
	});

	function formatTime(minutes: number | null) {
		if (!minutes) return null;
		if (minutes < 60) return `${minutes} min`;
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
	}

	function formatQuantity(qty: string, scale: number) {
		const num = parseFloat(qty) * scale;
		if (num === Math.floor(num)) return num.toString();
		return num.toFixed(1);
	}
</script>

<svelte:head>
	<title>{data.recipe.title} - Receipt2Recipe</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-8">
	<!-- Header -->
	<div class="flex items-start gap-4">
		<Button variant="ghost" size="icon" href="/recipes">
			<ArrowLeft class="h-5 w-5" />
		</Button>
		<div class="flex-1">
			<h1 class="font-serif text-4xl font-medium tracking-tight text-ink">
				{data.recipe.title}
			</h1>
			{#if data.recipe.description}
				<p class="mt-2 text-lg text-ink-light">{data.recipe.description}</p>
			{/if}

			<div class="mt-4 flex flex-wrap items-center gap-4 text-ink-light">
				{#if data.recipe.prepTime}
					<span class="flex items-center gap-1">
						<Clock class="h-4 w-4" />
						Prep: {formatTime(data.recipe.prepTime)}
					</span>
				{/if}
				{#if data.recipe.cookTime}
					<span class="flex items-center gap-1">
						<Clock class="h-4 w-4" />
						Cook: {formatTime(data.recipe.cookTime)}
					</span>
				{/if}
				<span class="flex items-center gap-1">
					<Users class="h-4 w-4" />
					{data.recipe.servings} servings
				</span>
				{#if data.recipe.estimatedCalories}
					<span class="flex items-center gap-1">
						<Flame class="h-4 w-4" />
						{data.recipe.estimatedCalories} cal/serving
					</span>
				{/if}
				{#if data.recipe.cuisineType}
					<Badge variant="outline">{data.recipe.cuisineType}</Badge>
				{/if}
			</div>
		</div>
	</div>

	<div class="grid gap-8 lg:grid-cols-3">
		<!-- Main Content -->
		<div class="lg:col-span-2 space-y-8">
			<!-- Recipe Image -->
			{#if data.recipe.imageStatus === 'DONE' && data.recipe.imageUrl}
				<img
					src={data.recipe.imageUrl}
					alt={data.recipe.title}
					class="w-full rounded-xl object-cover"
				/>
			{:else if data.recipe.imageStatus === 'PROCESSING' || data.recipe.imageStatus === 'QUEUED'}
				<Skeleton class="aspect-video w-full rounded-xl" />
			{/if}

			<!-- Instructions -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="font-serif text-2xl">Instructions</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="prose prose-neutral max-w-none">
						{#each data.recipe.instructions.split('\n') as step, i}
							{#if step.trim()}
								<p class="mb-4 leading-relaxed text-ink">
									{step}
								</p>
							{/if}
						{/each}
					</div>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Sidebar -->
		<div class="space-y-6">
			<!-- Servings Adjuster -->
			<Card.Root>
				<Card.Header>
					<Card.Title>Servings</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="flex items-center justify-center gap-4">
						<Button
							variant="outline"
							size="icon"
							onclick={() => servings > 1 && (servings -= 1)}
							disabled={servings <= 1}
						>
							<Minus class="h-4 w-4" />
						</Button>
						<span class="text-2xl font-medium text-ink">{servings}</span>
						<Button
							variant="outline"
							size="icon"
							onclick={() => servings < 20 && (servings += 1)}
							disabled={servings >= 20}
						>
							<Plus class="h-4 w-4" />
						</Button>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Ingredients -->
			<Card.Root>
				<Card.Header>
					<Card.Title class="font-serif text-xl">Ingredients</Card.Title>
				</Card.Header>
				<Card.Content>
					<ul class="space-y-3">
						{#each data.recipe.ingredients as ingredient}
							<li class="flex items-start gap-2">
								<span class="font-medium text-ink">
									{formatQuantity(ingredient.quantity, scaleFactor)} {ingredient.unit}
								</span>
								<span class="text-ink-light">
									{ingredient.name}
									{#if ingredient.optional}
										<span class="text-ink-muted">(optional)</span>
									{/if}
								</span>
							</li>
						{/each}
					</ul>
				</Card.Content>
			</Card.Root>

			<!-- Actions -->
			<div class="space-y-2">
				<Button class="w-full" variant="outline">
					<ShoppingCart class="mr-2 h-4 w-4" />
					Add to Shopping List
				</Button>
				<Button class="w-full" variant="outline">
					<Heart class="mr-2 h-4 w-4" />
					Save Recipe
				</Button>
				<Button class="w-full" variant="outline">
					<Share2 class="mr-2 h-4 w-4" />
					Share
				</Button>
			</div>
		</div>
	</div>
</div>
