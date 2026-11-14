<script lang="ts">
	import DoorArt from './DoorArt.svelte';
	import type { DoorArtName } from './art';

	interface Props {
		art: DoorArtName;
		label: string;
		/** A resolved URL; without it the tile is a button. */
		href?: string;
		onclick?: () => void;
		/** Tilt in degrees; the tile straightens on hover and focus. */
		tilt?: number;
		wide?: boolean;
		class?: string;
	}

	let {
		art,
		label,
		href,
		onclick,
		tilt = -0.8,
		wide = false,
		class: className = ''
	}: Props = $props();

	const classes = $derived(
		`grid cursor-pointer justify-items-center gap-1 rounded-2xl border border-[#efe9df] bg-white px-2 pt-2.5 pb-3 text-ink shadow-[0_10px_24px_-18px_rgba(45,55,72,0.5),0_1px_2px_rgba(0,0,0,0.05)] rotate-(--tilt) hover:rotate-0 focus-visible:rotate-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-safe:transition-transform ${className}`
	);
</script>

{#snippet body()}
	<DoorArt name={art} class="h-auto w-full {wide ? 'max-w-[150px]' : 'max-w-[120px]'}" />
	<span class="text-sm font-semibold text-sage-800">{label}</span>
{/snippet}

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass a resolve()d href -->
	<a {href} class={classes} style:--tilt="{tilt}deg">{@render body()}</a>
{:else}
	<button type="button" {onclick} class={classes} style:--tilt="{tilt}deg">{@render body()}</button>
{/if}
