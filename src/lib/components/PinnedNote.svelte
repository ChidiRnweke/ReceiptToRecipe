<script lang="ts">
	import PushPin from '$lib/components/PushPin.svelte';
	import { type Snippet } from 'svelte';

	let {
		children,
		color = 'red',
		rotate = 'rotate-1',
		class: className = ''
	}: {
		children: Snippet;
		color?: 'red' | 'yellow';
		rotate?: string;
		class?: string;
	} = $props();
</script>

<div class={`relative mx-auto transition hover:rotate-0 ${rotate} ${className}`}>
	<div class="absolute -top-3 left-1/2 z-20 -translate-x-1/2 drop-shadow-sm filter">
		<PushPin {color} />
	</div>
	<div
		class="h-full rounded-xl border border-amber-200/60 bg-linear-to-br from-amber-50 to-[#FFF4D6] p-4 shadow-sm"
	>
		{@render children?.()}
	</div>
</div>
