<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		ArrowLeft,
		Clock,
		Users,
		ShoppingCart,
		Share2,
		Heart,
		Trash2,
		ChefHat,
		Sparkles,
		Check,
		Loader2,
		Printer,
		PenLine,
		Utensils,
		Receipt,
		Bookmark
	} from 'lucide-svelte';
	import LoadingState from '$lib/components/LoadingState.svelte';
	import { workflowStore } from '$lib/state/workflow.svelte';
	import StockBadge from '$lib/components/StockBadge.svelte';
	import WashiTape from '$lib/components/WashiTape.svelte';
	import PinnedNote from '$lib/components/PinnedNote.svelte';
	import RecipeNarrator from '$lib/components/RecipeNarrator.svelte';
	import RecipeAdjuster from '$lib/components/RecipeAdjuster.svelte';

	let { data } = $props();

	// Subscribe to streamed recipe data
	let recipe = $state<any>(null);
	let isSaved = $state(false);
	let isOwner = $state(false);
	let sourceReceipt = $state<any>(null);
	let recipeLoading = $state(true);

	// Subscribe to streamed pantry and suggestions
	let pantryMatches = $state<Record<string, number>>({});
	let suggestions = $state<string[]>([]);

	$effect(() => {
		if (data.streamed?.recipeData) {
			recipeLoading = true;
			data.streamed.recipeData
				.then((recipeData) => {
					recipe = recipeData.recipe;
					isSaved = recipeData.isSaved;
					isOwner = recipeData.isOwner;
					sourceReceipt = recipeData.sourceReceipt;
					recipeLoading = false;
				})
				.catch(() => {
					recipe = null;
					recipeLoading = false;
				});
		}
		if (data.streamed?.pantryMatches) {
			data.streamed.pantryMatches
				.then((matches) => {
					pantryMatches = matches;
				})
				.catch(() => {
					pantryMatches = {};
				});
		}
		if (data.streamed?.suggestions) {
			data.streamed.suggestions
				.then((sugg) => {
					suggestions = sugg;
				})
				.catch(() => {
					suggestions = [];
				});
		}
	});

	// Local state
	let servings = $state(1);
	let pollingInterval: ReturnType<typeof setInterval> | null = null;
	let shareMessage = $state('');
	let addingToList = $state(false);
	let completedSteps = $state<Set<number>>(new Set());
	let excludePantry = $state(true);

	// Update servings when recipe loads
	$effect(() => {
		if (recipe?.servings) {
			servings = recipe.servings;
		}
	});

	const scaleFactor = $derived(servings / (recipe?.servings ?? 1));
	const steps = $derived(
		recipe?.instructions
			?.split('\n')
			.map((s: string) => s.trim())
			.filter((s: string) => s.length > 0) ?? []
	);

	const pantrySet = $derived(
		new Set(Object.keys(pantryMatches).map((i: string) => i.toLowerCase()))
	);
	const missingCount = $derived(
		recipe?.ingredients?.filter((i: any) => !pantrySet.has(i.name.toLowerCase())).length ?? 0
	);

	function toggleStep(index: number) {
		const newSet = new Set(completedSteps);
		if (newSet.has(index)) {
			newSet.delete(index);
		} else {
			newSet.add(index);
		}
		completedSteps = newSet;
	}

	onMount(() => {
		if (recipe?.imageStatus === 'QUEUED' || recipe?.imageStatus === 'PROCESSING') {
			pollingInterval = setInterval(async () => {
				await invalidateAll();
				if (recipe?.imageStatus === 'DONE' || recipe?.imageStatus === 'FAILED') {
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

	async function copyShareLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			shareMessage = 'Link copied';
			setTimeout(() => (shareMessage = ''), 2000);
		} catch (err) {
			shareMessage = 'Unable to copy';
			setTimeout(() => (shareMessage = ''), 2000);
		}
	}
</script>

<svelte:head>
	<title>{recipe?.title || 'Recipe'} - Receipt2Recipe</title>
</svelte:head>

{#if recipeLoading}
	<!-- Skeleton Loading State -->
	<div
		class="font-body relative min-h-screen overflow-x-hidden bg-bg-paper p-4 text-text-primary md:p-8"
	>
		<!-- Back Navigation Skeleton -->
		<div class="absolute top-4 left-4 z-50 hidden md:block">
			<Skeleton class="h-6 w-20" />
		</div>

		<div
			class="relative mx-auto mt-4 min-h-[90vh] max-w-5xl overflow-hidden border-l-4 border-border bg-white shadow-2xl md:mt-8"
		>
			<!-- Skeleton Hero -->
			<div class="h-32 w-full bg-bg-card md:h-75">
				<Skeleton class="h-full w-full" />
			</div>

			<!-- Skeleton Title Card -->
			<div class="relative z-10 -mt-12 mb-8 px-6 md:px-12">
				<div class="border border-border/50 bg-white p-6 shadow-md">
					<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
						<div class="flex-1 space-y-3">
							<Skeleton class="h-4 w-24" />
							<Skeleton class="h-10 w-3/4" />
							<Skeleton class="h-5 w-full" />
						</div>
						<div
							class="flex min-w-35 shrink-0 flex-row gap-4 border-t border-border pt-3 md:flex-col md:gap-2 md:border-t-0 md:border-l md:pt-0 md:pl-6"
						>
							<Skeleton class="h-4 w-20" />
							<Skeleton class="h-4 w-24" />
							<Skeleton class="h-4 w-16" />
						</div>
					</div>
				</div>
			</div>

			<!-- Skeleton Content -->
			<div class="grid gap-0 border-t border-border md:grid-cols-[1fr_1.5fr]">
				<!-- Ingredients Skeleton -->
				<div class="border-r border-border/50 bg-[#faf9f6] p-8 md:p-12">
					<Skeleton class="mb-8 h-8 w-40" />
					<div class="space-y-4">
						{#each Array(8) as _}
							<div class="flex items-center gap-3">
								<Skeleton class="h-3 w-3 rounded-full" />
								<Skeleton class="h-4 flex-1" />
							</div>
						{/each}
					</div>
				</div>

				<!-- Instructions Skeleton -->
				<div class="bg-white p-8 md:p-12">
					<Skeleton class="mb-8 h-8 w-32" />
					<div class="space-y-8">
						{#each Array(4) as _}
							<div class="flex gap-6">
								<Skeleton class="h-10 w-8" />
								<Skeleton class="h-20 flex-1" />
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
{:else if !recipe}
	<!-- Error State -->
	<div class="flex min-h-screen items-center justify-center">
		<div class="text-center">
			<h1 class="font-display text-2xl text-text-primary">Recipe not found</h1>
			<p class="mt-2 text-text-secondary">This recipe may have been deleted or doesn't exist.</p>
			<Button href="/recipes" class="mt-4">Back to Cookbook</Button>
		</div>
	</div>
{:else}
	<!-- Actual Recipe Content -->
	<div
		class="font-body relative min-h-screen overflow-x-hidden bg-bg-paper p-4 text-text-primary md:p-8"
	>
		<!-- Desk Texture -->
		<div
			class="pointer-events-none absolute inset-0 opacity-[0.03]"
			style="background-image: url('https://www.transparenttextures.com/patterns/cardboard-flat.png')"
		></div>

		<!-- Back Navigation (Diegetic: Sticky Note) -->
		<div class="absolute top-4 left-4 z-50 hidden md:block">
			<a
				href="/recipes"
				class="flex items-center gap-1 text-text-secondary decoration-secondary-400 decoration-wavy hover:text-text-primary hover:underline"
			>
				<ArrowLeft class="h-4 w-4" />
				<span class="font-hand text-lg font-bold">Index</span>
			</a>
		</div>

		<!-- Mobile Back Button -->
		<div class="mb-4 md:hidden">
			<Button variant="ghost" href="/recipes" class="-ml-2 text-text-muted">
				<ArrowLeft class="mr-2 h-4 w-4" />
				Back to Cookbook
			</Button>
		</div>

		<div
			class="relative mx-auto mt-4 min-h-[90vh] max-w-5xl overflow-hidden border-l-4 border-border bg-white shadow-2xl md:mt-8"
		>
			<!-- Paper Texture Overlay -->
			<div class="pointer-events-none absolute inset-0 bg-bg-card/20 mix-blend-multiply"></div>

			<!-- Bookmark Ribbon -->
			<div class="absolute top-0 right-8 z-20">
				<div class="relative flex flex-col items-center">
					<div class="flex h-24 w-8 items-end justify-center bg-red-700 pb-2 shadow-md">
						<Bookmark class="h-4 w-4 text-red-900 drop-shadow-sm" fill="currentColor" />
					</div>
					<div
						class="h-4 w-8 border-t-10 border-r-16 border-l-16 border-t-red-700 border-r-transparent border-l-transparent"
					></div>
				</div>
			</div>

			<!-- Hero Image Area (Compact) -->
			<div class="group relative h-32 w-full overflow-hidden bg-bg-card md:h-75">
				{#if recipe.imageStatus === 'DONE' && recipe.imageUrl}
					<img
						src={recipe.imageUrl}
						alt={recipe.title}
						class="h-full w-full object-cover transition-transform duration-[2s] group-hover:scale-105"
					/>
					<div
						class="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent opacity-60"
					></div>
				{:else if recipe.imageStatus === 'PROCESSING' || recipe.imageStatus === 'QUEUED'}
					<LoadingState
						size="lg"
						text="Developing photo..."
						class="h-full w-full bg-bg-paper-dark"
					/>
				{:else}
					<div
						class="pattern-grid-lg flex h-full w-full items-center justify-center bg-bg-card text-text-muted/50"
					>
						<ChefHat class="h-16 w-16 opacity-20" />
					</div>
				{/if}

				<!-- Actions Toolbar (Floating on Image) -->
				<div
					class="absolute top-4 right-20 z-30 flex gap-2 opacity-100 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100"
				>
					<Button
						variant="secondary"
						size="icon"
						class="h-8 w-8 rounded-full bg-white/90 shadow-sm backdrop-blur-sm hover:bg-white"
						onclick={copyShareLink}
						title="Share"
					>
						<Share2 class="h-3.5 w-3.5 text-text-primary" />
					</Button>
					<Button
						variant="secondary"
						size="icon"
						class="h-8 w-8 rounded-full bg-white/90 shadow-sm backdrop-blur-sm hover:bg-white"
						onclick={() => window.print()}
						title="Print"
					>
						<Printer class="h-3.5 w-3.5 text-text-primary" />
					</Button>
					{#if isOwner}
						<form method="POST" action="?/delete" use:enhance>
							<input type="hidden" name="recipeId" value={recipe.id} />
							<Button
								variant="secondary"
								size="icon"
								class="h-8 w-8 rounded-full bg-white/90 text-text-primary shadow-sm backdrop-blur-sm hover:bg-danger-50 hover:text-danger-600"
								type="submit"
							>
								<Trash2 class="h-3.5 w-3.5" />
							</Button>
						</form>
					{/if}
				</div>
			</div>

			<!-- Title Card (Compact & Overlapping) -->
			<div class="relative z-10 -mt-12 mb-8 px-6 md:px-12">
				<div
					class="relative border border-border/50 bg-white p-6 shadow-[0_5px_20px_-5px_rgba(0,0,0,0.1)]"
				>
					<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
						<div class="flex-1 space-y-2">
							{#if recipe.cuisineType}
								<p class="font-ui text-[10px] tracking-[0.2em] text-text-muted uppercase">
									{recipe.cuisineType}
								</p>
							{/if}

							<h1 class="font-display text-3xl leading-tight text-text-primary md:text-4xl">
								{recipe.title}
							</h1>

							{#if recipe.description}
								<p class="font-body text-base leading-snug text-text-secondary italic">
									{recipe.description}
								</p>
							{/if}
						</div>

						<!-- Compact Meta Data -->
						<div
							class="flex min-w-35 shrink-0 flex-row gap-4 border-t border-border pt-3 md:flex-col md:gap-2 md:border-t-0 md:border-l md:pt-0 md:pl-6"
						>
							{#if recipe.prepTime || recipe.cookTime}
								<div class="flex items-center gap-2 text-text-secondary">
									<Clock class="h-4 w-4 text-secondary-500" />
									<span class="font-ui text-xs tracking-wider uppercase">
										{formatTime((recipe.prepTime || 0) + (recipe.cookTime || 0))}
									</span>
								</div>
							{/if}

							<div class="group relative flex items-center gap-2 text-text-secondary">
								<Users class="h-4 w-4 text-primary-500" />
								<span class="font-ui text-xs tracking-wider uppercase">{servings} Servings</span>
								<!-- Popover Servings Control -->
								<div
									class="absolute top-full left-0 z-50 mt-1 flex gap-1 rounded-lg border border-border bg-white p-1 opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
								>
									<button
										class="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-bg-hover"
										onclick={() => servings > 1 && (servings -= 1)}>-</button
									>
									<button
										class="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-bg-hover"
										onclick={() => servings < 20 && (servings += 1)}>+</button
									>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- The Spread (Two Columns) -->
			<div class="grid gap-0 border-t border-border md:grid-cols-[1fr_1.5fr]">
				<!-- Left: Ingredients (Textured Background) -->
				<div class="relative border-r border-border/50 bg-[#faf9f6] p-8 md:p-12">
					<div class="sticky top-8">
						<div class="mb-8 flex items-center justify-between">
							<h2 class="font-display text-3xl text-text-primary">Ingredients</h2>
							<Utensils class="h-5 w-5 text-text-muted/50" />
						</div>

						<ul class="font-body relative z-10 space-y-4 text-text-primary">
							{#each recipe.ingredients as ingredient}
								{@const inPantry = pantrySet.has(ingredient.name.toLowerCase())}
								<li class="group flex items-baseline gap-3">
									<div
										class="relative top-1 h-3 w-3 shrink-0 rounded-full border border-border transition-colors {inPantry
											? 'bg-success-200 border-success-300'
											: ''}"
									>
										{#if inPantry}
											<Check
												class="text-success-700 absolute top-1/2 left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2"
											/>
										{/if}
									</div>
									<div
										class="flex-1 border-b border-dashed border-border pb-2 transition-colors group-hover:border-border/80"
									>
										<span class="font-bold text-text-secondary"
											>{formatQuantity(ingredient.quantity, scaleFactor)} {ingredient.unit}</span
										>
										<span class="text-text-secondary">{ingredient.name}</span>
										{#if ingredient.optional}
											<span class="ml-2 text-xs text-text-muted italic">(optional)</span>
										{/if}
									</div>
								</li>
							{/each}
						</ul>

						<!-- Shopping List Action (Diegetic Note) -->
						<div class="mt-12 -rotate-1 transform">
							<div class="group relative border border-secondary-200 bg-secondary-50 p-4 shadow-sm">
								<!-- Pushpin -->
								<div
									class="absolute -top-3 left-1/2 -translate-x-1/2 text-danger-500 drop-shadow-sm"
								>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"
										><path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" /></svg
									>
								</div>

								<div class="mb-3 flex items-center justify-between pt-2">
									<h3 class="font-hand text-xl font-bold text-text-primary/80">Shopping List</h3>
									<label class="flex cursor-pointer items-center gap-2">
										<input
											type="checkbox"
											bind:checked={excludePantry}
											class="rounded border-border text-secondary-600 focus:ring-0"
										/>
										<span class="font-ui text-[10px] tracking-wide text-text-muted uppercase"
											>Hide Items In Stock</span
										>
									</label>
								</div>

								<form
									method="POST"
									action="?/addToShopping"
									use:enhance={({ formData }) => {
										addingToList = true;
										formData.set('excludePantry', excludePantry.toString());
										const countToAdd = excludePantry ? missingCount : recipe.ingredients.length;
										workflowStore.shoppingItems += countToAdd;
										return async ({ result }) => {
											addingToList = false;
											if (result.type === 'failure') workflowStore.shoppingItems -= countToAdd;
											else await invalidateAll();
										};
									}}
								>
									<button
										type="submit"
										disabled={addingToList}
										class="font-hand flex w-full items-center justify-between text-left text-xl text-text-primary underline decoration-border decoration-dashed underline-offset-4 transition-all hover:text-secondary-700 hover:decoration-secondary-400"
									>
										<span>{addingToList ? 'Adding...' : 'Add Missing Items'}</span>
										<PenLine class="h-5 w-5 opacity-50" />
									</button>
								</form>
							</div>
						</div>

						<!-- Recipe Adjuster (AI-Powered) -->
						<div class="mt-6">
							<RecipeAdjuster
								recipeId={recipe.id}
								title={recipe.title}
								description={recipe.description}
								ingredients={recipe.ingredients}
								instructions={recipe.instructions}
								{isOwner}
								{suggestions}
								onAdjust={() => invalidateAll()}
							/>
						</div>
					</div>
				</div>

				<!-- Right: Instructions (Clean White) -->
				<div class="bg-white p-8 md:p-12">
					<div class="mb-8 flex items-center justify-between">
						<div class="flex items-center gap-4">
							<h2 class="font-display text-3xl text-text-primary">
								<span class="marker-highlight">Method</span>
							</h2>
							<RecipeNarrator
								title={recipe.title}
								ingredients={recipe.ingredients}
								instructions={recipe.instructions}
								{servings}
							/>
						</div>
						{#if completedSteps.size > 0}
							<Badge variant="outline" class="font-ui">{completedSteps.size}/{steps.length}</Badge>
						{/if}
					</div>

					<div class="space-y-6 md:space-y-10">
						{#each steps as step, i}
							<button class="group flex w-full gap-6 text-left" onclick={() => toggleStep(i)}>
								<div class="flex shrink-0 flex-col items-center gap-1 pt-1">
									<span
										class="font-display text-4xl leading-none transition-colors {completedSteps.has(
											i
										)
											? 'text-primary-300'
											: 'text-border group-hover:text-border/80'}">{i + 1}</span
									>
								</div>
								<div class="w-full border-b border-border/50 pb-8 group-last:border-0">
									<p
										class="font-body text-lg leading-relaxed transition-colors {completedSteps.has(
											i
										)
											? 'text-text-muted line-through decoration-border'
											: 'text-text-primary group-hover:text-text-secondary'}"
									>
										{step}
									</p>
								</div>
							</button>
						{/each}
					</div>

					<!-- Footer Notes -->
					<div
						class="font-body mt-16 flex items-center justify-between border-t border-border pt-8 text-sm text-text-muted italic"
					>
						<span>Chef's Kitchen</span>
						{#if sourceReceipt}
							<span class="flex items-center gap-1"
								><Receipt class="h-3 w-3" /> Source: {sourceReceipt.storeName}</span
							>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Spacer for visual balance -->
		<div class="h-20"></div>
	</div>
{/if}
