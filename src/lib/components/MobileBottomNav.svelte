<script lang="ts">
	import { page } from '$app/stores';
	import { Receipt, ChefHat, ShoppingCart, Home, Upload, Sparkles } from 'lucide-svelte';
	import { workflowStore } from '$lib/state/workflow.svelte';

	const tabs = [
		{ href: '/', label: 'Home', icon: Home, exact: true },
		{ href: '/receipts', label: 'Receipts', icon: Receipt, countKey: 'receipts' as const },
		{ href: '/recipes', label: 'Recipes', icon: ChefHat, countKey: 'recipes' as const },
		{
			href: '/shopping',
			label: 'Shopping',
			icon: ShoppingCart,
			countKey: 'shoppingItems' as const
		}
	];

	function isActive(href: string, exact: boolean = false) {
		if (exact) return $page.url.pathname === href;
		return $page.url.pathname.startsWith(href);
	}

	// Determine the page-specific CTA based on current route
	const pageCta = $derived.by(() => {
		const path = $page.url.pathname;

		if (path === '/receipts' || path === '/') {
			return { href: '/receipts/upload', label: 'Upload', icon: Upload };
		}
		if (path.startsWith('/receipts/') && path !== '/receipts/upload') {
			return { href: `/recipes/generate?receiptId=${path.split('/')[2]}`, label: 'Cook', icon: ChefHat };
		}
		if (path === '/recipes') {
			return { href: '/recipes/generate', label: 'New', icon: Sparkles };
		}
		// No CTA for other pages
		return null;
	});
</script>

<!-- Mobile Bottom Navigation Bar -->
<nav
	class="fixed right-0 bottom-0 left-0 z-50 border-t border-border bg-bg-paper/95 backdrop-blur-md md:hidden"
	style="padding-bottom: env(safe-area-inset-bottom, 0px);"
>
	<div class="flex items-stretch">
		{#each tabs as tab, i}
			{@const active = isActive(tab.href, tab.exact)}
			{@const count = tab.countKey ? workflowStore[tab.countKey] : 0}

			<!-- Insert CTA button in the middle (after 2nd tab) -->
			{#if i === 2 && pageCta}
				<a
					href={pageCta.href}
					class="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 -mt-4"
				>
					<span
						class="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 transition-transform active:scale-95"
					>
						<pageCta.icon class="h-5 w-5" />
					</span>
					<span class="text-[10px] font-medium text-primary-700">{pageCta.label}</span>
				</a>
			{:else if i === 2 && !pageCta}
				<!-- Empty spacer to keep tabs evenly spaced when no CTA -->
			{/if}

			<a
				href={tab.href}
				class="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 pt-2.5 transition-colors
					{active
					? 'text-primary-700'
					: 'text-text-muted'}"
			>
				<!-- Active indicator bar -->
				{#if active}
					<span
						class="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full bg-primary-600"
					></span>
				{/if}

				<span class="relative">
					<tab.icon class="h-5 w-5" />
					{#if count > 0 && !active}
						<span
							class="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-500 px-1 text-[9px] font-bold leading-none text-white"
						>
							{count > 99 ? '99+' : count}
						</span>
					{/if}
				</span>
				<span class="text-[10px] font-medium {active ? 'font-semibold' : ''}">
					{tab.label}
					{#if active && count > 0}
						<span class="text-primary-500">({count})</span>
					{/if}
				</span>
			</a>
		{/each}
	</div>
</nav>
