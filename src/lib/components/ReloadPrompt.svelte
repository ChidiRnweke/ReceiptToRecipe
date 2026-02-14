<script lang="ts">
	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	import { fly } from 'svelte/transition';
	import { Loader2 } from 'lucide-svelte';

	const { needRefresh, updateServiceWorker, offlineReady } = useRegisterSW({
		onRegistered(r) {
			console.log(`SW Registered: ${r}`);
		},
		onRegisterError(error) {
			console.error('SW registration error:', error);
		}
	});

	let show = $derived($offlineReady || $needRefresh);
	let isUpdating = $state(false);

	function close() {
		offlineReady.set(false);
		needRefresh.set(false);
	}

	async function updateApp() {
		isUpdating = true;
		try {
			await updateServiceWorker(true);
			// Give the service worker a moment to activate, then reload
			setTimeout(() => {
				window.location.reload();
			}, 500);
		} catch (error) {
			console.error('Failed to update service worker:', error);
			isUpdating = false;
		}
	}
</script>

{#if show}
	<div class="fixed right-4 bottom-4 z-50 max-w-sm" transition:fly={{ y: 50, duration: 300 }}>
		<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
			<div class="flex items-start gap-3">
				<div class="shrink-0">
					{#if $offlineReady}
						<svg
							class="h-6 w-6 text-green-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							/>
						</svg>
					{:else}
						<svg
							class="h-6 w-6 text-blue-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
					{/if}
				</div>

				<div class="flex-1">
					<h3 class="font-semibold text-gray-900">
						{#if $offlineReady}
							Kitchen Ready
						{:else}
							Fresh Update Available
						{/if}
					</h3>
					<p class="mt-1 text-sm text-gray-600">
						{#if $offlineReady}
							Good news! Your recipes are now saved to your device, so you can cook even without
							internet.
						{:else}
							We've added some fresh ingredients to the app. Refresh to see what's new.
						{/if}
					</p>

					<div class="mt-3 flex gap-2">
						{#if $needRefresh}
							<button
								onclick={updateApp}
								disabled={isUpdating}
								class="flex items-center gap-2 rounded-md bg-[#2D3748] px-3 py-1.5 text-sm text-white transition-colors hover:bg-[#1A202C] disabled:cursor-not-allowed disabled:opacity-50"
							>
								{#if isUpdating}
									<Loader2 class="h-4 w-4 animate-spin" />
									<span>Updating...</span>
								{:else}
									<span>Update App</span>
								{/if}
							</button>
						{/if}
						<button
							onclick={close}
							disabled={isUpdating}
							class="px-3 py-1.5 text-sm text-gray-600 transition-colors hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Got it
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
