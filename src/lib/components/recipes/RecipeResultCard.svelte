<script lang="ts">
	import type { Snippet } from 'svelte';
	import { PolaroidCard } from '$lib/components/doors';
	import type { RecipeCardResult } from '$lib/models/recipes';
	import { sourceLabel } from '$lib/services/recipes';
	import { getRecipePicture } from '$lib/remote/recipes/recipes.remote';
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

	/** How often the card asks again while the picture is being made, and for how long. */
	const POLL_MS = 3000;
	const POLL_LIMIT = 40;

	let polls = $state(0);
	const picture = $derived(result.imageUrl ? null : getRecipePicture(result.id));
	const imageUrl = $derived(result.imageUrl ?? picture?.current?.imageUrl ?? null);
	const pending = $derived(
		!imageUrl && picture?.current?.imageStatus !== 'FAILED' && polls < POLL_LIMIT
	);

	// A new recipe's picture is made in the background; ask until it is there.
	$effect(() => {
		if (!picture || !pending) return;
		const timer = setTimeout(() => {
			polls += 1;
			void picture.refresh();
		}, POLL_MS);
		return () => clearTimeout(timer);
	});
</script>

<PolaroidCard tilt={-0.6}>
	<RecipePicture title={result.title} {imageUrl} {pending} class="h-36 w-full" />
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
