<script lang="ts">
	import type { PlanIdea } from '$lib/models/plan';
	import { listNames } from '$lib/services/tonight';
	import Chip from '$lib/components/tonight/Chip.svelte';
	import RecipePhoto from '$lib/components/tonight/RecipePhoto.svelte';

	interface Props {
		idea: PlanIdea;
		disabled?: boolean;
		onpick: (idea: PlanIdea) => void;
	}

	let { idea, disabled = false, onpick }: Props = $props();
</script>

<button
	type="button"
	{disabled}
	onclick={() => onpick(idea)}
	class="flex w-full items-center gap-2.5 rounded-2xl border border-border bg-bg-card p-2 text-left transition hover:border-sage-300 focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none disabled:opacity-60"
>
	<RecipePhoto title={idea.title} imageUrl={idea.imageUrl} small />
	<span class="grid min-w-0 flex-1 gap-1">
		<span class="text-[15px] font-semibold text-ink">{idea.title}</span>
		<span class="flex flex-wrap gap-1.5">
			{#if idea.uses.length}
				<Chip tone="use">uses the {listNames(idea.uses)}</Chip>
			{/if}
			{#if idea.missing.length}
				<Chip tone="need">need {listNames(idea.missing)}</Chip>
			{:else}
				<Chip tone="ok">everything’s home</Chip>
			{/if}
			{#if idea.minutes}
				<Chip>{idea.minutes} min</Chip>
			{/if}
		</span>
	</span>
</button>
