<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import {
		ChefHat,
		Trash2,
		Sparkles,
		ShoppingCart,
		Loader2,
		AlertTriangle,
		ShieldAlert,
		SlidersHorizontal
	} from 'lucide-svelte';
	import { slide } from 'svelte/transition';
	import { workflowStore } from '$lib/state/workflow.svelte';
	import WashiTape from '$lib/components/WashiTape.svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';

	let { data } = $props();
	let deletingId = $state<string | null>(null);
	let addingToShoppingId = $state<string | null>(null);

	// Dialog state
	let deleteDialogOpen = $state(false);
	let recipeToDelete = $state<string | null>(null);
	let showAllSuggested = $state(false);

	// Filters
	let hideIncompatible = $state(false);
	let showFilters = $state(false);

	const quotes = [
		'Cooking is like love. It should be entered into with abandon or not at all.',
		'The secret ingredient is always love.',
		'Good food is the foundation of genuine happiness.',
		'Life is too short for boring meals.'
	];
	const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

	function formatTime(minutes: number | null) {
		if (!minutes) return null;
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
	}

	function confirmDelete(id: string) {
		recipeToDelete = id;
		deleteDialogOpen = true;
	}
</script>

<svelte:head>
	<title>Cookbook - Receipt2Recipe</title>
</svelte:head>

<div
	class="paper-card relative min-h-screen overflow-hidden rounded-4xl border border-sand bg-bg-paper shadow-[0_30px_80px_-50px_rgba(45,55,72,0.6)]"
>
	<!-- Radial gradient background -->
	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.08),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.08),transparent_28%)]"
	></div>

	<!-- Main Content -->
	<main class="relative z-10 min-h-screen bg-white">
		<div class="mx-auto w-full max-w-6xl px-6 py-8 sm:px-10">
			<!-- Header -->
			<div class="mb-10 flex flex-wrap items-end justify-between gap-4">
				<div>
					<p class="font-hand mb-1 text-lg text-text-secondary">Your culinary collection</p>
					<h1
						class="font-display text-4xl leading-[1.1] text-text-primary drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]"
					>
						Recipe <span class="marker-highlight">Scrapbook</span>
					</h1>
					<div class="mt-2 flex items-center gap-4">
						{#await data.streamed.recipesData}
							<Skeleton class="h-3 w-28" />
						{:then recipesData}
							<p class="font-ui text-xs tracking-widest text-text-muted uppercase">
								{recipesData.recipes.length}
								{recipesData.recipes.length === 1 ? 'recipe' : 'recipes'} saved
							</p>
						{:catch}
							<p class="font-ui text-xs tracking-widest text-text-muted uppercase">0 recipes</p>
						{/await}
						<!-- Mobile: Collapsible filter -->
						<div class="md:hidden">
							<Button
								variant="ghost"
								size="sm"
								onclick={() => (showFilters = !showFilters)}
								class="flex items-center gap-1 text-xs font-medium text-text-muted"
							>
								<SlidersHorizontal class="h-3 w-3" />
								Filters
							</Button>
						</div>
						<!-- Desktop: Always visible filter -->
						<div class="hidden items-center gap-2 md:flex">
							<Checkbox id="hide-incompatible" bind:checked={hideIncompatible} class="h-4 w-4" />
							<Label
								for="hide-incompatible"
								class="cursor-pointer text-xs font-medium text-text-muted">Hide Incompatible</Label
							>
						</div>
					</div>

					<!-- Mobile: Expandable filter panel -->
					{#if showFilters}
						<div
							class="mt-3 rounded-lg border border-border bg-white p-3 md:hidden"
							transition:slide
						>
							<div class="flex items-center gap-2">
								<Checkbox
									id="hide-incompatible-mobile"
									bind:checked={hideIncompatible}
									class="h-4 w-4"
								/>
								<Label
									for="hide-incompatible-mobile"
									class="cursor-pointer text-sm font-medium text-text-muted"
									>Hide Incompatible</Label
								>
							</div>
						</div>
					{/if}
				</div>

				<div class="hidden md:block">
					<Button
						href="/recipes/generate"
						class="group relative h-10 overflow-hidden rounded-lg border border-primary-300 bg-white px-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-400 hover:bg-bg-card hover:shadow-md active:scale-95"
					>
						<div class="flex items-center gap-2">
							<Sparkles
								class="h-4 w-4 text-primary-600 transition-transform duration-500 group-hover:rotate-12 group-hover:text-primary-700"
							/>
							<span class="font-display text-base font-medium text-text-primary">New Recipe</span>
						</div>
					</Button>
				</div>
			</div>

			{#await data.streamed.recipesData}
				<!-- Recipe Cards Skeleton Grid -->
				<div class="mb-8 flex items-baseline justify-between border-b border-border pb-3">
					<Skeleton class="h-8 w-48" />
					<Skeleton class="h-4 w-24" />
				</div>

				<div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-10">
					{#each Array(6) as _, i}
						<div class="group mt-0">
							<Skeleton class="mb-3 h-9 w-32 rounded-full" />
							<div class="relative bg-white p-2 pb-16 shadow-md">
								<Skeleton class="aspect-square w-full" />
								<div class="absolute right-0 bottom-0 left-0 h-14 px-3 py-1.5">
									<Skeleton class="mb-2 h-4 w-full" />
									<Skeleton class="h-3 w-24" />
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:then recipesData}
				{@const recipes = recipesData.recipes}
				{@const receiptCount = recipesData.receiptCount}
				{@const suggestedRecipes = recipes.filter(
					(r: any) => r.isSuggested && (!hideIncompatible || (r.compatibility?.compatible ?? true))
				)}
				{@const otherRecipes = recipes.filter(
					(r: any) => !r.isSuggested && (!hideIncompatible || (r.compatibility?.compatible ?? true))
				)}

				<!-- Suggested Recipes -->
				{#if suggestedRecipes.length > 0}
					<div class="mb-16">
						<div class="mb-8 flex items-baseline justify-between border-b border-border pb-3">
							<h2 class="font-display text-2xl text-text-primary">
								Made for <span class="marker-highlight">Your Kitchen</span>
							</h2>
							<span class="font-ui text-[10px] tracking-widest text-primary-600 uppercase">
								<Sparkles class="mr-1 inline h-3 w-3" />
								AI Suggested
							</span>
						</div>

						<!-- 3 cards per row for suggested -->
						<div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-10">
							{#each showAllSuggested ? suggestedRecipes : suggestedRecipes.slice(0, 3) as recipe, i (recipe.id)}
								{@const rotations = ['-rotate-2', 'rotate-2', '-rotate-1']}
								{@const marginTops = ['mt-0', 'mt-6', 'mt-3']}
								<div class="group {marginTops[i % marginTops.length]}">
									<!-- Action button on top -->
									<div class="mb-3 flex items-center justify-center">
										<form
											method="POST"
											action="?/addToShopping"
											use:enhance={() => {
												addingToShoppingId = recipe.id;
												workflowStore.incrementShopping();
												return async ({ result }) => {
													addingToShoppingId = null;
													if (result.type === 'failure') workflowStore.decrementShopping();
													else await invalidateAll();
												};
											}}
										>
											<input type="hidden" name="recipeId" value={recipe.id} />
											<Button
												type="submit"
												variant="secondary"
												size="sm"
												disabled={addingToShoppingId === recipe.id}
												class="gap-1.5 rounded-full"
											>
												{#if addingToShoppingId === recipe.id}
													<Loader2 class="h-3.5 w-3.5 animate-spin" />
												{:else}
													<ShoppingCart class="h-3.5 w-3.5" />
												{/if}
												Shop Ingredients
											</Button>
										</form>
									</div>

									<!-- Photo Frame -->
									<a href="/recipes/{recipe.id}" class="block">
										<div
											class="
                    relative bg-white p-2 pb-16
                    shadow-[0_2px_8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)]
                    transition-all duration-300 ease-out
                    {rotations[i % rotations.length]}
                    group-hover:z-50 group-hover:-translate-y-2 group-hover:rotate-0 group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)]
                  "
										>
											<!-- Washi Tape -->
											<WashiTape
												color="sage"
												class="absolute -top-2 left-1/2 z-10 w-16 -translate-x-1/2"
											/>

											<!-- Photo -->
											<div class="relative aspect-square overflow-hidden bg-bg-card">
												{#if recipe.imageUrl}
													<img
														src={recipe.imageUrl}
														alt={recipe.title}
														class="h-full w-full object-cover"
													/>
												{:else}
													<div class="flex h-full w-full items-center justify-center bg-bg-card">
														<ChefHat class="h-12 w-12 text-text-muted" />
													</div>
												{/if}
												<!-- Match badge -->
												<div
													class="absolute right-2 bottom-2 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm"
												>
													{Math.round(recipe.matchPercentage * 100)}%
												</div>
											</div>

											<!-- Caption area -->
											<div
												class="absolute right-0 bottom-0 left-0 flex h-14 flex-col justify-center px-3 py-1.5"
											>
												<p
													class="font-display truncate text-center text-base leading-tight text-text-primary"
													title={recipe.title}
												>
													{recipe.title}
												</p>

												<!-- Compatibility Badge / Metadata -->
												<div class="mt-0.5 flex items-center justify-center gap-2">
													{#if recipe.compatibility && !recipe.compatibility.compatible}
														<span
															class="inline-flex items-center rounded border border-red-100 bg-red-50 px-1.5 text-[10px] font-bold text-red-600"
															title={recipe.compatibility.blockers.join(', ')}
														>
															<ShieldAlert class="mr-1 h-3 w-3" />
															Avoid
														</span>
													{:else if recipe.compatibility && recipe.compatibility.warnings.length > 0}
														<span
															class="inline-flex items-center rounded border border-amber-100 bg-amber-50 px-1.5 text-[10px] font-bold text-amber-600"
															title={recipe.compatibility.warnings.join(', ')}
														>
															<AlertTriangle class="mr-1 h-3 w-3" />
															Warning
														</span>
													{:else}
														<p
															class="font-ui text-center text-xs tracking-wide text-text-muted uppercase"
														>
															{formatTime((recipe.prepTime || 0) + (recipe.cookTime || 0)) || '?'} · {recipe.servings}
															servings
														</p>
													{/if}
												</div>
											</div>

											<!-- Full title tooltip on hover -->
											<div
												class="pointer-events-none absolute -bottom-10 left-1/2 z-30 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100"
											>
												<div
													class="max-w-65 rounded bg-text-primary px-3 py-1.5 text-center text-sm whitespace-normal text-white shadow-lg"
												>
													{recipe.title}
												</div>
											</div>
										</div>
									</a>
								</div>
							{/each}
						</div>
						{#if suggestedRecipes.length > 3}
							<div class="mt-6 text-center md:hidden">
								<Button
									variant="link"
									size="sm"
									onclick={() => (showAllSuggested = !showAllSuggested)}
									class="text-sm font-medium"
								>
									{showAllSuggested
										? 'Show less'
										: `See all ${suggestedRecipes.length} suggestions`}
								</Button>
							</div>
						{/if}
					</div>
				{/if}

				<!-- All Recipes -->
				{#if otherRecipes.length > 0}
					<div class="mt-8">
						<div class="mb-8 flex items-baseline justify-between border-b border-border pb-3">
							<h2 class="font-display text-2xl text-text-primary">All Recipes</h2>
							<span class="font-ui text-[10px] tracking-widest text-text-muted uppercase">
								{otherRecipes.length} saved
							</span>
						</div>

						<!-- 3 cards per row -->
						<div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-10">
							{#each otherRecipes as recipe, i (recipe.id)}
								{@const rotations = ['-rotate-2', 'rotate-2', '-rotate-1']}
								{@const marginTops = ['mt-0', 'mt-6', 'mt-3']}
								<div class="group {marginTops[i % marginTops.length]}">
									<!-- Action buttons on top -->
									<div class="mb-3 flex items-center justify-center gap-2">
										<form
											method="POST"
											action="?/addToShopping"
											use:enhance={() => {
												addingToShoppingId = recipe.id;
												workflowStore.incrementShopping();
												return async ({ result }) => {
													addingToShoppingId = null;
													if (result.type === 'failure') workflowStore.decrementShopping();
													else await invalidateAll();
												};
											}}
										>
											<input type="hidden" name="recipeId" value={recipe.id} />
											<Button
												type="submit"
												variant="secondary"
												size="icon"
												disabled={addingToShoppingId === recipe.id}
												title="Add to shopping list"
												class="rounded-full"
											>
												{#if addingToShoppingId === recipe.id}
													<Loader2 class="h-4 w-4 animate-spin" />
												{:else}
													<ShoppingCart class="h-4 w-4" />
												{/if}
											</Button>
										</form>

										<Button
											type="button"
											variant="ghost"
											size="icon"
											onclick={(e) => {
												e.stopPropagation();
												e.preventDefault();
												confirmDelete(recipe.id);
											}}
											disabled={deletingId === recipe.id}
											title="Delete recipe"
											class="rounded-full hover:bg-danger-500 hover:text-white"
										>
											{#if deletingId === recipe.id}
												<Loader2 class="h-4 w-4 animate-spin" />
											{:else}
												<Trash2 class="h-4 w-4" />
											{/if}
										</Button>
									</div>

									<!-- Photo Frame -->
									<a href="/recipes/{recipe.id}" class="block">
										<div
											class="
                    relative bg-white p-2 pb-16
                    shadow-[0_2px_6px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06)]
                    transition-all duration-300 ease-out
                    {rotations[i % rotations.length]}
                    group-hover:z-10 group-hover:-translate-y-2 group-hover:rotate-0
                    group-hover:shadow-[0_12px_24px_rgba(0,0,0,0.15)]
                  "
										>
											<!-- Photo -->
											<div class="relative aspect-square overflow-hidden bg-bg-card">
												{#if recipe.imageUrl}
													<img
														src={recipe.imageUrl}
														alt={recipe.title}
														class="h-full w-full object-cover"
													/>
												{:else}
													<div class="flex h-full w-full items-center justify-center bg-bg-card">
														<ChefHat class="h-10 w-10 text-text-muted" />
													</div>
												{/if}
											</div>

											<!-- Caption area -->
											<div
												class="absolute right-0 bottom-0 left-0 flex h-14 flex-col justify-center px-2 py-1.5"
											>
												<p
													class="font-display truncate text-center text-sm leading-tight text-text-primary"
													title={recipe.title}
												>
													{recipe.title}
												</p>
												<p
													class="font-ui mt-0.5 text-center text-[10px] tracking-wide text-text-muted uppercase"
												>
													{#if recipe.cuisineType}{recipe.cuisineType}{:else}{formatTime(
															(recipe.prepTime || 0) + (recipe.cookTime || 0)
														) || ''}{/if}
												</p>
											</div>

											<!-- Full title tooltip on hover -->
											<div
												class="pointer-events-none absolute -bottom-10 left-1/2 z-30 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100"
											>
												<div
													class="max-w-55 rounded bg-text-primary px-3 py-1.5 text-center text-xs whitespace-normal text-white shadow-lg"
												>
													{recipe.title}
												</div>
											</div>
										</div>
									</a>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if recipes.length === 0}
					<div class="flex flex-col items-center justify-center py-20">
						<!-- Empty photo frame -->
						<div
							class="relative mb-8 rotate-2 bg-white p-1.5 pb-12 shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
						>
							<div class="flex h-44 w-44 items-center justify-center bg-bg-card">
								<ChefHat class="h-12 w-12 text-text-muted" />
							</div>
							<p
								class="font-display absolute right-0 bottom-2 left-0 text-center text-sm text-text-muted"
							>
								Your first recipe?
							</p>
						</div>
						<h2 class="font-display mb-2 text-2xl text-text-primary">No recipes yet</h2>
						<p class="mb-8 max-w-xs text-center font-serif text-base text-text-muted italic">
							"{randomQuote}"
						</p>
						<Button
							href="/recipes/generate"
							class="group relative h-12 overflow-hidden rounded-lg border border-primary-300 bg-white px-8 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-400 hover:bg-bg-card hover:shadow-md active:scale-95"
						>
							<div class="flex items-center gap-2">
								<Sparkles
									class="h-4 w-4 text-primary-600 transition-transform duration-500 group-hover:rotate-12 group-hover:text-primary-700"
								/>
								<span class="font-display text-base font-medium text-text-primary"
									>Create Your First Recipe</span
								>
							</div>
						</Button>
					</div>
				{/if}
			{:catch error}
				<!-- Error State -->
				<div class="flex min-h-[40vh] items-center justify-center">
					<div class="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
						<p class="text-red-600">Failed to load recipes</p>
						<p class="mt-2 text-sm text-red-500">{error.message}</p>
					</div>
				</div>
			{/await}
		</div>
	</main>

	<AlertDialog.Root bind:open={deleteDialogOpen}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Are you sure?</AlertDialog.Title>
				<AlertDialog.Description>
					This will permanently delete this recipe from your cookbook. This action cannot be undone.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
				<form
					method="POST"
					action="?/delete"
					use:enhance={() => {
						deleteDialogOpen = false;
						if (recipeToDelete) deletingId = recipeToDelete;
						return async ({ update }) => {
							deletingId = null;
							await update();
						};
					}}
					class="inline-block"
				>
					<input type="hidden" name="recipeId" value={recipeToDelete} />
					<AlertDialog.Action type="submit" class="btn-danger">Delete</AlertDialog.Action>
				</form>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
</div>
