<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	
	let isOnline = $state(true);
	
	if (browser) {
		isOnline = navigator.onLine;
		
		window.addEventListener('online', () => {
			isOnline = true;
			// Optionally auto-retry navigation
			// goto('/');
		});
		
		window.addEventListener('offline', () => {
			isOnline = false;
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

<div class="min-h-screen bg-gradient-to-br from-[#FDFBF7] to-[#F5F1E8] flex items-center justify-center px-4">
	<div class="max-w-md w-full text-center">
		<!-- Offline Icon -->
		<div class="mb-8">
			<svg 
				class="w-24 h-24 mx-auto text-gray-400" 
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
		
		<h1 class="text-3xl font-bold text-gray-800 mb-4">
			You're Offline
		</h1>
		
		<p class="text-gray-600 mb-8 text-lg">
			It looks like you've lost your internet connection. Don't worry—your saved recipes and shopping lists are still available!
		</p>
		
		<div class="space-y-4">
			{#if isOnline}
				<div class="p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
					<p class="text-green-800 font-medium">
						You're back online!
					</p>
					<p class="text-green-700 text-sm mt-1">
						Refresh the page to continue where you left off.
					</p>
				</div>
			{/if}
			
			<button
				onclick={goHome}
				class="w-full px-6 py-3 bg-[#2D3748] text-white rounded-lg font-medium
				       hover:bg-[#1A202C] transition-colors duration-200
				       focus:outline-none focus:ring-2 focus:ring-[#2D3748] focus:ring-offset-2"
			>
				Go to Home
			</button>
			
			<button
				onclick={goBack}
				class="w-full px-6 py-3 bg-white text-[#2D3748] border-2 border-[#2D3748] rounded-lg font-medium
				       hover:bg-gray-50 transition-colors duration-200
				       focus:outline-none focus:ring-2 focus:ring-[#2D3748] focus:ring-offset-2"
			>
				Go Back
			</button>
		</div>
		
		<div class="mt-8 pt-8 border-t border-gray-200">
			<p class="text-sm text-gray-500">
				<strong>Tip:</strong> Previously visited pages are cached and available offline.
			</p>
		</div>
	</div>
</div>
