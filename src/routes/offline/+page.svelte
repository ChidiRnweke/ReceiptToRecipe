<script>
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { fade } from "svelte/transition";

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
      goto("/", { replaceState: true });
    }

    window.addEventListener("online", () => {
      isOnline = true;
      // Auto-navigate home when connectivity returns
      goto("/", { replaceState: true });
    });

    window.addEventListener("offline", () => {
      isOnline = false;
      showContent = true;
    });
  }

  function goHome() {
    goto("/");
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
  class="min-h-screen bg-linear-to-br from-[#FDFBF7] to-[#F5F1E8] flex items-center justify-center px-4"
>
  {#if showContent}
  <div class="max-w-md w-full text-center" transition:fade={{ duration: 200 }}>
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

    <h1 class="text-3xl font-bold text-gray-800 mb-4">No Connection</h1>

    <p class="text-gray-600 mb-8 text-lg">
      You seem to be offline right now. No worries — your saved recipes
      and shopping lists are still here, ready when you are.
    </p>

    <div class="space-y-4">
      {#if isOnline}
        <div class="p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
          <p class="text-green-800 font-medium">Welcome back!</p>
          <p class="text-green-700 text-sm mt-1">
            Your connection is restored. Taking you back now&hellip;
          </p>
        </div>
      {/if}

      <button
        onclick={goHome}
        class="w-full px-6 py-3 bg-[#2D3748] text-white rounded-lg font-medium
				       hover:bg-[#1A202C] transition-colors duration-200
				       focus:outline-none focus:ring-2 focus:ring-[#2D3748] focus:ring-offset-2"
      >
        Try Again
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
        <strong>Tip:</strong> Pages you've visited before are saved for offline use.
      </p>
    </div>
  </div>
  {/if}
</div>
