<script lang="ts">
	import type { Snippet } from 'svelte';
	import { PolaroidCard } from '$lib/components/doors';
	import type { RecipeCardResult } from '$lib/models/recipes';
	import { sourceLabel } from '$lib/services/recipes';
	import RecipeChips from './RecipeChips.svelte';
	import RecipePicture from './RecipePicture.svelte';
	import RecipeSteps from './RecipeSteps.svelte';

	interface Props {
		result: RecipeCardResult;
		/** A heading above the steps; without it the steps are not shown. */
		stepsHeading?: string;
		actions: Snippet;
	}

	let { result, stepsHeading, actions }: Props = $props();
</script>

<PolaroidCard tilt={-0.6}>
	<RecipePicture title={result.title} imageUrl={result.imageUrl} class="h-36 w-full" />
	<div class="grid gap-2.5 px-1 pt-3 pb-1">
		<h3 class="font-display text-xl leading-tight font-semibold text-ink">{result.title}</h3>
		<RecipeChips
			origin={sourceLabel(result.source)}
			uses={result.uses}
			need={result.need}
			totalMinutes={result.totalMinutes}
		/>
		{#if stepsHeading}
			<div class="rounded-xl border border-border bg-white px-3 pt-2">
				<h4 class="text-xs font-bold tracking-wider text-text-muted uppercase">{stepsHeading}</h4>
				<RecipeSteps steps={result.steps} />
			</div>
		{/if}
		<div class="flex flex-wrap gap-2 pt-1">
			{@render actions()}
		</div>
	</div>
</PolaroidCard>
