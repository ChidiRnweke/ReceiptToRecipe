<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<h2 class="mt-1 text-xs font-bold tracking-[0.05em] text-text-muted uppercase">
	{@render children()}
</h2>
