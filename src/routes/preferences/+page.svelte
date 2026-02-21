<script lang="ts">
	import { enhance } from '$app/forms';
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import IconButton from '$lib/components/ui/icon-button/IconButton.svelte';
	import ToggleChip from '$lib/components/ToggleChip.svelte';
	import SubmitButton from '$lib/components/SubmitButton.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Settings,
		X,
		Plus,
		AlertTriangle,
		Utensils,
		Globe,
		Ban,
		Flame,
		Save,
		ArrowLeft,
		RotateCcw
	} from 'lucide-svelte';
	import Notepad from '$lib/components/Notepad.svelte';
	import PinnedNote from '$lib/components/PinnedNote.svelte';
	import WashiTape from '$lib/components/WashiTape.svelte';

	let { data, form } = $props();
	let loading = $state(false);

	// Initialize from existing preferences
	let allergies = $derived<string[]>(data.preferences?.allergies || []);
	let dietaryRestrictions = $derived<string[]>(data.preferences?.dietaryRestrictions || []);
	let cuisinePreferences = $derived<string[]>(data.preferences?.cuisinePreferences || []);
	let excludedIngredients = $derived<string[]>(data.preferences?.excludedIngredients || []);
	let caloricGoal = $derived<number | null>(data.preferences?.caloricGoal || null);
	let defaultServings = $derived<number>(data.preferences?.defaultServings || 2);

	// Input fields for adding new items
	let newAllergy = $state('');
	let newDietaryRestriction = $state('');
	let newCuisine = $state('');
	let newExcludedIngredient = $state('');

	// Common options for quick selection
	const commonAllergies = [
		'Peanuts',
		'Tree nuts',
		'Milk',
		'Eggs',
		'Wheat',
		'Soy',
		'Fish',
		'Shellfish',
		'Sesame'
	];
	const commonDiets = [
		'Vegetarian',
		'Vegan',
		'Gluten-free',
		'Dairy-free',
		'Keto',
		'Paleo',
		'Low-carb',
		'Low-sodium',
		'Halal',
		'Kosher'
	];
	const commonCuisines = [
		'Italian',
		'Mexican',
		'Chinese',
		'Japanese',
		'Indian',
		'Thai',
		'Mediterranean',
		'American',
		'French',
		'Korean'
	];

	const ONBOARDING_STATE_KEY = 'r2r_onboarding_state';

	function addItem(list: string[], item: string, setter: (value: string[]) => void) {
		if (item.trim() && !list.includes(item.trim())) {
			setter([...list, item.trim()]);
		}
	}

	function removeItem(list: string[], index: number, setter: (value: string[]) => void) {
		setter(list.filter((_, i) => i !== index));
	}

	function toggleItem(list: string[], item: string, setter: (value: string[]) => void) {
		if (list.includes(item)) {
			setter(list.filter((i) => i !== item));
		} else {
			setter([...list, item]);
		}
	}

	function addAllergy() {
		addItem(allergies, newAllergy, (v) => (allergies = v));
		newAllergy = '';
	}

	function addDietaryRestriction() {
		addItem(dietaryRestrictions, newDietaryRestriction, (v) => (dietaryRestrictions = v));
		newDietaryRestriction = '';
	}

	function addCuisine() {
		addItem(cuisinePreferences, newCuisine, (v) => (cuisinePreferences = v));
		newCuisine = '';
	}

	function addExcludedIngredient() {
		addItem(excludedIngredients, newExcludedIngredient, (v) => (excludedIngredients = v));
		newExcludedIngredient = '';
	}

	function replayOnboarding() {
		if (!browser) return;
		localStorage.setItem(ONBOARDING_STATE_KEY, 'active');
	}
</script>

<svelte:head>
	<title>Preferences - Receipt2Recipe</title>
</svelte:head>

<div class="font-ui relative min-h-screen overflow-x-hidden bg-bg-paper p-4 md:p-8">
	<!-- Desk Texture -->
	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.08),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.08),transparent_28%)]"
	></div>

	<div class="relative z-10 mx-auto max-w-5xl">
		<div class="mb-8">
			<Button
				href="/"
				variant="ghost"
				class="pl-0 font-serif text-text-muted hover:bg-transparent hover:text-ink"
			>
				<ArrowLeft class="mr-2 h-4 w-4" />
				Back to Kitchen
			</Button>
			<div class="mt-2 flex items-end justify-between">
				<div>
					<h1
						class="font-display text-4xl leading-[0.9] text-ink drop-shadow-[0_1px_0_rgba(255,255,255,0.8)] md:text-5xl"
					>
						Kitchen <span class="marker-highlight">Manifesto</span>
					</h1>
					<p class="mt-3 max-w-2xl font-serif text-lg text-ink-light italic">
						Define the rules of your kitchen. We'll tailor every recipe to match your taste and
						needs.
					</p>
					<div class="mt-4">
						<Button
							href="/?onboarding=1"
							variant="outline"
							onclick={replayOnboarding}
							class="border-sand bg-bg-paper-dark text-ink hover:bg-bg-hover"
						>
							<RotateCcw class="mr-2 h-4 w-4" />
							Replay onboarding tutorial
						</Button>
					</div>
				</div>
			</div>
		</div>

		<form
			method="POST"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					loading = false;
					await update();
				};
			}}
			class="grid items-start gap-8 lg:grid-cols-12"
		>
			<!-- LEFT COLUMN: The Manifesto (Main Settings) -->
			<div class="lg:col-span-8">
				<Notepad class="w-full shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)]">
					<div class="space-y-10 p-4 sm:p-8">
						{#if form?.success}
							<div
								class="font-hand rotate-1 rounded-sm border border-sage-200 bg-sage-50 p-4 text-center text-xl text-sage-800 shadow-sm"
							>
								<span class="font-bold">Update:</span> Preferences saved successfully!
							</div>
						{/if}

						{#if form?.error}
							<div
								class="font-hand -rotate-1 rounded-sm border border-sienna-200 bg-sienna-50 p-4 text-center text-xl text-sienna-800 shadow-sm"
							>
								{form.error}
							</div>
						{/if}

						<!-- 1. Allergies Section -->
						<section>
							<div class="mb-4 flex items-center gap-3 border-b-2 border-text-primary pb-2">
								<AlertTriangle class="h-5 w-5 text-sienna-600" />
								<h2 class="font-hand pt-1 text-3xl font-bold text-ink">Safety First (Allergies)</h2>
							</div>
							<p class="mb-4 font-serif text-sm text-ink-light italic">
								Strictly avoid these ingredients.
							</p>

							<div class="mb-4 flex flex-wrap gap-2">
								{#each commonAllergies as allergy}
									<ToggleChip
										selected={allergies.includes(allergy)}
										label={allergy}
										onToggle={() => toggleItem(allergies, allergy, (v) => (allergies = v))}
									/>
								{/each}
							</div>

							<div class="flex max-w-md gap-2">
								<Input
									type="text"
									placeholder="Add specific allergy..."
									bind:value={newAllergy}
									onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addAllergy())}
									class="rounded-none border-0 border-b border-text-muted bg-transparent px-0 py-1 font-serif placeholder:text-text-muted placeholder:italic focus:border-sienna-500 focus:ring-0"
								/>
								<IconButton
									type="button"
									variant="ghost"
									size="sm"
									icon={Plus}
									onclick={addAllergy}
									class="text-text-muted hover:text-sienna-600"
								/>
							</div>

							{#if allergies.length > 0}
								<div
									class="mt-4 rounded-sm border border-dashed border-sienna-200 bg-sienna-50/50 p-4"
								>
									<h4 class="font-ui mb-2 text-xs tracking-widest text-sienna-700 uppercase">
										Active Allergies:
									</h4>
									<div class="flex flex-wrap gap-2">
										{#each allergies as allergy, i}
											{#if !commonAllergies.includes(allergy)}
												<span
													class="font-ui inline-flex items-center gap-1 rounded-sm border border-sienna-200 bg-white px-2 py-1 text-xs font-bold text-sienna-800 shadow-sm"
												>
													{allergy}
													<IconButton
														type="button"
														variant="ghost"
														size="sm"
														icon={X}
														onclick={() => removeItem(allergies, i, (v) => (allergies = v))}
														class="h-3 w-3 text-sienna-400 hover:text-sienna-900"
													/>
												</span>
											{/if}
										{/each}
									</div>
									<input type="hidden" name="allergies" value={allergies.join(',')} />
								</div>
							{/if}
						</section>

						<!-- 2. Diet Section -->
						<section>
							<div class="mb-4 flex items-center gap-3 border-b-2 border-text-primary pb-2">
								<Utensils class="h-5 w-5 text-sage-600" />
								<h2 class="font-hand pt-1 text-3xl font-bold text-ink">The Rules (Diet)</h2>
							</div>

							<div class="mb-4 flex flex-wrap gap-2">
								{#each commonDiets as diet}
									<ToggleChip
										selected={dietaryRestrictions.includes(diet)}
										label={diet}
										onToggle={() =>
											toggleItem(dietaryRestrictions, diet, (v) => (dietaryRestrictions = v))}
									/>
								{/each}
							</div>

							<div class="flex max-w-md gap-2">
								<Input
									type="text"
									placeholder="Add dietary rule..."
									bind:value={newDietaryRestriction}
									onkeydown={(e) =>
										e.key === 'Enter' && (e.preventDefault(), addDietaryRestriction())}
									class="rounded-none border-0 border-b border-text-muted bg-transparent px-0 py-1 font-serif placeholder:text-text-muted placeholder:italic focus:border-sage-500 focus:ring-0"
								/>
								<IconButton
									type="button"
									variant="ghost"
									size="sm"
									icon={Plus}
									onclick={addDietaryRestriction}
									class="text-text-muted hover:text-sage-600"
								/>
							</div>
							<input
								type="hidden"
								name="dietaryRestrictions"
								value={dietaryRestrictions.join(',')}
							/>
						</section>

						<!-- 3. Cuisines Section -->
						<section>
							<div class="mb-4 flex items-center gap-3 border-b-2 border-text-primary pb-2">
								<Globe class="h-5 w-5 text-ink-muted" />
								<h2 class="font-hand pt-1 text-3xl font-bold text-ink">Flavor Profile</h2>
							</div>
							<p class="mb-4 font-serif text-sm text-ink-light italic">Favor these cuisines.</p>

							<div class="mb-4 flex flex-wrap gap-2">
								{#each commonCuisines as cuisine}
									<ToggleChip
										selected={cuisinePreferences.includes(cuisine)}
										label={cuisine}
										onToggle={() =>
											toggleItem(cuisinePreferences, cuisine, (v) => (cuisinePreferences = v))}
									/>
								{/each}
							</div>

							<div class="flex max-w-md gap-2">
								<Input
									type="text"
									placeholder="Add cuisine..."
									bind:value={newCuisine}
									onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addCuisine())}
									class="rounded-none border-0 border-b border-text-muted bg-transparent px-0 py-1 font-serif placeholder:text-text-muted placeholder:italic focus:border-amber-500 focus:ring-0"
								/>
								<IconButton
									type="button"
									variant="ghost"
									size="sm"
									icon={Plus}
									onclick={addCuisine}
									class="text-text-muted hover:text-amber-600"
								/>
							</div>
							<input type="hidden" name="cuisinePreferences" value={cuisinePreferences.join(',')} />
						</section>

						<div class="flex justify-end pt-8">
							<SubmitButton
								{loading}
								loadingText="Saving..."
								class="font-display h-auto bg-text-primary px-8 py-3 text-lg text-white shadow-md transition-all hover:translate-y-[1px] hover:bg-text-secondary hover:shadow-sm"
							>
								<Save class="mr-2 h-4 w-4" />
								Save Manifesto
							</SubmitButton>
						</div>
					</div>
				</Notepad>
			</div>

			<!-- RIGHT COLUMN: Sticky Notes (Dislikes & Goals) -->
			<div class="space-y-8 lg:col-span-4">
				<!-- Dislikes Note -->
				<PinnedNote color="red" rotate="rotate-2">
					<div class="mb-3 flex items-center gap-2 border-b border-red-200/50 pb-2">
						<Ban class="h-4 w-4 text-text-muted" />
						<h3 class="font-hand text-xl font-bold text-ink/80">The "No-Go" List</h3>
					</div>
					<p class="mb-4 font-serif text-xs leading-relaxed text-ink/70">
						Ingredients to exclude simply because you don't like them (not allergies).
					</p>

					<div class="space-y-2">
						{#each excludedIngredients as ingredient, i}
							<div
								class="flex items-center justify-between rounded-sm border border-blue-100 bg-white/50 px-2 py-1"
							>
								<span class="font-hand text-lg text-ink">{ingredient}</span>
								<IconButton
									type="button"
									variant="ghost"
									size="sm"
									icon={X}
									onclick={() =>
										removeItem(excludedIngredients, i, (v) => (excludedIngredients = v))}
									class="h-3 w-3 text-text-muted hover:text-red-500"
								/>
							</div>
						{/each}
					</div>

					<div class="mt-4 flex gap-2 border-t border-blue-200/50 pt-2">
						<Input
							type="text"
							placeholder="e.g. Cilantro..."
							bind:value={newExcludedIngredient}
							onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addExcludedIngredient())}
							class="h-8 border-blue-200 bg-white/80 text-xs focus:border-blue-400"
						/>
						<IconButton
							type="button"
							variant="ghost"
							size="sm"
							icon={Plus}
							onclick={addExcludedIngredient}
							class="h-8 w-8 bg-blue-200 p-0 text-blue-800 hover:bg-blue-300"
						/>
					</div>
					<input type="hidden" name="excludedIngredients" value={excludedIngredients.join(',')} />
				</PinnedNote>

				<!-- Goals Note -->
				<div
					class="relative -rotate-1 rounded-sm border border-stone-200 bg-white p-6 shadow-[2px_3px_5px_rgba(0,0,0,0.05)]"
				>
					<div class="absolute -top-3 left-1/2 -translate-x-1/2">
						<WashiTape color="yellow" width="w-24" />
					</div>

					<h3
						class="font-ui mt-2 mb-6 text-center text-xs tracking-widest text-text-muted uppercase"
					>
						Kitchen Stats
					</h3>

					<div class="space-y-6">
						<div>
							<Label for="caloricGoal" class="mb-2 flex items-center gap-2 font-serif text-ink">
								<Flame class="h-4 w-4 text-amber-500" />
								Daily Caloric Goal
							</Label>
							<div class="relative">
								<Input
									id="caloricGoal"
									name="caloricGoal"
									type="number"
									min="500"
									max="10000"
									placeholder="e.g., 2000"
									bind:value={caloricGoal}
									class="font-ui border-stone-200 bg-bg-hover text-lg"
								/>
								<span
									class="font-ui absolute top-1/2 right-3 -translate-y-1/2 text-xs text-text-muted"
									>kcal</span
								>
							</div>
						</div>

						<div>
							<Label for="defaultServings" class="mb-2 flex items-center gap-2 font-serif text-ink">
								<Utensils class="h-4 w-4 text-text-muted" />
								Default Servings
							</Label>
							<div class="relative">
								<Input
									id="defaultServings"
									name="defaultServings"
									type="number"
									min="1"
									max="20"
									bind:value={defaultServings}
									class="font-ui border-stone-200 bg-bg-hover text-lg"
								/>
								<span
									class="font-ui absolute top-1/2 right-3 -translate-y-1/2 text-xs text-text-muted"
									>ppl</span
								>
							</div>
						</div>
					</div>
				</div>
			</div>
		</form>
	</div>
</div>
