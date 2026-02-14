<script lang="ts">
	import { page } from '$app/stores';
	import { User, Settings, Heart, ArrowLeft } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	let { children } = $props();

	const navItems = [
		{ href: '/preferences', label: 'General', icon: Settings },
		{ href: '/settings/taste-profile', label: 'Taste Profile', icon: Heart }
		// { href: '/settings/account', label: 'Account', icon: User },
	];
</script>

<div class="min-h-screen bg-bg-paper p-6 font-serif text-ink md:p-10">
	<div class="mx-auto max-w-5xl">
		<div class="mb-8">
			<Button href="/" variant="ghost" class="mb-2 pl-0 hover:bg-transparent hover:text-sage-600">
				<ArrowLeft class="mr-2 h-4 w-4" />
				Back to Kitchen
			</Button>
			<h1 class="font-display text-4xl text-ink">Kitchen Settings</h1>
			<p class="mt-2 text-ink-light">Customize your culinary experience.</p>
		</div>

		<div class="flex flex-col gap-8 md:flex-row">
			<!-- Sidebar -->
			<aside class="w-full shrink-0 md:w-64">
				<nav class="space-y-1">
					{#each navItems as item}
						{@const isActive = $page.url.pathname === item.href}
						<a
							href={item.href}
							class="flex items-center gap-3 rounded-lg px-4 py-3 transition-all
                            {isActive
								? 'bg-sage-100 font-medium text-sage-900'
								: 'text-ink-light hover:bg-stone-100 hover:text-ink'}"
						>
							<item.icon class="h-4 w-4" />
							{item.label}
						</a>
					{/each}
				</nav>
			</aside>

			<!-- Content -->
			<div class="min-w-0 flex-1">
				{@render children()}
			</div>
		</div>
	</div>
</div>
