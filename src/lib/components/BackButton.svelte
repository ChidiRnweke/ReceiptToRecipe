<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft } from 'lucide-svelte';

	interface Props {
		href: string;
		label?: string;
		class?: string;
	}

	let { href, label = 'Back', class: className = '' }: Props = $props();
</script>

<Button
	{href}
	variant="ghost"
	size="sm"
	class="mb-4 text-ink-muted hover:bg-transparent hover:text-ink {className}"
>
	<ArrowLeft class="mr-1 h-4 w-4" />
	{label}
</Button>
