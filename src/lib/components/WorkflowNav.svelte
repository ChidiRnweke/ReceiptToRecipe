<script lang="ts">
	import { page } from '$app/stores';
	import { Receipt, ChefHat, ShoppingCart, ChevronRight, Warehouse } from 'lucide-svelte';
	import { workflowStore } from '$lib/state/workflow.svelte';

	const steps = [
		{ href: '/receipts', label: 'Receipts', icon: Receipt, countKey: 'receipts' as const },
		{
			href: '/cupboard',
			label: 'Cupboard',
			icon: Warehouse,
			countKey: 'cupboardItems' as const
		},
		{ href: '/recipes', label: 'Recipes', icon: ChefHat, countKey: 'recipes' as const },
		{ href: '/shopping', label: 'Shopping', icon: ShoppingCart, countKey: 'shoppingItems' as const }
	];

	function isActive(href: string) {
		return $page.url.pathname.startsWith(href);
	}

	function getStepState(href: string, count: number) {
		if (isActive(href)) return 'active';
		if (count > 0) return 'completed';
		return 'pending';
	}
</script>

<!-- Desktop Navigation -->
<nav class="hidden items-center gap-1 md:flex">
	{#each steps as step, i}
		{@const count = workflowStore[step.countKey]}
		{@const navState = getStepState(step.href, count)}

		{#if i > 0}
			<ChevronRight class="h-4 w-4 text-text-muted" />
		{/if}

		<a
			href={step.href}
			class="group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors
				{navState === 'active'
				? 'bg-primary-100 text-primary-700'
				: navState === 'completed'
					? 'text-text-primary hover:bg-bg-paper-dark'
					: 'text-text-secondary hover:bg-bg-paper-dark hover:text-text-primary'}"
		>
			<span class="relative">
				<step.icon class="h-4 w-4" />
				{#if count > 0 && navState !== 'active'}
					<span
						class="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary-500 text-[8px] font-bold text-white"
					>
						{count > 9 ? '9+' : count}
					</span>
				{/if}
			</span>
			<span>{step.label}</span>
			{#if navState === 'active' && count > 0}
				<span class="ml-1 rounded-full bg-primary-200 px-1.5 py-0.5 text-xs text-primary-700">
					{count}
				</span>
			{/if}
		</a>
	{/each}
</nav>

<!-- Mobile Navigation -->
<nav class="flex flex-col gap-1 md:hidden">
	{#each steps as step, i}
		{@const count = workflowStore[step.countKey]}
		{@const navState = getStepState(step.href, count)}

		<a
			href={step.href}
			class="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
			{navState === 'active'
				? 'bg-primary-100 text-primary-700'
				: 'text-text-secondary hover:bg-bg-paper-dark hover:text-text-primary'}"
		>
			<span class="flex items-center gap-3">
				<span
					class="flex h-8 w-8 items-center justify-center rounded-full {navState === 'active'
						? 'bg-primary-200'
						: navState === 'completed'
							? 'bg-bg-paper-dark'
							: 'bg-bg-paper-dark'}"
				>
					<step.icon class="h-4 w-4" />
				</span>
				<span>
					<span class="block">{step.label}</span>
					<span class="text-xs text-text-muted">Step {i + 1}</span>
				</span>
			</span>
			{#if count > 0}
				<span class="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
					{count}
				</span>
			{/if}
		</a>
	{/each}
</nav>
