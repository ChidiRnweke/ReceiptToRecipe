<script lang="ts">
	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	import { fly } from 'svelte/transition';
	import { onMount } from 'svelte';

	// Check every minute (1440 checks/day - aggressive but acceptable for a PWA)
	const PERIODIC_CHECK_MS = 60 * 1000;
	// Debounce: don't check more than once every 30 seconds even if triggered multiple times
	const MIN_CHECK_INTERVAL_MS = 30 * 1000;

	let lastCheckTime = 0;
	let swRegistration: ServiceWorkerRegistration | undefined;

	const { offlineReady } = useRegisterSW({
		onRegistered(r) {
			console.log(`[PWA] SW Registered: ${r?.scope}`);
			swRegistration = r;

			if (r) {
				// 1. PERIODIC: Check every minute
				setInterval(() => {
					checkForUpdate();
				}, PERIODIC_CHECK_MS);

				// 2. VISIBILITY: Check when user returns to the tab
				document.addEventListener('visibilitychange', handleVisibilityChange);
			}
		},
		onRegisterError(error) {
			console.error('[PWA] SW registration error:', error);
		}
	});

	function handleVisibilityChange() {
		if (!document.hidden && swRegistration) {
			console.log('[PWA] Page became visible, checking for updates...');
			checkForUpdate();
		}
	}

	function checkForUpdate() {
		const now = Date.now();
		if (now - lastCheckTime < MIN_CHECK_INTERVAL_MS) {
			return; // Debounced
		}
		lastCheckTime = now;

		if (swRegistration) {
			swRegistration.update().catch((err) => {
				console.error('[PWA] Update check failed:', err);
			});
		}
	}

	let show = $derived($offlineReady);

	function close() {
		offlineReady.set(false);
	}

	onMount(() => {
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});
</script>

{#if show}
	<div class="fixed right-4 bottom-4 z-50 max-w-sm" transition:fly={{ y: 50, duration: 300 }}>
		<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
			<div class="flex items-start gap-3">
				<div class="shrink-0">
					<svg class="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						/>
					</svg>
				</div>

				<div class="flex-1">
					<h3 class="font-semibold text-gray-900">Kitchen Ready</h3>
					<p class="mt-1 text-sm text-gray-600">
						Your recipes are now saved to your device, so you can cook even without internet.
					</p>

					<div class="mt-3">
						<button
							onclick={close}
							class="px-3 py-1.5 text-sm text-gray-600 transition-colors hover:text-gray-900"
						>
							Got it
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
