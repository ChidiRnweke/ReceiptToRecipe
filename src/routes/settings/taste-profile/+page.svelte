<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import IconButton from '$lib/components/ui/icon-button/IconButton.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Plus,
		X,
		Heart,
		ThumbsDown,
		AlertTriangle,
		ChefHat,
		Salad,
		Utensils
	} from 'lucide-svelte';
	import Notepad from '$lib/components/Notepad.svelte';
	import PinnedNote from '$lib/components/PinnedNote.svelte';
	import WashiTape from '$lib/components/WashiTape.svelte';

	let { data } = $props();
	let profile = $derived(data.profile);

	let newAllergen = $state('');
	let newIngredient = $state('');
	let ingredientPrefLevel = $state('dislike');

	const commonAllergens = [
		'Peanuts',
		'Tree Nuts',
		'Dairy',
		'Gluten',
		'Shellfish',
		'Eggs',
		'Soy',
		'Sesame'
	];
	const dietTypes = [
		{ value: 'omnivore', label: 'Omnivore', desc: 'No restrictions' },
		{ value: 'vegetarian', label: 'Vegetarian', desc: 'No meat' },
		{ value: 'vegan', label: 'Vegan', desc: 'No animal products' },
		{ value: 'pescatarian', label: 'Pescatarian', desc: 'Fish, no meat' },
		{ value: 'keto', label: 'Keto', desc: 'Low carb, high fat' },
		{ value: 'paleo', label: 'Paleo', desc: 'No grains, dairy, legumes' }
	];
	const cuisines = [
		'Italian',
		'Mexican',
		'Thai',
		'Indian',
		'Japanese',
		'Mediterranean',
		'French',
		'American'
	];

	function getDietLabel(value: string) {
		return dietTypes.find((d) => d.value === value)?.label || value;
	}
</script>

<div class="space-y-10 pb-20">
	<!-- Diet Type -->
	<section>
		<div class="mb-4 flex items-center gap-2">
			<Salad class="h-5 w-5 text-sage-600" />
			<h2 class="font-display text-2xl text-ink">Dietary Lifestyle</h2>
		</div>

		<Notepad class="bg-white/50">
			<div class="p-6">
				<form method="POST" action="?/setDiet" use:enhance>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{#each dietTypes as diet}
							<label
								class="flex cursor-pointer items-start space-x-3 rounded-lg border p-4 transition-colors hover:bg-bg-hover
                                {profile.dietType === diet.value
									? 'border-sage-500 bg-sage-50'
									: 'border-border'}"
							>
								<input
									type="radio"
									name="dietType"
									value={diet.value}
									checked={profile.dietType === diet.value}
									class="mt-1.5 h-4 w-4 border-border text-sage-600 focus:ring-sage-500"
								/>
								<div class="grid gap-1">
									<span class="font-serif text-lg font-medium">{diet.label}</span>
									<span class="font-ui text-xs text-text-muted">{diet.desc}</span>
								</div>
							</label>
						{/each}
					</div>
					<div class="mt-6 flex justify-end">
						<Button type="submit" variant="default" class="bg-text-primary text-white"
							>Save Diet</Button
						>
					</div>
				</form>
			</div>
		</Notepad>
	</section>

	<!-- Allergies -->
	<section>
		<div class="mb-4 flex items-center gap-2">
			<AlertTriangle class="h-5 w-5 text-amber-600" />
			<h2 class="font-display text-2xl text-ink">Allergies & Intolerances</h2>
		</div>

		<div class="relative overflow-hidden rounded-xl border border-border bg-white p-6 shadow-sm">
			<div class="pointer-events-none absolute top-0 right-0 p-4 opacity-10">
				<AlertTriangle class="h-32 w-32" />
			</div>

			<div class="mb-6 flex flex-wrap gap-2">
				{#each profile.allergies as allergy}
					<Badge
						variant={allergy.severity === 'severe' ? 'destructive' : 'secondary'}
						class="gap-1 py-1 pr-1 pl-2 text-sm"
					>
						{allergy.allergen}
						<form method="POST" action="?/removeAllergy" use:enhance class="inline-flex">
							<input type="hidden" name="allergen" value={allergy.allergen} />
							<IconButton
								type="submit"
								size="sm"
								variant="ghost"
								icon={X}
								class="ml-1 h-3 w-3 hover:text-white/80"
							/>
						</form>
					</Badge>
				{/each}
				{#if profile.allergies.length === 0}
					<span class="text-sm text-text-muted italic">No allergies listed.</span>
				{/if}
			</div>

			<div class="max-w-md space-y-4">
				<p class="text-sm font-medium text-ink-light">Add Common Allergens:</p>
				<div class="flex flex-wrap gap-2">
					{#each commonAllergens as ca}
						{#if !profile.allergies.find((a) => a.allergen.toLowerCase() === ca.toLowerCase())}
							<form method="POST" action="?/addAllergy" use:enhance class="inline-block">
								<input type="hidden" name="allergen" value={ca} />
								<Button
									type="submit"
									variant="outline"
									size="sm"
									class="h-auto rounded-full px-3 py-1 text-xs transition-colors hover:border-amber-400 hover:bg-amber-50"
								>
									+ {ca}
								</Button>
							</form>
						{/if}
					{/each}
				</div>

				<div class="border-t border-dashed border-border pt-4">
					<form method="POST" action="?/addAllergy" use:enhance class="flex items-end gap-2">
						<div class="grid flex-1 gap-1.5">
							<Label for="custom-allergen">Custom Allergen</Label>
							<Input
								type="text"
								id="custom-allergen"
								name="allergen"
								placeholder="e.g. Strawberries"
							/>
						</div>
						<div class="grid w-32 gap-1.5">
							<Label for="severity">Severity</Label>
							<select
								name="severity"
								id="severity"
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
							>
								<option value="avoid">Avoid</option>
								<option value="severe">Severe</option>
							</select>
						</div>
						<IconButton type="submit" variant="outline" icon={Plus} />
					</form>
				</div>
			</div>
		</div>
	</section>

	<!-- Ingredients -->
	<section>
		<div class="mb-4 flex items-center gap-2">
			<Utensils class="h-5 w-5 text-ink-muted" />
			<h2 class="font-display text-2xl text-ink">Ingredient Preferences</h2>
		</div>

		<div class="grid gap-6 md:grid-cols-2">
			<!-- Loves -->
			<PinnedNote color="yellow" rotate="-rotate-1">
				<div class="mb-4 flex items-center gap-2 border-b border-amber-200 pb-2">
					<Heart class="h-4 w-4 fill-red-500 text-red-500" />
					<h3 class="font-serif text-lg font-bold">I Love</h3>
				</div>
				<div class="mb-4 flex flex-wrap gap-2">
					{#each profile.ingredientPreferences.filter((p) => p.preference === 'love') as pref}
						<span
							class="inline-flex items-center rounded border border-amber-100 bg-white px-2 py-1 text-sm shadow-sm"
						>
							{pref.ingredientName}
							<form
								method="POST"
								action="?/removeIngredientPref"
								use:enhance
								class="ml-1 inline-flex"
							>
								<input type="hidden" name="ingredient" value={pref.ingredientName} />
								<IconButton
									type="submit"
									size="sm"
									variant="ghost"
									icon={X}
									class="h-3 w-3 text-stone-400 hover:text-red-500"
								/>
							</form>
						</span>
					{/each}
				</div>
				<form method="POST" action="?/setIngredientPref" use:enhance class="flex gap-2">
					<input type="hidden" name="preference" value="love" />
					<Input
						name="ingredient"
						placeholder="Add ingredient..."
						class="h-8 bg-white/80 text-sm"
					/>
					<IconButton type="submit" variant="ghost" size="sm" icon={Plus} class="h-8 w-8" />
				</form>
			</PinnedNote>

			<!-- Dislikes -->
			<div class="relative rotate-1 rounded-xl border border-border bg-bg-card p-6 shadow-sm">
				<div class="absolute -top-3 left-1/2 -translate-x-1/2">
					<WashiTape color="white" width="w-24" />
				</div>
				<div class="mt-2 mb-4 flex items-center gap-2 border-b border-border pb-2">
					<ThumbsDown class="h-4 w-4 text-text-muted" />
					<h3 class="font-serif text-lg font-bold text-text-secondary">I Avoid / Dislike</h3>
				</div>
				<div class="mb-4 flex flex-wrap gap-2">
					{#each profile.ingredientPreferences.filter( (p) => ['dislike', 'avoid'].includes(p.preference) ) as pref}
						<span
							class="inline-flex items-center rounded border border-border bg-white px-2 py-1 text-sm text-text-secondary shadow-sm"
						>
							{pref.ingredientName}
							<form
								method="POST"
								action="?/removeIngredientPref"
								use:enhance
								class="ml-1 inline-flex"
							>
								<input type="hidden" name="ingredient" value={pref.ingredientName} />
								<IconButton
									type="submit"
									variant="ghost"
									size="sm"
									icon={X}
									class="h-3 w-3 text-text-muted hover:text-red-500"
								/>
							</form>
						</span>
					{/each}
				</div>
				<form method="POST" action="?/setIngredientPref" use:enhance class="flex gap-2">
					<select name="preference" class="h-8 rounded border-border text-xs">
						<option value="dislike">Dislike</option>
						<option value="avoid">Avoid</option>
					</select>
					<Input name="ingredient" placeholder="Add ingredient..." class="h-8 bg-white text-sm" />
					<IconButton type="submit" variant="ghost" size="sm" icon={Plus} class="h-8 w-8" />
				</form>
			</div>
		</div>
	</section>

	<!-- Cuisines -->
	<section>
		<div class="mb-4 flex items-center gap-2">
			<ChefHat class="h-5 w-5 text-ink-muted" />
			<h2 class="font-display text-2xl text-ink">Cuisines</h2>
		</div>

		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
			{#each cuisines as cuisine}
				{@const pref = profile.cuisinePreferences.find((c) => c.cuisineType === cuisine)}
				<div
					class="flex flex-col items-center gap-3 rounded-lg border bg-white p-4 shadow-sm transition-colors
                    {pref?.preference === 'love'
						? 'border-sage-400 bg-sage-50'
						: pref?.preference === 'dislike'
							? 'border-border bg-bg-hover opacity-60'
							: 'border-border hover:border-text-muted/50'}"
				>
					<span class="font-serif font-medium">{cuisine}</span>
					<div class="flex gap-2">
						<form method="POST" action="?/setCuisinePref" use:enhance>
							<input type="hidden" name="cuisine" value={cuisine} />
							<input
								type="hidden"
								name="preference"
								value={pref?.preference === 'dislike' ? 'neutral' : 'dislike'}
							/>
							<IconButton
								type="submit"
								variant="ghost"
								icon={ThumbsDown}
								class="hover:bg-bg-hover {pref?.preference === 'dislike'
									? 'text-red-500'
									: 'text-text-muted'}"
							/>
						</form>
						<form method="POST" action="?/setCuisinePref" use:enhance>
							<input type="hidden" name="cuisine" value={cuisine} />
							<input
								type="hidden"
								name="preference"
								value={pref?.preference === 'love' ? 'neutral' : 'love'}
							/>
							<IconButton
								type="submit"
								variant="ghost"
								icon={Heart}
								class="hover:bg-sage-200 {pref?.preference === 'love'
									? 'fill-red-500 text-red-500'
									: 'text-text-muted'}"
							/>
						</form>
					</div>
				</div>
			{/each}
		</div>
	</section>
</div>
