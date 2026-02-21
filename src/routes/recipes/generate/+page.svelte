<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import Notepad from '$lib/components/Notepad.svelte';
	import StockBadge from '$lib/components/StockBadge.svelte';
	import WashiTape from '$lib/components/WashiTape.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		ChefHat,
		Plus,
		X,
		Sparkles,
		ArrowLeft,
		Receipt,
		Users,
		Globe,
		Utensils
	} from 'lucide-svelte';

	let { data, form } = $props();
	let loading = $state(false);
	let customIngredients = $state<string[]>([]);
	let newIngredient = $state('');
	// Map of pantry item id → item name; lets us submit names (not IDs) so both
	// receipt-sourced and manually-added cupboard items are included.
	let selectedIngredients = $state<Map<string, string>>(new Map());
	let loadingMessage = $state('Consulting Chef...');
	let messageInterval: ReturnType<typeof setInterval> | null = null;
	let pantryInitialized = $state(false);
	let servingsInitialized = $state(false);

	let servings = $state(2);
	let cuisineHint = $state('');

	const vibeOptions = [
		'Quick & Easy',
		'Italian',
		'Asian',
		'Comfort Food',
		'Mediterranean',
		'Spicy',
		'Vegetarian',
		'High Protein'
	];

	$effect(() => {
		if (!servingsInitialized && data.preferences?.defaultServings !== undefined) {
			servings = data.preferences.defaultServings;
			servingsInitialized = true;
		}
	});

	const loadingMessages = [
		'Consulting Chef...',
		'Choosing the perfect ingredients...',
		'Whipping up something delicious...',
		'Adding a pinch of creativity...',
		'Tasting and adjusting flavors...',
		'Plating your masterpiece...',
		'Almost ready to serve...',
		'Final garnish going on...'
	];

	$effect(() => {
		if (loading) {
			let index = 0;
			loadingMessage = loadingMessages[0];
			messageInterval = setInterval(() => {
				index = (index + 1) % loadingMessages.length;
				loadingMessage = loadingMessages[index];
			}, 3000);
		} else {
			if (messageInterval) {
				clearInterval(messageInterval);
				messageInterval = null;
			}
			loadingMessage = loadingMessages[0];
		}

		return () => {
			if (messageInterval) {
				clearInterval(messageInterval);
			}
		};
	});

	function addIngredient() {
		if (newIngredient.trim()) {
			customIngredients = [...customIngredients, newIngredient.trim()];
			newIngredient = '';
		}
	}

	function removeIngredient(index: number) {
		customIngredients = customIngredients.filter((_, i) => i !== index);
	}

	function togglePantryItem(itemId: string, itemName: string) {
		if (selectedIngredients.has(itemId)) {
			selectedIngredients.delete(itemId);
		} else {
			selectedIngredients.set(itemId, itemName);
		}
		selectedIngredients = new Map(selectedIngredients);
	}

	function toggleVibe(vibe: string) {
		cuisineHint = cuisineHint === vibe ? '' : vibe;
	}

	function groupPantry(pantryItems: any[]) {
		const groups: Record<string, any[]> = {};
		for (const item of pantryItems || []) {
			const category = item.category || 'Kitchen Staples';
			const displayCategory = category.charAt(0).toUpperCase() + category.slice(1);
			if (!groups[displayCategory]) groups[displayCategory] = [];
			groups[displayCategory].push(item);
		}
		return groups;
	}

	// Pre-select high-confidence pantry items once the streamed data resolves.
	// Must run in $effect (not a template expression) to avoid state_unsafe_mutation.
	$effect(() => {
		data.streamed.pantry.then((pantryItems: any[]) => {
			if (pantryInitialized) return;
			const newMap = new Map<string, string>();
			pantryItems
				.filter((i: any) => i.stockConfidence > 0.6 && i.id)
				.forEach((i: any) => newMap.set(i.id, i.itemName));
			selectedIngredients = newMap;
			pantryInitialized = true;
		});
	});

	// All ingredient names that will be sent: selected pantry item names + user-typed extras
	const allIngredientNames = $derived([
		...selectedIngredients.values(),
		...customIngredients
	]);
	const totalIngredients = $derived(allIngredientNames.length);
</script>

<svelte:head>
	<title>Generate Recipe - Receipt2Recipe</title>
</svelte:head>

<div class="min-h-screen bg-bg-paper pb-20 font-serif text-ink selection:bg-sage-200">
	<!-- Texture Overlay -->
	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[20px_20px] opacity-30"
	></div>
	<div
		class="pointer-events-none absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] opacity-20 mix-blend-multiply"
	></div>

	<div class="relative mx-auto max-w-6xl px-4 py-8 sm:px-6">
		<Button
			href="/recipes"
			variant="ghost"
			size="sm"
			class="mb-4 text-ink-muted hover:bg-transparent hover:text-ink"
		>
			<ArrowLeft class="mr-1 h-4 w-4" />
			Back to Cookbook
		</Button>
		<div class="mb-8 text-center">
			<h1 class="font-display text-4xl font-medium tracking-tight text-ink md:text-5xl">
				The <span class="marker-highlight">Chef's</span> Canvas
			</h1>
			<p class="font-hand mt-2 -rotate-1 text-xl text-ink-light">
				Let's create something new today.
			</p>
		</div>

		<form
			method="POST"
			id="generate-recipe-form"
			use:enhance={() => {
				loading = true;
				return async ({ result }) => {
					loading = false;
					if (result.type === 'redirect') {
						goto(result.location);
					}
				};
			}}
			class="grid items-start gap-6 pb-32 md:pb-24 lg:grid-cols-12 lg:pb-0"
		>
			<!-- Single hidden input combining pantry selections + user extras -->
			<input type="hidden" name="customIngredients" value={allIngredientNames.join(',')} />

			{#if form?.error}
				<div
					class="col-span-full rounded-lg border border-sienna-100 bg-sienna-50 p-4 text-center text-sm text-sienna-700 shadow-sm"
				>
					{form.error}
				</div>
			{/if}

			<!-- LEFT: Kitchen Inventory -->
			<div class="order-2 lg:order-1 lg:col-span-7 xl:col-span-8">
				<Notepad class="h-full" tapeWidth="w-32" tapeRotate="-rotate-2">
					<div class="bg-lines min-h-96 p-5 md:p-6">
						<div
							class="mb-5 flex items-baseline justify-between border-b-2 border-dashed border-border pb-3"
						>
							<h2 class="font-display text-xl text-ink">Kitchen Inventory</h2>
							<div class="flex items-center gap-3">
								<a
									href="/cupboard"
									class="font-ui text-[10px] tracking-wide text-primary-600 uppercase hover:underline"
								>
									Manage cupboard
								</a>
								<span class="font-ui text-xs tracking-widest text-text-muted uppercase">
									{selectedIngredients.size} selected
								</span>
							</div>
						</div>

						{#await data.streamed.pantry}
							<div class="space-y-5">
								{#each Array(3) as _}
									<div class="space-y-2">
										<Skeleton class="h-5 w-28 bg-stone-200/50" />
										<div class="flex flex-wrap gap-2">
											{#each Array(4) as _}
												<Skeleton class="h-8 w-22 rounded-lg bg-stone-200/50" />
											{/each}
										</div>
									</div>
								{/each}
							</div>
						{:then pantry}
							{@const pantryByCategory = groupPantry(pantry)}

							{#if pantry && pantry.length > 0}
								<div class="space-y-6">
									{#each Object.entries(pantryByCategory) as [category, items]}
										<div>
											<h3 class="mb-2 font-serif text-base text-ink-light italic">{category}</h3>
											<div class="flex flex-wrap gap-2">
												{#each items as item}
													{#if item.id}
														<button
															type="button"
															onclick={() => togglePantryItem(item.id, item.itemName)}
															class="group relative flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-all duration-200
                              {selectedIngredients.has(item.id)
																? 'border-sage-400 bg-sage-50 text-sage-900 shadow-sm'
																: 'border-border bg-white text-text-secondary hover:border-primary-300 hover:shadow-sm'}"
														>
															<div
																class="flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors
                                {selectedIngredients.has(item.id)
																	? 'border-sage-500 bg-sage-500 text-white'
																	: 'border-border group-hover:border-primary-400'}"
															>
																{#if selectedIngredients.has(item.id)}
																	<span class="text-[9px] leading-none">✓</span>
																{/if}
															</div>
															<span class={selectedIngredients.has(item.id) ? 'font-medium' : ''}
																>{item.itemName}</span
															>
															{#if item.stockConfidence}
																<StockBadge
																	confidence={item.stockConfidence}
																	className="scale-75 opacity-70"
																/>
															{/if}
														</button>
													{/if}
												{/each}
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<div class="flex flex-col items-center justify-center py-12 text-center">
									<Receipt class="mb-4 h-10 w-10 text-text-muted" />
									<p class="font-serif text-base text-ink-light">
										The kitchen is looking a bit bare.
									</p>
									<Button
										href="/receipts/upload"
										variant="link"
										class="font-hand text-xl text-sage-600"
									>
										Upload a receipt to stock up →
									</Button>
								</div>
							{/if}
						{/await}
					</div>
				</Notepad>
			</div>

			<!-- RIGHT: Controls -->
			<div class="order-1 space-y-4 lg:sticky lg:top-8 lg:order-2 lg:col-span-5 xl:col-span-4">

				<!-- Vibe / Cuisine — prominent chip selector -->
				<div class="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
					<Label class="mb-3 flex items-center gap-2 font-serif text-base font-semibold text-ink">
						<Globe class="h-4 w-4 text-amber-600" />
						Vibe / Cuisine
					</Label>
					<div class="mb-3 flex flex-wrap gap-2">
						{#each vibeOptions as vibe}
							<button
								type="button"
								onclick={() => toggleVibe(vibe)}
								class="rounded-full border px-3 py-1.5 text-sm font-medium transition-all
									{cuisineHint === vibe
									? 'border-amber-400 bg-amber-400 text-white shadow-sm'
									: 'border-amber-200 bg-white text-ink-light hover:border-amber-300 hover:bg-amber-50'}"
							>
								{vibe}
							</button>
						{/each}
					</div>
					<Input
						id="cuisineHint"
						name="cuisineHint"
						type="text"
						placeholder="or describe your own vibe..."
						bind:value={cuisineHint}
						class="border-amber-200 bg-white/80 text-sm placeholder:text-amber-400/60 focus-visible:border-amber-400 focus-visible:ring-amber-200"
					/>
				</div>

				<!-- Servings -->
				<div class="rounded-xl border border-border bg-white p-4 shadow-sm">
					<Label for="servings" class="mb-2 flex items-center gap-2 font-serif text-base font-semibold text-ink">
						<Users class="h-4 w-4 text-text-muted" />
						Servings
					</Label>
					<div class="flex items-center gap-3">
						<button
							type="button"
							onclick={() => (servings = Math.max(1, servings - 1))}
							class="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-paper-dark text-text-secondary hover:border-primary-300 hover:text-primary-600"
						>
							–
						</button>
						<input type="hidden" name="servings" value={servings} />
						<span class="font-display w-12 text-center text-xl font-medium text-ink"
							>{servings} <span class="text-sm font-normal text-text-muted">ppl</span></span
						>
						<button
							type="button"
							onclick={() => (servings = Math.min(20, servings + 1))}
							class="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-paper-dark text-text-secondary hover:border-primary-300 hover:text-primary-600"
						>
							+
						</button>
					</div>
				</div>

				<!-- Extras & Add-ins -->
				<div class="relative rounded-xl bg-white p-1 shadow-sm">
					<WashiTape
						class="absolute -top-3 left-1/2 -translate-x-1/2"
						width="w-20"
						color="white"
						rotate="rotate-0"
					/>
					<div class="rounded-lg border border-border p-4">
						<div class="mb-3 flex items-center gap-2">
							<Utensils class="h-4 w-4 text-ink-muted" />
							<h3 class="font-serif font-medium text-ink">Extras & Add-ins</h3>
						</div>

						<div class="mb-3 flex gap-2">
							<Input
								type="text"
								placeholder="Add garlic, oil..."
								bind:value={newIngredient}
								onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addIngredient())}
								class="border-border bg-bg-paper-dark focus-visible:ring-primary-400"
							/>
							<Button
								type="button"
								variant="outline"
								size="icon"
								onclick={addIngredient}
								disabled={!newIngredient.trim()}
								class="shrink-0 border-border hover:bg-primary-50 hover:text-primary-600"
							>
								<Plus class="h-4 w-4" />
							</Button>
						</div>

						{#if customIngredients.length > 0}
							<div class="flex flex-wrap gap-2">
								{#each customIngredients as ingredient, i}
									<span
										class="font-hand inline-flex -rotate-1 items-center gap-1 rounded-md border border-yellow-200 bg-yellow-50 px-2 py-1 text-sm text-ink shadow-sm"
									>
										{ingredient}
										<button
											type="button"
											onclick={() => removeIngredient(i)}
											class="text-ink-light hover:text-sienna-600"
										>
											<X class="h-3 w-3" />
										</button>
									</span>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Submit -->
				<div class="pt-2">
					<div
						class="fixed right-0 bottom-0 left-0 z-40 hidden border-t border-border bg-white p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] md:block lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
					>
						<Button
							type="submit"
							disabled={loading || totalIngredients === 0}
							class="h-14 w-full bg-text-primary font-serif text-lg text-bg-paper shadow-xl transition-all hover:-translate-y-0.5 hover:bg-primary-800"
						>
							{#if loading}
								<Sparkles class="mr-2 h-5 w-5 animate-pulse" />
								{loadingMessage}
							{:else}
								<ChefHat class="mr-2 h-5 w-5" />
								Invent Recipe
							{/if}
						</Button>
						<p class="font-hand mt-2 text-center text-sm text-ink-muted">
							{#if totalIngredients > 0}
								Using {totalIngredients} ingredient{totalIngredients === 1 ? '' : 's'}
							{:else}
								Pick something to start...
							{/if}
						</p>
					</div>
				</div>
			</div>
		</form>
	</div>
</div>

<style>
	.bg-lines {
		background-image: linear-gradient(#e5e7eb 1px, transparent 1px);
		background-size: 100% 2rem;
		background-attachment: local;
	}
</style>
