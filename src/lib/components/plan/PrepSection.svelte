<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { PrepMeal, PrepView } from '$lib/models/plan';
	import { listNames, weekdayName } from '$lib/services/tonight';
	import Chip from '$lib/components/tonight/Chip.svelte';
	import RecipePhoto from '$lib/components/tonight/RecipePhoto.svelte';

	interface Props {
		prep: PrepView;
		busy?: boolean;
		ondone: () => void;
		onswap: (meal: PrepMeal) => void;
	}

	let { prep, busy = false, ondone, onswap }: Props = $props();
</script>

{#snippet boxes()}
	<div class="flex justify-center gap-2 py-1" role="list" aria-label="Lunch boxes">
		{#each prep.boxes as box (box.day)}
			<div class="grid w-15 justify-items-center gap-0.75" role="listitem">
				<span class="h-1.75 w-14 rounded-t-sm rounded-b-[1px] bg-sage-300" aria-hidden="true"
				></span>
				<span
					aria-hidden="true"
					class="h-9.5 w-14 rounded-t-[3px] rounded-b-[9px]"
					style:border={prep.done
						? '2px solid rgba(0,0,0,.06)'
						: `2px dashed hsl(${box.hue} 40% 60%)`}
					style:background={prep.done
						? `linear-gradient(135deg, hsl(${box.hue} 70% 80%), hsl(${box.hue} 40% 50%))`
						: 'transparent'}
				></span>
				<small class="text-[11.5px] font-bold text-ink-light"
					>{weekdayName(box.weekday).slice(0, 3)}</small
				>
			</div>
		{/each}
	</div>
{/snippet}

{#if prep.done}
	<section class="grid gap-2 rounded-2xl border border-border bg-white p-4">
		{@render boxes()}
		{#if prep.lastLunchWeekday !== null}
			<h3 class="font-display text-2xl text-ink">
				Lunch sorted till {weekdayName(prep.lastLunchWeekday)}
			</h3>
		{/if}
		<p class="font-hand text-lg text-ink-light">
			Boxes in the fridge. Nothing to think about until then.
		</p>
	</section>
{:else}
	<section class="grid gap-1 rounded-2xl border border-border bg-white p-3">
		{@render boxes()}
		<p class="text-center text-[13px] text-text-muted">
			{prep.boxes.length} lunches{prep.caloriesPerBox !== null
				? ` · about ${prep.caloriesPerBox} kcal each`
				: ''}
		</p>
	</section>
	{#each prep.meals as meal (meal.plannedMealId)}
		<section class="grid gap-2 rounded-2xl border border-border bg-white p-3">
			<div class="flex items-center gap-2.5">
				<RecipePhoto title={meal.title} imageUrl={meal.imageUrl} small />
				<div class="grid flex-1 gap-0.5">
					<b class="text-[15px] text-ink">{meal.title}</b>
					<span class="text-[13px] text-text-muted"
						>{meal.boxes} boxes{meal.calories ? ` · ${meal.calories} kcal each` : ''}</span
					>
				</div>
				<button
					type="button"
					class="text-sm font-semibold text-text-link underline"
					onclick={() => onswap(meal)}>Swap</button
				>
			</div>
			<span class="justify-self-start">
				{#if meal.missing.length}
					<Chip tone="need">need {listNames(meal.missing)}</Chip>
				{:else}
					<Chip tone="ok">everything’s home</Chip>
				{/if}
			</span>
		</section>
	{/each}
	<section class="grid gap-1.5 rounded-2xl border border-border bg-white p-3">
		<h3 class="text-base font-semibold text-ink">
			Both in one go{prep.minutes ? ` · about ${prep.minutes} min` : ''}
		</h3>
		<ol class="grid gap-1">
			{#each prep.steps as step, i (i)}
				<li class="text-[13.5px] text-ink">
					{#if step.verb}<b>{step.verb}</b>{/if}
					{step.text} <span class="text-text-muted">· {step.dish}</span>
				</li>
			{/each}
		</ol>
		<Button
			class="mt-1 h-11 w-full bg-sage-600 text-base text-white hover:bg-sage-700"
			disabled={busy}
			onclick={ondone}
		>
			Done, boxes in the fridge
		</Button>
	</section>
{/if}
