<script lang="ts">
	import type { PlanSlot } from '$lib/models/plan';
	import { weekdayName } from '$lib/services/tonight';
	import Chip from '$lib/components/tonight/Chip.svelte';
	import RecipePhoto from '$lib/components/tonight/RecipePhoto.svelte';

	interface Props {
		slot: PlanSlot;
		onopen: (slot: PlanSlot) => void;
	}

	let { slot, onopen }: Props = $props();

	const label = $derived(`${weekdayName(slot.weekday).slice(0, 3)} ${slot.date}`);
	const slotName = $derived(slot.mealType === 'LUNCH' ? 'lunch' : 'dinner');
</script>

<button
	type="button"
	onclick={() => onopen(slot)}
	aria-label={slot.meal
		? `${weekdayName(slot.weekday)} ${slotName}: ${slot.meal.title}`
		: `${weekdayName(slot.weekday)} ${slotName}: pick something`}
	class="flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none
		{slot.meal
		? 'border-border bg-white hover:border-sage-300'
		: 'border-dashed border-border bg-transparent text-text-muted hover:bg-bg-paper-dark/40'}"
>
	<span class="w-11.5 flex-none text-xs leading-tight font-bold text-ink-light">
		{label}
		<small class="block text-[11px] font-medium text-text-muted">{slotName}</small>
	</span>
	{#if slot.meal}
		{@const meal = slot.meal}
		<RecipePhoto title={meal.title} imageUrl={meal.imageUrl} small class="size-11!" />
		<span class="grid min-w-0 flex-1 gap-0.5">
			<b class="text-sm text-ink">{meal.title}</b>
			{#if meal.fromThePot || meal.withLunch || meal.servings || meal.isNew}
				<span class="flex flex-wrap gap-1">
					{#if meal.fromThePot}<Chip tone="ok">from the pot</Chip>{/if}
					{#if meal.withLunch}<Chip>+ tomorrow’s lunch</Chip>{/if}
					{#if meal.servings}<Chip>for {meal.servings}</Chip>{/if}
					{#if meal.isNew}<Chip tone="new">new</Chip>{/if}
				</span>
			{/if}
		</span>
	{:else}
		<span class="flex-1 text-sm">+ Pick something</span>
	{/if}
</button>
