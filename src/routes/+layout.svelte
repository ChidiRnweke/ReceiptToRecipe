<script lang="ts">
	import '../app.css';
	import { Button } from '$lib/components/ui/button';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import WorkflowNav from '$lib/components/WorkflowNav.svelte';
	import MobileBottomNav from '$lib/components/MobileBottomNav.svelte';
	import { Settings, LogOut, CalendarDays, Search, Clock3 } from 'lucide-svelte';
	import { workflowStore } from '$lib/state/workflow.svelte';
	import logo from '$lib/assets/logo.svg';
	import favicon from '$lib/assets/favicon.svg';
	import { pwaInfo } from 'virtual:pwa-info';
	import { browser } from '$app/environment';
	import { invalidate, goto } from '$app/navigation';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
	import UndoToast from '$lib/components/UndoToast.svelte';

	let { data, children } = $props();

	// Reactive statement for web manifest link
	let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');
	const GLOBAL_SEARCH_RECENT_KEY = 'r2r:global-search-recent';
	const QUICK_SUGGESTIONS = ['chicken', 'rice', 'eggs', 'tomatoes', 'milk'];

	type SearchItem = {
		id: string;
		title: string;
		subtitle: string;
		href: string;
		score: number;
	};

	let searchQuery = $state('');
	let searchOpen = $state(false);
	let searching = $state(false);
	let searchError = $state('');
	let selectedIndex = $state(-1);
	let searchInputEl = $state<HTMLInputElement | null>(null);
	let recentSearches = $state<string[]>([]);
	let searchResults = $state<{
		recipes: SearchItem[];
		cupboard: SearchItem[];
		receipts: SearchItem[];
	}>({ recipes: [], cupboard: [], receipts: [] });

	let activeSearchAbort: AbortController | null = null;

	const flattenedSearchResults = $derived([
		...searchResults.recipes,
		...searchResults.cupboard,
		...searchResults.receipts
	]);

	const hasSearchResults = $derived(flattenedSearchResults.length > 0);

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

	$effect(() => {
		if (!browser || !data.user) return;

		const q = searchQuery.trim();
		if (q.length < 2) {
			searching = false;
			searchError = '';
			searchResults = { recipes: [], cupboard: [], receipts: [] };
			selectedIndex = -1;
			if (activeSearchAbort) {
				activeSearchAbort.abort();
				activeSearchAbort = null;
			}
			return;
		}

		const timeout = setTimeout(async () => {
			if (activeSearchAbort) activeSearchAbort.abort();
			const controller = new AbortController();
			activeSearchAbort = controller;

			searching = true;
			searchError = '';
			selectedIndex = -1;

			try {
				const response = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`, {
					signal: controller.signal
				});

				if (!response.ok) {
					throw new Error('Search failed');
				}

				const payload = await response.json();
				searchResults = {
					recipes: payload?.results?.recipes ?? [],
					cupboard: payload?.results?.cupboard ?? [],
					receipts: payload?.results?.receipts ?? []
				};
			} catch (error) {
				if (error instanceof Error && error.name === 'AbortError') return;
				searchError = 'Search is temporarily unavailable.';
				searchResults = { recipes: [], cupboard: [], receipts: [] };
			} finally {
				if (activeSearchAbort === controller) {
					activeSearchAbort = null;
				}
				searching = false;
			}
		}, 180);

		return () => clearTimeout(timeout);
	});

	$effect(() => {
		if (!browser || !data.user) return;
		try {
			const raw = localStorage.getItem(GLOBAL_SEARCH_RECENT_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return;
			recentSearches = parsed
				.filter((value): value is string => typeof value === 'string')
				.slice(0, 5);
		} catch {
			recentSearches = [];
		}
	});

	function persistRecentSearches(value: string) {
		if (!browser) return;
		const next = [value, ...recentSearches.filter((entry) => entry !== value)].slice(0, 5);
		recentSearches = next;
		localStorage.setItem(GLOBAL_SEARCH_RECENT_KEY, JSON.stringify(next));
	}

	function isEditableTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		if (target.isContentEditable) return true;
		const tag = target.tagName.toLowerCase();
		return tag === 'input' || tag === 'textarea' || tag === 'select';
	}

	function handleGlobalKeydown(event: KeyboardEvent) {
		if (!data.user) return;
		if (event.key !== '/') return;
		if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
		if (isEditableTarget(event.target)) return;

		event.preventDefault();
		searchOpen = true;
		searchInputEl?.focus();
		searchInputEl?.select();
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			searchOpen = false;
			selectedIndex = -1;
			return;
		}

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (flattenedSearchResults.length === 0) return;
			selectedIndex =
				(selectedIndex + 1 + flattenedSearchResults.length) % flattenedSearchResults.length;
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (flattenedSearchResults.length === 0) return;
			selectedIndex =
				(selectedIndex - 1 + flattenedSearchResults.length) % flattenedSearchResults.length;
			return;
		}

		if (event.key === 'Enter') {
			if (selectedIndex >= 0 && selectedIndex < flattenedSearchResults.length) {
				event.preventDefault();
				void openSearchResult(flattenedSearchResults[selectedIndex]);
			}
		}
	}

	async function openSearchResult(item: SearchItem) {
		persistRecentSearches(searchQuery.trim());
		searchOpen = false;
		selectedIndex = -1;
		await goto(item.href);
	}

	function applySuggestion(value: string) {
		searchQuery = value;
		searchOpen = true;
		searchInputEl?.focus();
	}

	function isSelectedResult(item: SearchItem): boolean {
		return flattenedSearchResults[selectedIndex] === item;
	}

	function handleSearchBlur() {
		setTimeout(() => {
			searchOpen = false;
		}, 120);
	}
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

<svelte:window onkeydown={handleGlobalKeydown} />

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

			{#if data.user}
				<div class="relative hidden w-full max-w-md px-4 lg:block">
					<div class="relative">
						<Search
							class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted"
						/>
						<input
							bind:this={searchInputEl}
							type="text"
							placeholder="Search recipes, cupboard, receipts"
							bind:value={searchQuery}
							onfocus={() => (searchOpen = true)}
							onblur={handleSearchBlur}
							onkeydown={handleSearchKeydown}
							class="h-9 w-full rounded-lg border border-border bg-white pr-14 pl-9 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-300 focus:outline-none"
						/>
						<span
							class="absolute top-1/2 right-3 -translate-y-1/2 text-[10px] tracking-wider text-text-muted uppercase"
							>/</span
						>
					</div>

					{#if searchOpen}
						<div
							class="absolute right-4 left-4 z-[80] mt-2 rounded-xl border border-border bg-white p-3 shadow-xl"
						>
							{#if searchQuery.trim().length < 2}
								<div class="mb-2 text-xs tracking-wider text-text-muted uppercase">Recent</div>
								{#if recentSearches.length > 0}
									<div class="mb-3 flex flex-wrap gap-2">
										{#each recentSearches as term}
											<button
												type="button"
												onmousedown={(event) => event.preventDefault()}
												onclick={() => applySuggestion(term)}
												class="inline-flex items-center gap-1 rounded-full border border-border bg-bg-card px-2.5 py-1 text-xs text-text-primary"
											>
												<Clock3 class="h-3 w-3" />
												{term}
											</button>
										{/each}
									</div>
								{/if}

								<div class="mb-2 text-xs tracking-wider text-text-muted uppercase">
									Quick suggestions
								</div>
								<div class="flex flex-wrap gap-2">
									{#each QUICK_SUGGESTIONS as suggestion}
										<button
											type="button"
											onmousedown={(event) => event.preventDefault()}
											onclick={() => applySuggestion(suggestion)}
											class="rounded-full border border-border px-2.5 py-1 text-xs text-text-secondary hover:bg-bg-card"
										>
											{suggestion}
										</button>
									{/each}
								</div>
							{:else if searching}
								<p class="py-4 text-sm text-text-muted">Searching...</p>
							{:else if searchError}
								<p class="py-4 text-sm text-danger-600">{searchError}</p>
							{:else if !hasSearchResults}
								<div class="space-y-2 py-2">
									<p class="text-sm text-text-primary">
										No matches found for "{searchQuery.trim()}".
									</p>
									<p class="text-xs text-text-muted">
										Try an ingredient name, recipe title, or store name.
									</p>
								</div>
							{:else}
								{#if searchResults.recipes.length > 0}
									<div class="mb-3">
										<div class="mb-1 text-[11px] tracking-wider text-text-muted uppercase">
											Recipes
										</div>
										<div class="space-y-1">
											{#each searchResults.recipes as recipe}
												<button
													type="button"
													onmousedown={(event) => event.preventDefault()}
													onclick={() => openSearchResult(recipe)}
													class={`block w-full rounded-md px-2 py-1.5 text-left transition ${isSelectedResult(recipe) ? 'bg-primary-50' : 'hover:bg-bg-card'}`}
												>
													<div class="text-sm text-text-primary">{recipe.title}</div>
													<div class="text-xs text-text-muted">{recipe.subtitle}</div>
												</button>
											{/each}
										</div>
									</div>
								{/if}

								{#if searchResults.cupboard.length > 0}
									<div class="mb-3">
										<div class="mb-1 text-[11px] tracking-wider text-text-muted uppercase">
											Cupboard
										</div>
										<div class="space-y-1">
											{#each searchResults.cupboard as item}
												<button
													type="button"
													onmousedown={(event) => event.preventDefault()}
													onclick={() => openSearchResult(item)}
													class={`block w-full rounded-md px-2 py-1.5 text-left transition ${isSelectedResult(item) ? 'bg-primary-50' : 'hover:bg-bg-card'}`}
												>
													<div class="text-sm text-text-primary">{item.title}</div>
													<div class="text-xs text-text-muted">{item.subtitle}</div>
												</button>
											{/each}
										</div>
									</div>
								{/if}

								{#if searchResults.receipts.length > 0}
									<div>
										<div class="mb-1 text-[11px] tracking-wider text-text-muted uppercase">
											Receipts
										</div>
										<div class="space-y-1">
											{#each searchResults.receipts as receipt}
												<button
													type="button"
													onmousedown={(event) => event.preventDefault()}
													onclick={() => openSearchResult(receipt)}
													class={`block w-full rounded-md px-2 py-1.5 text-left transition ${isSelectedResult(receipt) ? 'bg-primary-50' : 'hover:bg-bg-card'}`}
												>
													<div class="text-sm text-text-primary">{receipt.title}</div>
													<div class="text-xs text-text-muted">{receipt.subtitle}</div>
												</button>
											{/each}
										</div>
									</div>
								{/if}
							{/if}
						</div>
					{/if}
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
								<a href="/planning" class="flex w-full items-center">
									<CalendarDays class="mr-2 h-4 w-4" />
									Meal planning
								</a>
							</DropdownMenu.Item>
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

		{#if data.user}
			<div class="px-4 pb-3 sm:px-6 md:hidden">
				<div class="relative">
					<Search
						class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted"
					/>
					<input
						type="text"
						placeholder="Search recipes, cupboard, receipts"
						bind:value={searchQuery}
						onfocus={() => (searchOpen = true)}
						onblur={handleSearchBlur}
						onkeydown={handleSearchKeydown}
						class="h-10 w-full rounded-lg border border-border bg-white pr-4 pl-9 text-sm text-text-primary placeholder:text-text-muted focus:border-primary-300 focus:outline-none"
					/>
					{#if searchOpen}
						<div class="mt-2 rounded-xl border border-border bg-white p-3 shadow-lg">
							{#if searchQuery.trim().length < 2}
								<p class="text-xs text-text-muted">Type at least 2 characters to search.</p>
							{:else if searching}
								<p class="text-sm text-text-muted">Searching...</p>
							{:else if searchError}
								<p class="text-sm text-danger-600">{searchError}</p>
							{:else if !hasSearchResults}
								<p class="text-sm text-text-primary">No matches found.</p>
							{:else}
								<div class="space-y-1">
									{#each flattenedSearchResults as result}
										<button
											type="button"
											onmousedown={(event) => event.preventDefault()}
											onclick={() => openSearchResult(result)}
											class={`block w-full rounded-md px-2 py-1.5 text-left transition ${isSelectedResult(result) ? 'bg-primary-50' : 'hover:bg-bg-card'}`}
										>
											<div class="text-sm text-text-primary">{result.title}</div>
											<div class="text-xs text-text-muted">{result.subtitle}</div>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</header>

	<!-- Main Content -->
	<main class="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 md:pb-8 lg:px-8">
		<ErrorBoundary>
			{@render children?.()}
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

{#if data.user}
	<UndoToast />
{/if}

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
