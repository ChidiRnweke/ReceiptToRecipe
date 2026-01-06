<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Settings, X, Plus, AlertTriangle, Utensils, Globe, Ban, Flame } from 'lucide-svelte';

	let { data, form } = $props();
	let loading = $state(false);

	// Initialize from existing preferences
	let allergies = $state<string[]>(data.preferences?.allergies || []);
	let dietaryRestrictions = $state<string[]>(data.preferences?.dietaryRestrictions || []);
	let cuisinePreferences = $state<string[]>(data.preferences?.cuisinePreferences || []);
	let excludedIngredients = $state<string[]>(data.preferences?.excludedIngredients || []);
	let caloricGoal = $state<number | null>(data.preferences?.caloricGoal || null);
	let defaultServings = $state<number>(data.preferences?.defaultServings || 2);

	// Input fields for adding new items
	let newAllergy = $state('');
	let newDietaryRestriction = $state('');
	let newCuisine = $state('');
	let newExcludedIngredient = $state('');

	// Common options for quick selection
	const commonAllergies = ['Peanuts', 'Tree nuts', 'Milk', 'Eggs', 'Wheat', 'Soy', 'Fish', 'Shellfish', 'Sesame'];
	const commonDiets = ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Keto', 'Paleo', 'Low-carb', 'Low-sodium', 'Halal', 'Kosher'];
	const commonCuisines = ['Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian', 'Thai', 'Mediterranean', 'American', 'French', 'Korean'];

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
</script>

<svelte:head>
	<title>Preferences - Receipt2Recipe</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<div>
		<h1 class="font-serif text-3xl font-medium text-ink">Preferences</h1>
		<p class="mt-1 text-ink-light">Customize your recipe recommendations</p>
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
		class="space-y-6"
	>
		{#if form?.success}
			<div class="rounded-lg bg-sage-50 p-3 text-sm text-sage-700">
				Your preferences have been saved successfully!
			</div>
		{/if}

		{#if form?.error}
			<div class="rounded-lg bg-sienna-50 p-3 text-sm text-sienna-700">
				{form.error}
			</div>
		{/if}

		<!-- Allergies -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<AlertTriangle class="h-5 w-5 text-sienna-600" />
					Allergies
				</Card.Title>
				<Card.Description>
					Recipes will avoid these allergens for your safety
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex flex-wrap gap-2">
					{#each commonAllergies as allergy}
						<button
							type="button"
							onclick={() => toggleItem(allergies, allergy, (v) => (allergies = v))}
							class="rounded-full border px-3 py-1 text-sm transition-colors {allergies.includes(allergy)
								? 'border-sienna-500 bg-sienna-100 text-sienna-700'
								: 'border-sand bg-paper hover:border-sienna-400'}"
						>
							{allergy}
						</button>
					{/each}
				</div>

				<div class="flex gap-2">
					<Input
						type="text"
						placeholder="Add custom allergy..."
						bind:value={newAllergy}
						onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addAllergy())}
					/>
					<Button type="button" variant="outline" onclick={addAllergy}>
						<Plus class="h-4 w-4" />
					</Button>
				</div>

				{#if allergies.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each allergies as allergy, i}
							{#if !commonAllergies.includes(allergy)}
								<Badge variant="destructive" class="gap-1">
									{allergy}
									<button type="button" onclick={() => removeItem(allergies, i, (v) => (allergies = v))}>
										<X class="h-3 w-3" />
									</button>
								</Badge>
							{/if}
						{/each}
					</div>
				{/if}

				<input type="hidden" name="allergies" value={allergies.join(',')} />
			</Card.Content>
		</Card.Root>

		<!-- Dietary Restrictions -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Utensils class="h-5 w-5 text-sage-600" />
					Dietary Restrictions
				</Card.Title>
				<Card.Description>
					Recipes will follow these dietary guidelines
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex flex-wrap gap-2">
					{#each commonDiets as diet}
						<button
							type="button"
							onclick={() => toggleItem(dietaryRestrictions, diet, (v) => (dietaryRestrictions = v))}
							class="rounded-full border px-3 py-1 text-sm transition-colors {dietaryRestrictions.includes(diet)
								? 'border-sage-500 bg-sage-100 text-sage-700'
								: 'border-sand bg-paper hover:border-sage-400'}"
						>
							{diet}
						</button>
					{/each}
				</div>

				<div class="flex gap-2">
					<Input
						type="text"
						placeholder="Add custom dietary restriction..."
						bind:value={newDietaryRestriction}
						onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addDietaryRestriction())}
					/>
					<Button type="button" variant="outline" onclick={addDietaryRestriction}>
						<Plus class="h-4 w-4" />
					</Button>
				</div>

				{#if dietaryRestrictions.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each dietaryRestrictions as diet, i}
							{#if !commonDiets.includes(diet)}
								<Badge variant="secondary" class="gap-1">
									{diet}
									<button type="button" onclick={() => removeItem(dietaryRestrictions, i, (v) => (dietaryRestrictions = v))}>
										<X class="h-3 w-3" />
									</button>
								</Badge>
							{/if}
						{/each}
					</div>
				{/if}

				<input type="hidden" name="dietaryRestrictions" value={dietaryRestrictions.join(',')} />
			</Card.Content>
		</Card.Root>

		<!-- Cuisine Preferences -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Globe class="h-5 w-5 text-sage-600" />
					Cuisine Preferences
				</Card.Title>
				<Card.Description>
					Recipes will favor these cuisines when possible
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex flex-wrap gap-2">
					{#each commonCuisines as cuisine}
						<button
							type="button"
							onclick={() => toggleItem(cuisinePreferences, cuisine, (v) => (cuisinePreferences = v))}
							class="rounded-full border px-3 py-1 text-sm transition-colors {cuisinePreferences.includes(cuisine)
								? 'border-sage-500 bg-sage-100 text-sage-700'
								: 'border-sand bg-paper hover:border-sage-400'}"
						>
							{cuisine}
						</button>
					{/each}
				</div>

				<div class="flex gap-2">
					<Input
						type="text"
						placeholder="Add custom cuisine..."
						bind:value={newCuisine}
						onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addCuisine())}
					/>
					<Button type="button" variant="outline" onclick={addCuisine}>
						<Plus class="h-4 w-4" />
					</Button>
				</div>

				{#if cuisinePreferences.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each cuisinePreferences as cuisine, i}
							{#if !commonCuisines.includes(cuisine)}
								<Badge variant="outline" class="gap-1">
									{cuisine}
									<button type="button" onclick={() => removeItem(cuisinePreferences, i, (v) => (cuisinePreferences = v))}>
										<X class="h-3 w-3" />
									</button>
								</Badge>
							{/if}
						{/each}
					</div>
				{/if}

				<input type="hidden" name="cuisinePreferences" value={cuisinePreferences.join(',')} />
			</Card.Content>
		</Card.Root>

		<!-- Excluded Ingredients -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Ban class="h-5 w-5 text-ink-light" />
					Excluded Ingredients
				</Card.Title>
				<Card.Description>
					Ingredients you don't want in your recipes (dislikes, not allergies)
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex gap-2">
					<Input
						type="text"
						placeholder="e.g., cilantro, olives, anchovies..."
						bind:value={newExcludedIngredient}
						onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addExcludedIngredient())}
					/>
					<Button type="button" variant="outline" onclick={addExcludedIngredient}>
						<Plus class="h-4 w-4" />
					</Button>
				</div>

				{#if excludedIngredients.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each excludedIngredients as ingredient, i}
							<Badge variant="outline" class="gap-1">
								{ingredient}
								<button type="button" onclick={() => removeItem(excludedIngredients, i, (v) => (excludedIngredients = v))}>
									<X class="h-3 w-3" />
								</button>
							</Badge>
						{/each}
					</div>
				{/if}

				<input type="hidden" name="excludedIngredients" value={excludedIngredients.join(',')} />
			</Card.Content>
		</Card.Root>

		<!-- Nutrition & Servings -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Flame class="h-5 w-5 text-sienna-500" />
					Nutrition & Servings
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="caloricGoal">Daily Caloric Goal (optional)</Label>
						<Input
							id="caloricGoal"
							name="caloricGoal"
							type="number"
							min="500"
							max="10000"
							placeholder="e.g., 2000"
							bind:value={caloricGoal}
						/>
						<p class="text-xs text-ink-muted">Recipes will aim for ~1/3 of this per meal</p>
					</div>
					<div class="space-y-2">
						<Label for="defaultServings">Default Servings</Label>
						<Input
							id="defaultServings"
							name="defaultServings"
							type="number"
							min="1"
							max="20"
							bind:value={defaultServings}
						/>
						<p class="text-xs text-ink-muted">Default number of servings for generated recipes</p>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Submit -->
		<div class="flex gap-3">
			<Button type="button" variant="outline" href="/" class="flex-1">Cancel</Button>
			<Button type="submit" disabled={loading} class="flex-1">
				{#if loading}
					Saving...
				{:else}
					<Settings class="mr-2 h-4 w-4" />
					Save Preferences
				{/if}
			</Button>
		</div>
	</form>
</div>
