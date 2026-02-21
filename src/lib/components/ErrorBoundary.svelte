<script lang="ts">
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		children: import('svelte').Snippet;
		onlineOnly?: boolean;
		fallback?: import('svelte').Snippet<[error: Error]>;
	}

	let { children, onlineOnly = false, fallback }: Props = $props();

	let error = $state<Error | null>(null);
	let isOnline = $state(true);

	if (browser) {
		isOnline = navigator.onLine;

		window.addEventListener('online', () => {
			isOnline = true;
			error = null; // Clear error when back online
		});

		window.addEventListener('offline', () => {
			isOnline = false;
		});
	}

	function handleError(e: Event) {
		if (e instanceof ErrorEvent) {
			error = e.error;
			console.error('ErrorBoundary caught:', e.error);
		}
	}

	function retry() {
		error = null;
	}
</script>

<svelte:window onerror={handleError} />

{#if error}
	{#if fallback}
		{@render fallback(error)}
	{:else}
		<div class="rounded-lg border border-red-200 bg-red-50 p-6">
			<div class="flex items-start gap-3">
				<svg
					class="mt-0.5 h-6 w-6 shrink-0 text-red-500"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<div class="flex-1">
					<h3 class="font-semibold text-red-900">Something went wrong</h3>
					<p class="mt-1 text-sm text-red-700">{error.message}</p>

					{#if !isOnline}
						<p class="mt-2 text-sm text-amber-700">
							You appear to be offline. Please check your connection and try again.
						</p>
					{/if}

					<Button onclick={retry} variant="destructive" size="sm" class="mt-3">Try Again</Button>
				</div>
			</div>
		</div>
	{/if}
{:else if onlineOnly && !isOnline}
	<div class="rounded-lg border border-amber-200 bg-amber-50 p-6">
		<div class="flex items-start gap-3">
			<svg
				class="mt-0.5 h-6 w-6 shrink-0 text-amber-500"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
			<div>
				<h3 class="font-semibold text-amber-900">Connection Required</h3>
				<p class="mt-1 text-sm text-amber-700">
					This feature requires an internet connection. Please connect and try again.
				</p>
			</div>
		</div>
	</div>
{:else}
	{@render children?.()}
{/if}
