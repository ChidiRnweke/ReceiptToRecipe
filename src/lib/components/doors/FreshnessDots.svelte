<script lang="ts">
	import { FRESHNESS_DOTS, freshnessLevel, type FreshnessTone } from '$lib/services/doors';

	interface Props {
		/** Whole days left before the item expires; negative once it has passed. */
		daysLeft: number;
		class?: string;
	}

	let { daysLeft, class: className = '' }: Props = $props();

	const level = $derived(freshnessLevel(daysLeft));
	const label = $derived(
		level.tone === 'off'
			? 'Probably gone off'
			: daysLeft < 1
				? 'Use today'
				: `${Math.floor(daysLeft)} day${Math.floor(daysLeft) === 1 ? '' : 's'} left`
	);

	const fill: Record<FreshnessTone, string> = {
		high: 'border-sage-300 bg-sage-300',
		mid: 'border-amber-300 bg-amber-300',
		low: 'border-sienna-500 bg-sienna-500',
		off: ''
	};
</script>

<span
	class="inline-flex flex-none gap-0.75 {className}"
	role="img"
	aria-label={label}
	title={label}
>
	{#each { length: FRESHNESS_DOTS }, i (i)}
		<i
			class="size-1.75 rounded-full border {i < level.dots
				? fill[level.tone]
				: 'border-border bg-bg-paper-dark'}"
		></i>
	{/each}
</span>
