<script lang="ts">
	import WashiTape from '$lib/components/WashiTape.svelte';
	import { type Snippet } from 'svelte';

	let {
		children,
		tapeWidth = 'w-24',
		tapeRotate = '-rotate-1',
		showTape = true,
		class: className = 'bg-stone-200/40'
	}: {
		children: Snippet;
		tapeWidth?: string;
		tapeRotate?: string;
		showTape?: boolean;
		class?: string;
	} = $props();
</script>

<div class={`relative rounded-2xl p-1 shadow-inner ${className}`}>
	{#if showTape}
		<div class="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
			<WashiTape width={tapeWidth} rotate={tapeRotate} />
		</div>
	{/if}

	<div class="h-full overflow-hidden rounded-xl border border-stone-100 bg-white shadow-sm">
		{@render children?.()}
	</div>
</div>
