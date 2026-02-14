<script lang="ts">
	import '../app.css';
	import { Button } from '$lib/components/ui/button';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import WorkflowNav from '$lib/components/WorkflowNav.svelte';
	import MobileBottomNav from '$lib/components/MobileBottomNav.svelte';
	import { Settings, LogOut } from 'lucide-svelte';
	import { workflowStore } from '$lib/state/workflow.svelte';
	import logo from '$lib/assets/logo.svg';
	import favicon from '$lib/assets/favicon.svg';
	import { pwaInfo } from 'virtual:pwa-info';
	import { browser } from '$app/environment';
	import { invalidate } from '$app/navigation';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';

	let { data, children } = $props();

	// Reactive statement for web manifest link
	let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');

	// Sync state when data changes (e.g. after navigation)
	$effect(() => {
		if (data.workflowCounts) {
			workflowStore.sync(data.workflowCounts);
		}
	});

	// Client-side revalidation: When the app loads from a service worker cache,
	// the HTML might be stale (e.g., showing logged-out state).
	// We force a check of the session dependency to ensure UI is accurate.
	$effect(() => {
		if (browser && navigator.onLine) {
			invalidate('app:session');
		}
	});
</script>

<svelte:head>
	{@html webManifestLink}
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&display=swap"
		rel="stylesheet"
	/>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#2D3748" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
</svelte:head>

<div class="min-h-screen bg-bg-paper">
	<!-- Header -->
	<header class="sticky top-0 z-50 border-b border-border bg-bg-paper/95 backdrop-blur-sm">
		<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
			<!-- Logo -->
			<a href="/" class="group flex items-center gap-3">
				<img
					src={logo}
					alt="Receipt2Recipe Logo"
					class="h-8 w-8 transition-transform duration-500 group-hover:rotate-6"
				/>
				<span class="font-serif text-2xl font-medium tracking-tight text-text-primary"
					>Receipt2Recipe</span
				>
			</a>

			<!-- Desktop Navigation -->
			{#if data.user}
				<div class="hidden md:block">
					<WorkflowNav />
				</div>
			{/if}

			<!-- User Menu -->
			<div class="flex items-center gap-4">
				{#if data.user}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							<Avatar.Root class="h-9 w-9 cursor-pointer">
								<Avatar.Image src={data.user.avatarUrl} alt={data.user.name} />
								<Avatar.Fallback class="bg-primary-100 text-primary-700">
									{data.user.name.slice(0, 2).toUpperCase()}
								</Avatar.Fallback>
							</Avatar.Root>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" class="w-56">
							<DropdownMenu.Label class="font-normal">
								<div class="flex flex-col space-y-1">
									<p class="text-sm leading-none font-medium">
										{data.user.name}
									</p>
									<p class="text-xs leading-none text-text-muted">
										{data.user.email}
									</p>
								</div>
							</DropdownMenu.Label>
							<DropdownMenu.Separator />
							<DropdownMenu.Item>
								<a href="/preferences" class="flex w-full items-center">
									<Settings class="mr-2 h-4 w-4" />
									Preferences
								</a>
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Item>
								<a href="/logout" data-sveltekit-reload class="flex w-full items-center">
									<LogOut class="mr-2 h-4 w-4" />
									Log out
								</a>
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				{:else}
					<div class="flex items-center gap-2">
						<Button href="/login" variant="ghost">Log in</Button>
						<Button href="/signup">Get Started</Button>
					</div>
				{/if}
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 md:pb-8 lg:px-8">
		<ErrorBoundary>
			{@render children()}
		</ErrorBoundary>
	</main>

	<!-- Footer (hidden on mobile when bottom nav is visible) -->
	<footer class="hidden border-t border-border bg-bg-paper-dark md:block">
		<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<p class="text-center text-sm text-text-muted">
				Receipt2Recipe - Transform your groceries into delicious meals
			</p>
		</div>
	</footer>
</div>

<!-- Mobile Bottom Navigation -->
{#if data.user}
	<MobileBottomNav />
{/if}

<!-- Load ReloadPrompt dynamically to avoid SSR issues -->
{#if browser}
	{#await import('$lib/components/ReloadPrompt.svelte') then { default: ReloadPrompt }}
		<ReloadPrompt />
	{/await}
{/if}
