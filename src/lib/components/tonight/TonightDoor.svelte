<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { DoorHeader, PolaroidCard, SlimState } from '$lib/components/doors';
	import type { TonightIdea, TonightMeal } from '$lib/models/tonight';
	import { availabilityLine, usesChip } from '$lib/services/tonight';
	import {
		cookTonight,
		eatOut,
		getTonight,
		pickAlternative
	} from '$lib/remote/tonight/tonight.remote';
	import { notice } from '$lib/state/notice.svelte';
	import AlternativesSheet from './AlternativesSheet.svelte';
	import Chip from './Chip.svelte';
	import CookSheet from './CookSheet.svelte';
	import IdeaRow from './IdeaRow.svelte';
	import RecipePhoto from './RecipePhoto.svelte';

	const view = $derived(await getTonight());

	let cooking = $state<TonightIdea | TonightMeal | null>(null);
	let cookOpen = $state(false);
	let altsOpen = $state(false);
	let busy = $state(false);
	/** Set after "We're eating out" moved the dinner, so the card says so until the page reloads. */
	let outTonight = $state(false);

	const showCalories = $derived(view.calorieLeft !== null);
	const cardState = $derived(outTonight && view.state === 'ideas' ? 'out' : view.state);
	const canEatOut = $derived(view.slot === 'dinner' && !view.tomorrow);

	function openCook(recipe: TonightIdea | TonightMeal) {
		cooking = recipe;
		cookOpen = true;
	}

	async function run<T>(action: () => Promise<T>, onDone: (result: T) => void) {
		busy = true;
		try {
			onDone(await action());
		} catch {
			notice.show('That didn’t go through. Try again in a moment.');
		} finally {
			busy = false;
		}
	}

	function doneCooking() {
		const recipe = cooking;
		if (!recipe) return;
		const input =
			'plannedMealId' in recipe
				? { plannedMealId: recipe.plannedMealId }
				: { recipeId: recipe.recipeId };
		run(
			() => cookTonight(input),
			() => {
				cookOpen = false;
				notice.show('Enjoy.');
			}
		);
	}

	function pick(idea: TonightIdea) {
		run(
			() => pickAlternative({ recipeId: idea.recipeId }),
			(result) => {
				altsOpen = false;
				notice.show(result.message);
			}
		);
	}

	function goingOut() {
		run(
			() => eatOut(),
			(result) => {
				outTonight = true;
				notice.show(result.message);
			}
		);
	}
</script>

<div class="mx-auto grid max-w-md gap-4 pb-8">
	<DoorHeader greeting={view.greeting} question={view.question} />

	{#if view.calorieLeft !== null}
		<p class="text-sm font-semibold text-text-secondary">
			≈ {view.calorieLeft.toLocaleString('en-GB')} kcal left today
		</p>
	{/if}

	{#if cardState === 'out'}
		<section class="grid gap-1 rounded-2xl border border-border bg-bg-card p-4" aria-live="polite">
			<h2 class="font-display text-2xl text-ink">Eating out tonight</h2>
			<p class="text-sm text-text-muted">Enjoy. Nothing at home is lost.</p>
		</section>
	{:else if view.meal && cardState === 'eaten'}
		<PolaroidCard>
			<RecipePhoto title={view.meal.title} imageUrl={view.meal.imageUrl} />
			<div class="grid justify-items-start gap-2 px-1 pt-3">
				<h2 class="font-display text-2xl leading-tight text-ink">{view.meal.title}</h2>
				<Chip tone="ok">eaten</Chip>
			</div>
		</PolaroidCard>
	{:else if view.meal}
		{@const meal = view.meal}
		<PolaroidCard>
			<RecipePhoto title={meal.title} imageUrl={meal.imageUrl} />
			<div class="grid gap-2.5 px-1 pt-3">
				<h2 class="font-display text-2xl leading-tight text-ink">{meal.title}</h2>
				{#if meal.uses.length}
					<div class="flex flex-wrap gap-1.5">
						<Chip tone="use">{usesChip(meal.uses)}</Chip>
					</div>
				{/if}
				<p class="text-[13px] text-text-muted">
					{[
						meal.minutes ? `${meal.minutes} min` : null,
						meal.calories ? `${meal.calories} kcal` : null
					]
						.filter(Boolean)
						.join(' · ')}
					{#if !meal.untracked}
						{meal.minutes || meal.calories
							? ' · '
							: ''}{#if meal.missing.length && !meal.shopBefore}<b class="text-sienna-700"
								>{availabilityLine(meal.missing, null)}</b
							>{:else}{availabilityLine(meal.missing, meal.shopBefore)}{/if}
					{/if}
				</p>
				<Button
					class="h-11 w-full bg-sage-600 text-base text-white hover:bg-sage-700"
					onclick={() => openCook(meal)}
				>
					Cook this
				</Button>
				<div class="flex gap-2">
					<Button variant="secondary" size="sm" class="flex-1" onclick={() => (altsOpen = true)}>
						Something else?
					</Button>
					{#if canEatOut}
						<Button variant="secondary" size="sm" class="flex-1" disabled={busy} onclick={goingOut}>
							We’re eating out
						</Button>
					{/if}
				</div>
			</div>
		</PolaroidCard>
	{:else}
		<SlimState
			art="plate"
			title={view.tomorrow ? 'Nothing planned tomorrow' : 'Nothing planned tonight'}
			hand="How about one of these?"
		/>
		<div class="grid gap-2">
			{#each view.ideas as idea (idea.recipeId)}
				<IdeaRow {idea} {showCalories} onpick={openCook} />
			{/each}
		</div>
		<Button variant="secondary" href={resolve('/recipes/generate')} class="h-10 w-full">
			Or make something completely new
		</Button>
		{#if !view.tomorrow}
			<Button variant="secondary" size="sm" disabled={busy} onclick={goingOut}>
				We’re eating out tonight
			</Button>
		{/if}
	{/if}

	{#if view.tomorrowLine}
		<p class="px-1 text-[13px] text-text-muted">
			Tomorrow: <b class="text-ink">{view.tomorrowLine.title}</b>{view.tomorrowLine.everythingHome
				? ', everything’s home'
				: ''}.
		</p>
	{/if}
</div>

<CookSheet recipe={cooking} bind:open={cookOpen} {busy} ondone={doneCooking} />
<AlternativesSheet bind:open={altsOpen} {busy} {showCalories} onpick={pick} />
