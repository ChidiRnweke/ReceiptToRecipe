<script lang="ts">
	import type { Snippet } from 'svelte';
	import { splitMarked } from '$lib/services/doors';

	interface Props {
		/** The door's question; wrap the word to highlight in stars, e.g. `What's for *dinner*?`. */
		question: string;
		greeting: string;
		actions?: Snippet;
		class?: string;
	}

	let { question, greeting, actions, class: className = '' }: Props = $props();

	const parts = $derived(splitMarked(question));
</script>

<header class="flex items-end justify-between gap-4 {className}">
	<div class="min-w-0">
		<p class="font-hand text-lg leading-tight text-ink-light">{greeting}</p>
		<h1 class="font-display text-3xl leading-tight font-semibold text-ink sm:text-4xl">
			{#each parts as part, i (i)}{#if part.marked}<span class="marker-highlight">{part.text}</span
					>{:else}{part.text}{/if}{/each}
		</h1>
	</div>
	{#if actions}
		<div class="flex shrink-0 items-center gap-2">
			{@render actions()}
		</div>
	{/if}
</header>
