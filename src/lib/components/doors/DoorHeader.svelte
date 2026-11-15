<script lang="ts">
	import type { Snippet } from 'svelte';
	import { splitMarked } from '$lib/services/doors';
	import NeedsYouButton from '$lib/components/needsyou/NeedsYouButton.svelte';
	import BasilButton from '$lib/components/basil/BasilButton.svelte';

	interface Props {
		/** The door's question; wrap the word to highlight in stars, e.g. `What's for *dinner*?`. */
		question: string;
		greeting: string;
		actions?: Snippet;
		/**
		 * The "Ask Basil" and ⓘ "Needs you" buttons; off only where nobody is signed in, such as
		 * /dev/doors.
		 */
		needsYou?: boolean;
		class?: string;
	}

	let { question, greeting, actions, needsYou = true, class: className = '' }: Props = $props();

	/**
	 * The question's parts, each marked word with the punctuation right after it, so a narrow
	 * header never puts the "?" on a line of its own.
	 */
	const parts = $derived.by(() => {
		const split = splitMarked(question);
		return split.map((part, i) => {
			const next = split[i + 1];
			const tail =
				part.marked && next && !next.marked ? (next.text.match(/^[^\s]+/)?.[0] ?? '') : '';
			const previous = split[i - 1];
			const cut = !part.marked && previous?.marked ? (part.text.match(/^[^\s]+/)?.[0] ?? '') : '';
			return { ...part, text: part.text.slice(cut.length), tail };
		});
	});
</script>

<header class="flex items-end justify-between gap-4 {className}">
	<div class="min-w-0">
		<p class="font-hand text-lg leading-tight text-ink-light">{greeting}</p>
		<h1 class="font-display text-3xl leading-tight font-semibold text-ink sm:text-4xl">
			{#each parts as part, i (i)}{#if part.marked}<span class="whitespace-nowrap"
						><span class="marker-highlight">{part.text}</span>{part.tail}</span
					>{:else}{part.text}{/if}{/each}
		</h1>
	</div>
	{#if actions || needsYou}
		<div class="flex shrink-0 items-center gap-2 self-center">
			{@render actions?.()}
			{#if needsYou}
				<BasilButton />
				<NeedsYouButton />
			{/if}
		</div>
	{/if}
</header>
