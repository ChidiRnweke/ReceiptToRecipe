<script lang="ts">
	import DoorArt from './DoorArt.svelte';
	import type { EmptyArtName } from './art';

	interface Props {
		art: EmptyArtName;
		title: string;
		/** A short hand-written line under the title. */
		hand?: string;
		class?: string;
	}

	let { art, title, hand, class: className = '' }: Props = $props();
</script>

<div class="flex items-center gap-2.5 px-0.5 py-0.5 {className}">
	<DoorArt name={art} class="h-10.5 w-14 flex-none" />
	<p class="grid leading-tight">
		<span class="font-display text-[17px] font-semibold text-ink">{title}</span>
		{#if hand}
			<span class="font-hand text-base text-ink-light">{hand}</span>
		{/if}
	</p>
</div>
