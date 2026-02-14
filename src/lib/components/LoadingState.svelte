<script lang="ts">
	import { Loader2 } from 'lucide-svelte';

	interface Props {
		size?: 'sm' | 'md' | 'lg' | 'xl';
		class?: string;
		text?: string;
	}

	let { size = 'md', class: className = '', text }: Props = $props();

	const sizeClasses = {
		sm: 'h-4 w-4',
		md: 'h-8 w-8',
		lg: 'h-12 w-12',
		xl: 'h-16 w-16'
	};
</script>

<div class="flex flex-col items-center justify-center p-4 {className}">
	<Loader2 class="{sizeClasses[size]} animate-spin text-primary-600" />
	{#if text}
		<p class="mt-2 text-sm text-text-muted">{text}</p>
	{/if}
</div>
