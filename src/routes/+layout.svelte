<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import {
		Receipt,
		ChefHat,
		ShoppingCart,
		Settings,
		LogOut,
		Menu,
		X
	} from 'lucide-svelte';

	let { data, children } = $props();

	let mobileMenuOpen = $state(false);

	const navItems = [
		{ href: '/receipts', label: 'Receipts', icon: Receipt },
		{ href: '/recipes', label: 'Recipes', icon: ChefHat },
		{ href: '/shopping', label: 'Shopping List', icon: ShoppingCart }
	];

	function isActive(href: string) {
		return $page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="min-h-screen bg-paper">
	<!-- Header -->
	<header class="sticky top-0 z-50 border-b border-sand bg-paper/95 backdrop-blur-sm">
		<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
			<!-- Logo -->
			<a href="/" class="flex items-center gap-2">
				<span class="font-serif text-2xl font-medium tracking-tight text-ink">Receipt2Recipe</span>
			</a>

			<!-- Desktop Navigation -->
			{#if data.user}
				<nav class="hidden items-center gap-1 md:flex">
					{#each navItems as item}
						<a
							href={item.href}
							class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors {isActive(
								item.href
							)
								? 'bg-paper-dark text-ink'
								: 'text-ink-light hover:bg-paper-dark hover:text-ink'}"
						>
							<item.icon class="h-4 w-4" />
							{item.label}
						</a>
					{/each}
				</nav>
			{/if}

			<!-- User Menu -->
			<div class="flex items-center gap-4">
				{#if data.user}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							<Avatar.Root class="h-9 w-9 cursor-pointer">
								<Avatar.Image src={data.user.avatarUrl} alt={data.user.name} />
								<Avatar.Fallback class="bg-sage-100 text-sage-700">
									{data.user.name.slice(0, 2).toUpperCase()}
								</Avatar.Fallback>
							</Avatar.Root>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" class="w-56">
							<DropdownMenu.Label class="font-normal">
								<div class="flex flex-col space-y-1">
									<p class="text-sm font-medium leading-none">{data.user.name}</p>
									<p class="text-xs leading-none text-ink-muted">{data.user.email}</p>
								</div>
							</DropdownMenu.Label>
							<DropdownMenu.Separator />
							<DropdownMenu.Item href="/preferences">
								<Settings class="mr-2 h-4 w-4" />
								Preferences
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Item href="/logout">
								<LogOut class="mr-2 h-4 w-4" />
								Log out
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>

					<!-- Mobile Menu Button -->
					<button
						class="rounded-lg p-2 text-ink-light hover:bg-paper-dark md:hidden"
						onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
					>
						{#if mobileMenuOpen}
							<X class="h-5 w-5" />
						{:else}
							<Menu class="h-5 w-5" />
						{/if}
					</button>
				{:else}
					<div class="flex items-center gap-2">
						<Button variant="ghost" href="/login">Log in</Button>
						<Button href="/register">Sign up</Button>
					</div>
				{/if}
			</div>
		</div>

		<!-- Mobile Navigation -->
		{#if mobileMenuOpen && data.user}
			<nav class="border-t border-sand bg-paper px-4 py-3 md:hidden">
				{#each navItems as item}
					<a
						href={item.href}
						class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {isActive(
							item.href
						)
							? 'bg-paper-dark text-ink'
							: 'text-ink-light hover:bg-paper-dark hover:text-ink'}"
						onclick={() => (mobileMenuOpen = false)}
					>
						<item.icon class="h-5 w-5" />
						{item.label}
					</a>
				{/each}
			</nav>
		{/if}
	</header>

	<!-- Main Content -->
	<main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer class="border-t border-sand bg-paper-dark">
		<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<p class="text-center text-sm text-ink-muted">
				Receipt2Recipe - Transform your groceries into delicious meals
			</p>
		</div>
	</footer>
</div>
