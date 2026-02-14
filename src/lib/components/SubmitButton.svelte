<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Loader2 } from 'lucide-svelte';

	interface Props {
		loading?: boolean;
		loadingText?: string;
		disabled?: boolean;
		class?: string;
		children?: () => any;
	}

	let {
		loading = false,
		loadingText = 'Loading...',
		disabled = false,
		class: className = '',
		children
	}: Props = $props();
</script>

<Button type="submit" disabled={disabled || loading} class={className}>
	{#if loading}
		<Loader2 class="mr-2 h-4 w-4 animate-spin" />
		{loadingText}
	{:else}
		{@render children?.()}
	{/if}
</Button>
