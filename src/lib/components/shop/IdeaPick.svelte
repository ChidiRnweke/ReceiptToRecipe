<script lang="ts">
	import Chip from '$lib/components/tonight/Chip.svelte';
	import RecipePhoto from '$lib/components/tonight/RecipePhoto.svelte';
	import type { ShopIdeaView } from '$lib/models/shop';
	import { listNames } from '$lib/services/tonight';

	interface Props {
		idea: ShopIdeaView;
		picked: boolean;
		ontoggle: () => void;
	}

	let { idea, picked, ontoggle }: Props = $props();
</script>

<button
	type="button"
	aria-pressed={picked}
	onclick={ontoggle}
	class="flex w-full items-center gap-2.5 rounded-2xl border bg-bg-card p-2 text-left transition focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none {picked
		? 'border-sage-500 ring-2 ring-sage-100'
		: 'border-border hover:border-sage-300'}"
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
		</span>
	</span>
	<span
		aria-hidden="true"
		class="font-hand grid size-6 flex-none place-items-center rounded-[7px] border-[1.5px] text-xl leading-none {picked
			? 'border-sage-600 text-sage-700'
			: 'border-sage-300'}">{picked ? '✓' : ''}</span
	>
</button>
