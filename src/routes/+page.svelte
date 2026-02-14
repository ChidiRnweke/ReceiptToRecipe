<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import {
		ChefHat,
		ShoppingCart,
		Plus,
		Check,
		Upload,
		Sparkles,
		Lightbulb,
		Clock,
		CheckCircle,
		Loader2,
		XCircle,
		Store
	} from 'lucide-svelte';
	import PinnedNote from '$lib/components/PinnedNote.svelte';
	import Notepad from '$lib/components/Notepad.svelte';
	import StockBadge from '$lib/components/StockBadge.svelte';
	import OnboardingModal from '$lib/components/OnboardingModal.svelte';
	import LandingPage from '$lib/components/LandingPage.svelte';
	import { workflowStore } from '$lib/state/workflow.svelte';

	let { data, form } = $props();

	// Time-based greeting
	const hour = new Date().getHours();
	const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

	// Friendly prompts
	const mealSuggestion =
		hour < 11
			? 'Planning breakfast or prepping for dinner?'
			: hour < 15
				? "Time to think about lunch or tonight's dinner!"
				: hour < 19
					? "What's cooking for dinner tonight?"
					: 'Late night snack ideas, anyone?';

	const tips = [
		'Salt your pasta water until it tastes like the sea.',
		'Let meat rest after cooking for juicier results.',
		'Fresh herbs go in at the end, dried herbs at the start.',
		'A squeeze of lemon brightens almost any dish.',
		'Room temperature eggs blend better in baking.'
	];
	const randomTip = tips[Math.floor(Math.random() * tips.length)];

	const featuredRecipe = $derived(data.recentRecipes?.[0]);
	const recipeFeed = $derived(data.recentRecipes ?? []);
	const recentReceipts = $derived(data.recentReceipts ?? []);

	// Use $derived for state but allow overrides
	let pantryItems = $derived(data.pantry ?? []);
	let shoppingListNames = $derived(new Set(data.activeList?.items?.map((i: any) => i.name) ?? []));

	// Ingredients Logic - use actual recipe ingredients when available
	const ingredientList = $derived.by<any[]>(() => {
		if (
			featuredRecipe &&
			'ingredients' in featuredRecipe &&
			Array.isArray(featuredRecipe.ingredients) &&
			featuredRecipe.ingredients.length > 0
		) {
			return featuredRecipe.ingredients.map((ing: any) => {
				// Simple fuzzy match for pantry status
				const pantryMatch = pantryItems.find(
					(p) =>
						p.itemName.toLowerCase().includes(ing.name.toLowerCase()) ||
						ing.name.toLowerCase().includes(p.itemName.toLowerCase())
				);
				return {
					name: ing.name,
					quantity: ing.quantity,
					unit: ing.unit,
					note: ing.notes || (ing.optional ? 'optional' : undefined),
					pantryMatch
				};
			});
		}
		// Only show placeholder when there are no recipes
		return [
			{
				name: 'Generate a recipe to see ingredients',
				note: 'Ingredients will appear here'
			}
		];
	});

	const pantryList = $derived(pantryItems);

	let flashIngredient = $state<string | null>(null);
	let cartOpen = $state(false);
	let showAllIngredients = $state(false);
	let addingIngredient = $state<string | null>(null);

	const shoppingPreview = $derived(data.suggestions ?? []);
	const cartCount = $derived(workflowStore.shoppingItems);
	const visibleIngredients = $derived.by(() =>
		showAllIngredients ? ingredientList : ingredientList.slice(0, 6)
	);

	function formatIngredientDisplay(ing: any): string {
		const name = ing.name || ing.itemName;
		if (ing.quantity && ing.unit) {
			return `${ing.quantity} ${ing.unit} ${name}`;
		}
		if (ing.quantity) {
			return `${ing.quantity} ${name}`;
		}
		return name;
	}

	function getStatusIcon(status: string) {
		switch (status) {
			case 'DONE':
				return CheckCircle;
			case 'PROCESSING':
				return Loader2;
			case 'QUEUED':
				return Clock;
			case 'FAILED':
				return XCircle;
			default:
				return Clock;
		}
	}

	function getStatusLabel(status: string) {
		switch (status) {
			case 'DONE':
				return 'Ready';
			case 'PROCESSING':
				return 'Processing';
			case 'QUEUED':
				return 'Queued';
			case 'FAILED':
				return 'Failed';
			default:
				return status;
		}
	}
</script>

<svelte:head>
	<title>Receipt2Recipe - Transform Groceries into Meals</title>
</svelte:head>

{#if data.user}
	<!-- Onboarding Modal for new users -->
	<OnboardingModal
		receiptCount={data.metrics?.receipts ?? 0}
		recipeCount={data.metrics?.recipes ?? 0}
	/>

	<div
		class="paper-card relative flex min-h-screen gap-0 rounded-4xl border border-sand bg-bg-paper shadow-[0_30px_80px_-50px_rgba(45,55,72,0.6)]"
	>
		<div
			class="pointer-events-none absolute inset-0 rounded-4xl bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.08),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.08),transparent_28%)]"
		></div>

		<aside
			class="hidden h-full w-[320px] shrink-0 rounded-tl-4xl rounded-bl-4xl border-r border-sand bg-bg-paper-dark/80 px-6 py-6 backdrop-blur-sm lg:block"
		>
			<div class="flex h-full flex-col gap-6">
				<div class="space-y-6">
					<div class="flex items-center gap-2 text-xs tracking-[0.18em] text-ink-muted uppercase">
						<span>{greeting}, {data.user.name?.split(' ')[0] || 'chef'}</span>
					</div>

					<PinnedNote>
						<div class="flex items-start gap-3">
							<div class="mt-0.5 text-amber-600">
								<Lightbulb class="h-4 w-4" />
							</div>
							<div>
								<p class="font-hand text-sm leading-snug text-ink/80">
									{randomTip}
								</p>
							</div>
						</div>
					</PinnedNote>

					<Notepad>
						<div class="border-b border-dashed border-border p-5">
							<div class="mb-3 flex items-center justify-between">
								<div class="flex items-center gap-3">
									<h3 class="font-display text-lg text-ink">Scan & Sort</h3>

									<div
										class="mt-1 flex flex-col gap-px opacity-40 mix-blend-multiply select-none"
										aria-hidden="true"
									>
										<div
											class="h-3 w-8"
											style="background: linear-gradient(to right, #000 1px, transparent 1px, transparent 3px, #000 3px, #000 4px, transparent 4px, transparent 6px, #000 6px, #000 9px, transparent 9px, transparent 10px, #000 10px, #000 12px, transparent 12px, transparent 14px, #000 14px, #000 15px, transparent 15px, transparent 18px, #000 18px);"
										></div>
										<div
											class="font-ui text-center text-[5px] leading-none tracking-widest text-black/60"
										>
											8401
										</div>
									</div>
								</div>

								<div
									class="flex h-8 w-8 items-center justify-center rounded-lg bg-sage-50 text-sage-600"
								>
									<Upload class="h-4 w-4" />
								</div>
							</div>

							<div class="grid grid-cols-1 gap-2">
								<Button
									href="/receipts/upload"
									size="sm"
									class="w-full bg-sage-600 text-white shadow-sm hover:bg-sage-500"
								>
									Drop receipt
								</Button>
							</div>
						</div>

						<div class="p-2">
							<a
								href="/shopping"
								class="flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors hover:bg-bg-hover"
							>
								<div>
									<p class="text-[10px] tracking-wider text-ink-muted uppercase">Shopping List</p>
									<p class="font-display text-xl text-ink">
										{cartCount} items
									</p>
									{#if data.activeList?.stats}
										<div class="mt-1 flex items-center gap-2">
											<div class="h-1.5 w-16 rounded-full bg-border">
												<div
													class="h-1.5 rounded-full bg-primary-500 transition-all"
													style="width: {data.activeList.stats.completionPercent}%"
												></div>
											</div>
											<span class="text-[10px] text-ink-muted">
												{data.activeList.stats.completionPercent}%
											</span>
										</div>
									{/if}
								</div>
								<ShoppingCart class="h-5 w-5 text-sage-600" />
							</a>
						</div>
					</Notepad>
				</div>

				{#if pantryList.length > 0}
					<div
						class="mb-4 rotate-1 rounded-xl border border-sand/60 bg-bg-card p-4 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)]"
					>
						<div
							class="mb-2 flex items-center gap-2 border-b border-sand/40 pb-2 text-xs tracking-wider text-text-muted uppercase"
						>
							<Store class="h-3 w-3" /> Your Kitchen
						</div>
						<ul
							class="max-h-40 space-y-2 overflow-y-auto [-ms-overflow-style:'none'] [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden"
						>
							{#each pantryList as item}
								<li class="flex items-center justify-between text-sm text-text-secondary">
									<span class="truncate">{item.itemName}</span>
									{#if item.stockConfidence}
										<StockBadge
											confidence={item.stockConfidence}
											className="scale-75 origin-right"
										/>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</aside>

		<main
			class="relative z-10 flex flex-1 flex-col rounded-4xl bg-white lg:rounded-l-none lg:rounded-r-4xl"
		>
			<div class="mx-auto w-full max-w-5xl px-6 py-6 sm:px-10">
				<div class="mb-8 flex flex-wrap items-end justify-between gap-4">
					<div>
						<p class="font-hand mb-1 text-lg text-ink-light">
							{mealSuggestion}
						</p>
						{#if pantryItems.length === 0}
							<h1
								class="font-display text-3xl leading-[1.1] text-ink drop-shadow-[0_1px_0_rgba(255,255,255,0.8)] md:text-4xl"
							>
								Start by <span class="marker-highlight">dropping a receipt</span>.
							</h1>
						{:else}
							<h1
								class="font-display text-3xl leading-[1.1] text-ink drop-shadow-[0_1px_0_rgba(255,255,255,0.8)] md:text-4xl"
							>
								What are we <span class="marker-highlight">cooking</span> today?
							</h1>
						{/if}
						<div
							class="font-ui mt-4 flex items-center gap-2 text-[10px] tracking-widest text-text-muted uppercase"
						>
							<span
								class={pantryItems.length === 0
									? 'border-b-2 border-primary-200 font-bold text-primary-600'
									: ''}>1. Scan</span
							>
							<span class="text-border">→</span>
							<span
								class={pantryItems.length > 0
									? 'border-b-2 border-primary-200 font-bold text-primary-600'
									: ''}>2. Stock</span
							>
							<span class="text-border">→</span>
							<span>3. Cook</span>
							<span class="text-border">→</span>
							<span>4. Shop</span>
						</div>
					</div>
					<Button
						href="/recipes/generate"
						class="group relative h-10 overflow-hidden rounded-lg border border-primary-300 bg-bg-input px-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-400 hover:bg-bg-paper-dark hover:shadow-md active:scale-95"
					>
						<div class="flex items-center gap-2">
							<Sparkles
								class="h-4 w-4 text-primary-600 transition-transform duration-500 group-hover:rotate-12 group-hover:text-primary-700"
							/>
							<span class="font-display text-base font-medium text-text-primary"
								>Generate New Recipe</span
							>
						</div>
					</Button>
				</div>

				<!-- Mobile Summary Section -->

				<div class="order-last grid items-stretch gap-8 lg:order-none lg:grid-cols-12">
					<div class="lg:col-span-7">
						<a
							href={featuredRecipe ? `/recipes/${featuredRecipe.id}` : '/recipes'}
							class="group relative flex h-full flex-col overflow-hidden rounded-l-md rounded-r-2xl border border-border bg-bg-paper shadow-[2px_3px_10px_rgba(0,0,0,0.03)] transition-all hover:-translate-y-0.5 hover:shadow-md md:flex-row"
						>
							<div
								class="pointer-events-none absolute top-0 bottom-0 left-0 z-10 hidden w-12 bg-linear-to-r from-border/40 to-transparent md:block"
							></div>

							<div
								class="absolute -top-1 right-6 z-20 h-16 w-8 drop-shadow-sm transition-transform duration-300 group-hover:-translate-y-2"
							>
								<div
									class="h-full w-full bg-red-700"
									style="clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%);"
								></div>
								<div
									class="absolute inset-x-1 top-0 bottom-4 border-r border-l border-dashed border-white/20"
								></div>
							</div>

							<div class="relative h-40 w-full p-5 pr-2 md:h-auto md:w-5/12">
								<div
									class="relative h-full w-full -rotate-1 transform transition-transform duration-500 group-hover:rotate-0"
								>
									<div
										class="absolute -top-2 left-1/2 z-20 h-6 w-16 -translate-x-1/2 -rotate-2 bg-amber-100/40 backdrop-blur-[1px]"
										style="mask-image: url('data:image/svg+xml;utf8,<svg width=\'100%\' height=\'100%\' xmlns=\'http://www.w3.org/2000/svg\'><rect x=\'0\' y=\'0\' width=\'100%\' height=\'100%\' fill=\'black\'/></svg>'); box-shadow: 0 1px 2px rgba(0,0,0,0.1);"
									></div>
									<div
										class="absolute -top-2 left-1/2 z-20 h-6 w-16 -translate-x-1/2 -rotate-2 bg-border opacity-20 mix-blend-multiply shadow-sm"
									></div>

									<div
										class="h-full w-full overflow-hidden rounded-[2px] border border-border bg-bg-input p-1.5 shadow-sm"
									>
										{#if featuredRecipe?.imageUrl}
											<img
												src={featuredRecipe.imageUrl}
												alt={featuredRecipe.title}
												class="h-full w-full object-cover transition duration-700 group-hover:scale-105"
											/>
										{:else}
											<div class="flex h-full w-full items-center justify-center bg-bg-paper-dark">
												<ChefHat class="h-8 w-8 text-border" />
											</div>
										{/if}
										<div
											class="pointer-events-none absolute inset-0 bg-linear-to-tr from-white/20 to-transparent opacity-50"
										></div>
									</div>
								</div>
							</div>

							<div
								class="relative flex w-full flex-col justify-center p-6 md:w-7/12 md:p-8 md:pl-6"
							>
								<div
									class="font-ui mb-3 flex items-center gap-2 text-[10px] tracking-widest text-text-muted uppercase"
								>
									<span>Chapter 3: Fresh Pulls</span>
								</div>

								<h3
									class="font-display text-3xl leading-tight text-text-primary decoration-border decoration-2 underline-offset-4 group-hover:underline"
								>
									{featuredRecipe?.title || 'Seasonal Supper'}
								</h3>

								<div class="mt-4 flex items-center gap-4 text-xs font-medium text-text-secondary">
									<span class="flex items-center gap-1.5"
										><Clock class="h-3.5 w-3.5 text-text-muted" /> 25 min</span
									>
									<span class="h-1 w-1 rounded-full bg-border"></span>
									<span>{featuredRecipe?.servings || 2} servings</span>
								</div>

								<p
									class="font-body mt-4 line-clamp-2 text-sm leading-relaxed text-text-secondary italic"
								>
									"{featuredRecipe?.description ||
										"Pull a receipt and we'll turn it into a warm, camera-ready dinner."}"
								</p>

								<div class="font-ui absolute right-6 bottom-4 text-[10px] text-border">p. 14</div>
							</div>
						</a>
					</div>

					<div class="lg:col-span-5">
						<Card.Root
							class="relative mx-auto flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-bg-card shadow-[2px_3px_5px_rgba(0,0,0,0.05)]"
							style="border-radius: 4px 16px 16px 4px;"
						>
							<div
								class="flex shrink-0 items-center justify-between border-b border-border bg-bg-elevated px-6 py-4"
							>
								<span class="font-ui text-[10px] tracking-[0.2em] text-text-muted uppercase"
									>Mise en place</span
								>
								<div class="flex gap-1">
									<div class="h-1.5 w-1.5 rounded-full bg-border"></div>
									<div class="h-1.5 w-1.5 rounded-full bg-border"></div>
									<div class="h-1.5 w-1.5 rounded-full bg-border"></div>
								</div>
							</div>

							<Card.Content class="relative flex-1 p-0">
								<div
									class="absolute top-0 bottom-0 left-8 z-0 h-full w-px border-r border-red-200/60"
								></div>

								<div
									class={`relative z-10 h-full max-h-80 space-y-0 overflow-y-auto pt-2 [-ms-overflow-style:'none'] [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden`}
								>
									{#each visibleIngredients as ingredient}
										{@const itemName = ingredient.name}
										{@const ingredientDisplay = formatIngredientDisplay(ingredient)}
										{@const isAdded = shoppingListNames.has(ingredientDisplay)}
										{@const isAdding = addingIngredient === ingredientDisplay}
										{@const inPantry =
											!!ingredient.pantryMatch && ingredient.pantryMatch.stockConfidence > 0.3}

										<form
											method="POST"
											action="?/toggleIngredient"
											use:enhance={() => {
												addingIngredient = ingredientDisplay;
												// Optimistic update
												const newSet = new Set(shoppingListNames);
												if (isAdded) {
													newSet.delete(ingredientDisplay);
													workflowStore.decrementShopping();
												} else {
													newSet.add(ingredientDisplay);
													workflowStore.incrementShopping();
												}
												shoppingListNames = newSet;

												return async ({ result }) => {
													addingIngredient = null;
													if (result.type !== 'success') {
														// Rollback on error
														const revertSet = new Set(shoppingListNames);
														if (isAdded) {
															revertSet.add(ingredientDisplay);
															workflowStore.incrementShopping();
														} else {
															revertSet.delete(ingredientDisplay);
															workflowStore.decrementShopping();
														}
														shoppingListNames = revertSet;
													}
												};
											}}
											class={`group relative flex w-full items-start gap-4 px-4 py-3 text-left transition-colors duration-200 ${isAdded ? 'bg-secondary-50/40' : inPantry ? 'bg-success-50/40' : 'hover:bg-info-50/30'}`}
										>
											<input type="hidden" name="ingredientName" value={ingredientDisplay} />
											<div
												class="border-info-200/30 absolute right-0 bottom-0 left-0 border-b"
											></div>

											{#if inPantry}
												<div
													class="relative z-20 mt-0.5 flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
													title="In your kitchen"
												>
													<Check class="h-3 w-3" />
												</div>
											{:else}
												<Button
													type="submit"
													variant="ghost"
													size="icon"
													disabled={isAdding}
													class="relative z-20 mt-0.5 h-5 w-5 shrink-0 rounded-full border transition-colors hover:bg-transparent disabled:cursor-not-allowed
                            {isAdded
														? 'border-secondary-200 bg-secondary-100 text-secondary-700 hover:bg-secondary-200 hover:text-secondary-700'
														: 'border-border bg-bg-input hover:border-border hover:text-text-muted'}"
													title={isAdded ? 'Remove from list' : 'Add to shopping list'}
												>
													{#if isAdded}
														<Check class="h-3 w-3" />
													{:else if isAdding}
														<Loader2 class="h-3 w-3 animate-spin text-sage-500" />
													{:else}
														<Plus class="h-3 w-3 text-text-muted" />
													{/if}
												</Button>
											{/if}

											<div class="font-ui flex-1 pl-2 text-sm leading-snug">
												<div class="flex items-center justify-between">
													<p
														class={`transition-all ${isAdded ? 'text-secondary-800/70 line-through decoration-secondary-300' : inPantry ? 'text-success-800/70 decoration-success-300 line-through' : 'text-text-secondary'}`}
													>
														{ingredientDisplay}
													</p>
													{#if inPantry && ingredient.pantryMatch?.stockConfidence}
														<StockBadge confidence={ingredient.pantryMatch.stockConfidence} />
													{/if}
												</div>
												{#if ingredient.note}
													<p class="mt-0.5 text-[10px] text-text-muted italic">
														{ingredient.note}
													</p>
												{:else if inPantry && ingredient.pantryMatch?.lastPurchased}
													<p class="mt-0.5 text-[10px] text-text-muted italic">
														In stock (bought {new Date(
															ingredient.pantryMatch.lastPurchased
														).toLocaleDateString()})
													</p>
												{/if}
											</div>
										</form>
									{/each}

									{#if visibleIngredients.length < 6}
										{#each Array(6 - visibleIngredients.length) as _}
											<div class="relative h-12 w-full">
												<div
													class="border-info-200/30 absolute right-0 bottom-0 left-0 border-b"
												></div>
											</div>
										{/each}
									{/if}
									<div class="h-12"></div>
								</div>

								<div
									class="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-linear-to-t from-bg-card to-transparent"
								></div>

								{#if ingredientList.length > 6}
									<div class="absolute right-0 bottom-4 left-0 z-30 flex justify-center">
										<Button
											variant="outline"
											size="sm"
											onclick={() => (showAllIngredients = !showAllIngredients)}
											class="h-auto rounded-full border-border bg-bg-input px-4 py-1.5 text-[10px] font-bold tracking-wider text-text-muted uppercase shadow-sm hover:bg-bg-hover hover:text-text-secondary"
										>
											{showAllIngredients ? 'Fold Page' : 'View Full List'}
										</Button>
									</div>
								{/if}
							</Card.Content>
						</Card.Root>
					</div>
				</div>

				<div class="order-first mt-8 lg:order-none lg:mt-16">
					<div class="mb-6 flex items-baseline justify-between border-b border-border pb-2">
						<h2 class="font-display text-2xl text-text-primary">Recent Collections</h2>
						<a
							href="/recipes"
							class="text-xs font-medium tracking-wider text-primary-600 uppercase hover:text-primary-800 hover:underline"
							>To your cookbook</a
						>
					</div>

					<div class="columns-1 gap-6 [column-fill:balance] md:columns-2 lg:columns-3">
						{#if recipeFeed.length}
							{#each recipeFeed as recipe (recipe.id)}
								<a
									href={`/recipes/${recipe.id}`}
									class="group relative mb-8 block break-inside-avoid"
								>
									<div
										class="
                    /* The Physical 'Hard' Shadow
                    */ relative
                    overflow-hidden rounded-xl border border-border bg-bg-paper p-3
                    shadow-[2px_2px_0_rgba(0,0,0,0.05)]
                    transition-all duration-200 ease-out
                    group-hover:-translate-y-1 group-hover:border-border group-hover:shadow-[4px_4px_0_rgba(0,0,0,0.05)]
                  "
									>
										<div
											class="relative aspect-video overflow-hidden rounded-lg border border-black/5 bg-bg-paper-dark"
										>
											{#if recipe.imageUrl}
												<img
													src={recipe.imageUrl}
													alt={recipe.title}
													class="h-full w-full object-cover transition duration-500 group-hover:scale-105 group-hover:brightness-110"
												/>
											{:else}
												<div
													class="flex h-full w-full items-center justify-center bg-bg-paper-dark"
												>
													<ChefHat class="h-6 w-6 text-border" />
												</div>
											{/if}

											<div
												class="absolute inset-0 bg-linear-to-tr from-black/20 to-transparent opacity-60 transition-opacity group-hover:opacity-40"
											></div>

											<div
												class="font-ui absolute top-2 right-2 rounded-md bg-bg-input/90 px-1.5 py-0.5 text-[10px] tracking-widest text-text-muted shadow-sm backdrop-blur-sm"
											>
												{new Date()
													.toLocaleDateString('en-US', {
														month: 'short',
														day: 'numeric'
													})
													.toUpperCase()}
											</div>
										</div>

										<div class="px-1 pt-4 pb-2">
											<h3
												class="font-display text-xl leading-tight text-text-primary decoration-border underline-offset-4 group-hover:underline"
											>
												{recipe.title}
											</h3>

											<div class="mt-3 flex flex-wrap gap-2">
												{#if recipe.cuisineType}
													<span
														class="
                                    font-ui inline-flex items-center rounded border border-border bg-bg-paper-dark px-1.5
                                    py-0.5 text-[10px] tracking-wide text-text-muted uppercase
                                "
													>
														{recipe.cuisineType}
													</span>
												{/if}
												<span
													class="
                                font-ui inline-flex items-center rounded border border-border bg-bg-paper-dark px-1.5
                                py-0.5 text-[10px] tracking-wide text-text-muted uppercase
                             "
												>
													{recipe.servings} SERV
												</span>
											</div>
										</div>
									</div>
								</a>
							{/each}
						{:else}
							<div
								class="col-span-full rounded-xl border border-dashed border-border bg-bg-paper-dark/50 py-12 text-center"
							>
								<p class="font-hand text-lg text-text-muted">
									Your cookbook is waiting for its first entry.
								</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</main>
	</div>
{:else}
	<LandingPage />
{/if}
