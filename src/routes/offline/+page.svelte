<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { Button } from '$lib/components/ui/button';

	let isOnline = $state(false);
	let showContent = $state(false);

	if (browser) {
		isOnline = navigator.onLine;

		// Grace period: Wait 500ms before showing the offline screen.
		// This prevents the screen from flashing during a slow page load or refresh
		// where the service worker fallback kicks in momentarily.
		setTimeout(() => {
			if (!isOnline) {
				showContent = true;
			}
		}, 500);

		// If the user landed here but is actually online (e.g. slow first load),
		// redirect them back home automatically instead of showing the offline page.
		if (isOnline) {
			goto('/', { replaceState: true });
		}

		window.addEventListener('online', () => {
			isOnline = true;
			// Auto-navigate home when connectivity returns
			goto('/', { replaceState: true });
		});

		window.addEventListener('offline', () => {
			isOnline = false;
			showContent = true;
		});
	}

	function goHome() {
		goto('/');
	}

	function goBack() {
		history.back();
	}
</script>

<svelte:head>
	<title>Offline - ReceiptToRecipe</title>
	<meta name="description" content="You are currently offline" />
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-linear-to-br from-[#FDFBF7] to-[#F5F1E8] px-4"
>
	{#if showContent}
		<div class="w-full max-w-md text-center" transition:fade={{ duration: 200 }}>
			<!-- Offline Icon -->
			<div class="mb-8">
				<svg
					class="mx-auto h-24 w-24 text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M12 19l-2-2m0 0l-2-2m2 2l2-2m-2 2l2 2"
					/>
				</svg>
			</div>

			<h1 class="mb-4 text-3xl font-bold text-gray-800">No Connection</h1>

			<p class="mb-8 text-lg text-gray-600">
				You seem to be offline right now. No worries — your saved recipes and shopping lists are
				still here, ready when you are.
			</p>

			<div class="space-y-4">
				{#if isOnline}
					<div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
						<p class="font-medium text-green-800">Welcome back!</p>
						<p class="mt-1 text-sm text-green-700">
							Your connection is restored. Taking you back now&hellip;
						</p>
					</div>
				{/if}

				<Button onclick={goHome} class="w-full bg-[#2D3748] hover:bg-[#1A202C]">Try Again</Button>

				<Button
					variant="outline"
					onclick={goBack}
					class="w-full border-[#2D3748] text-[#2D3748] hover:bg-gray-50"
				>
					Go Back
				</Button>
			</div>

			<div class="mt-8 border-t border-gray-200 pt-8">
				<p class="text-sm text-gray-500">
					<strong>Tip:</strong> Pages you've visited before are saved for offline use.
				</p>
			</div>
		</div>
	{/if}
</div>
