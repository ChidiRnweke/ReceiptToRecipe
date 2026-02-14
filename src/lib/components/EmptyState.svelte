<script lang="ts">
	import type { ComponentType } from 'svelte';
	import type { Icon as IconType } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		icon?: ComponentType<IconType>;
		title: string;
		description: string;
		action?: {
			label: string;
			href?: string;
			onclick?: () => void;
		};
		class?: string;
	}

	let { icon: IconComponent, title, description, action, class: className = '' }: Props = $props();
</script>

<div
	class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-bg-paper-dark/50 py-12 text-center {className}"
>
	{#if IconComponent}
		<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg-input shadow-sm">
			<IconComponent class="h-6 w-6 text-text-muted" />
		</div>
	{/if}
	<h3 class="font-serif text-lg font-medium text-text-primary">{title}</h3>
	<p class="mt-1 max-w-sm text-sm text-text-muted">{description}</p>

	{#if action}
		<div class="mt-6">
			{#if action.href}
				<Button href={action.href} variant="outline">
					{action.label}
				</Button>
			{:else}
				<Button onclick={action.onclick} variant="outline">
					{action.label}
				</Button>
			{/if}
		</div>
	{/if}
</div>
