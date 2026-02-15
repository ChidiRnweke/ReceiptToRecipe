<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';

	interface Props {
		promise: Promise<any>;
		children: Snippet<[any]>;
		fallback?: Snippet;
		error?: Snippet<[Error]>;
	}

	let { promise, children, fallback, error }: Props = $props();
</script>

{#await promise}
	{#if fallback}
		{@render fallback()}
	{:else}
		<div class="space-y-2">
			<Skeleton class="h-4 w-[250px]" />
			<Skeleton class="h-4 w-[200px]" />
		</div>
	{/if}
{:then data}
	{@render children(data)}
{:catch err}
	{#if error}
		{@render error(err)}
	{:else}
		<div class="text-sm text-red-500">Failed to load data</div>
	{/if}
{/await}
