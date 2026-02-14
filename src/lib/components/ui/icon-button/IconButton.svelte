<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { ComponentType } from 'svelte';
	import type { Icon } from 'lucide-svelte';

	interface Props {
		variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
		size?: 'default' | 'sm' | 'lg' | 'icon';
		icon: ComponentType<Icon>;
		onclick?: () => void;
		type?: 'button' | 'submit';
		disabled?: boolean;
		title?: string;
		class?: string;
	}

	let {
		variant = 'ghost',
		size = 'icon',
		icon: IconComponent,
		onclick,
		type = 'button',
		disabled = false,
		title,
		class: className = ''
	}: Props = $props();
</script>

<Button {variant} {size} {type} {disabled} {title} {onclick} class="h-8 w-8 {className}">
	<IconComponent class="h-4 w-4" />
</Button>
