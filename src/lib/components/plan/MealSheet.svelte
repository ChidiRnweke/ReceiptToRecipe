<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import type { PlanSlotMeal } from '$lib/models/plan';

	interface Props {
		open: boolean;
		meal: PlanSlotMeal | null;
		/** "Friday dinner". */
		when: string;
		busy?: boolean;
		onswap: () => void;
		ontwodays: () => void;
		onremove: () => void;
	}

	let {
		open = $bindable(),
		meal,
		when,
		busy = false,
		onswap,
		ontwodays,
		onremove
	}: Props = $props();
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="bottom" class="rounded-t-2xl bg-bg-paper px-4 pb-6">
		<Sheet.Header class="px-0 pb-0">
			<Sheet.Title class="font-display text-2xl text-ink">{meal?.title ?? ''}</Sheet.Title>
			<Sheet.Description class="text-sm text-text-muted">{when}</Sheet.Description>
		</Sheet.Header>
		{#if meal}
			<div class="grid gap-2">
				{#if !meal.fromThePot}
					<Button variant="secondary" class="h-11" disabled={busy} onclick={onswap}>
						Swap for something else
					</Button>
				{/if}
				{#if meal.keepsWell && !meal.fromThePot && !meal.isPrep}
					<Button variant="secondary" class="h-11" disabled={busy} onclick={ontwodays}>
						{meal.withLunch ? 'Just for tonight' : 'Cook for two days'}
					</Button>
				{/if}
				{#if meal.recipeId}
					<Button
						variant="secondary"
						class="h-11"
						href={resolve('/recipes/[id]', { id: meal.recipeId })}
					>
						See the recipe
					</Button>
				{/if}
				{#if !meal.isPrep}
					<Button variant="secondary" class="h-11" disabled={busy} onclick={onremove}>
						Remove
					</Button>
				{/if}
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
