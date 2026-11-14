<script lang="ts">
	import type { Snippet } from 'svelte';
	import WashiTape from '$lib/components/WashiTape.svelte';

	interface Props {
		children: Snippet;
		/** Caption under the picture, written on the frame. */
		caption?: string;
		/** Tilt in degrees; the card straightens on hover. */
		tilt?: number;
		tape?: boolean;
		class?: string;
	}

	let { children, caption, tilt = -0.6, tape = true, class: className = '' }: Props = $props();
</script>

<figure
	class="relative mt-3 rotate-(--tilt) rounded-sm bg-white p-2.5 pb-3 shadow-[0_14px_30px_-20px_rgba(45,55,72,0.55),0_1px_3px_rgba(0,0,0,0.08)] hover:rotate-0 motion-safe:transition-transform motion-safe:duration-300 {className}"
	style:--tilt="{tilt}deg"
>
	{#if tape}
		<WashiTape
			width="w-20"
			color="yellow"
			rotate="rotate-2"
			class="absolute -top-4 left-1/2 -translate-x-1/2"
		/>
	{/if}
	<div class="overflow-hidden rounded-[2px]">
		{@render children()}
	</div>
	{#if caption}
		<figcaption class="font-hand mt-2 text-center text-lg leading-tight text-ink">
			{caption}
		</figcaption>
	{/if}
</figure>
