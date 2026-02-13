<script lang="ts">
  import { useRegisterSW } from "virtual:pwa-register/svelte";
  import { fly } from "svelte/transition";

  const { needRefresh, updateServiceWorker, offlineReady } = useRegisterSW({
    onRegistered(r) {
      console.log(`SW Registered: ${r}`);
    },
    onRegisterError(error) {
      console.error("SW registration error:", error);
    },
  });

  let show = $derived($offlineReady || $needRefresh);

  function close() {
    offlineReady.set(false);
    needRefresh.set(false);
  }

  async function updateApp() {
    await updateServiceWorker(true);
  }
</script>

{#if show}
  <div
    class="fixed bottom-4 right-4 z-50 max-w-sm"
    transition:fly={{ y: 50, duration: 300 }}
  >
    <div class="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
      <div class="flex items-start gap-3">
        <div class="shrink-0">
          {#if $offlineReady}
            <svg
              class="w-6 h-6 text-green-500"
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
              class="w-6 h-6 text-blue-500"
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
          <p class="text-sm text-gray-600 mt-1">
            {#if $offlineReady}
              Good news! Your recipes are now saved to your device, so you can cook even without internet.
            {:else}
              We've added some fresh ingredients to the app. Refresh to see what's new.
            {/if}
          </p>

          <div class="flex gap-2 mt-3">
            {#if $needRefresh}
              <button
                onclick={updateApp}
                class="px-3 py-1.5 bg-[#2D3748] text-white text-sm rounded-md hover:bg-[#1A202C] transition-colors"
              >
                Update App
              </button>
            {/if}
            <button
              onclick={close}
              class="px-3 py-1.5 text-gray-600 text-sm hover:text-gray-900 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
