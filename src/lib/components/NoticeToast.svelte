<script lang="ts">
	import { X } from 'lucide-svelte';
	import { notice } from '$lib/state/notice.svelte';
</script>

<div
	class="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex justify-center px-4 md:bottom-6"
	role="status"
	aria-live="polite"
>
	{#if notice.message}
		<div
			class="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-[0_10px_24px_-12px_rgba(0,0,0,0.45)]"
		>
			<p class="min-w-0 flex-1 leading-snug">{notice.message}</p>
			<button
				type="button"
				onclick={() => notice.dismiss()}
				class="-m-1 rounded p-1 text-white/70 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
				aria-label="Dismiss"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	{/if}
</div>
