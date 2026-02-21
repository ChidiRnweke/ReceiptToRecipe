<script lang="ts">
	import { Loader2, Undo2, X } from 'lucide-svelte';
	import { undoToastState } from '$lib/state/undoToast.svelte';

	function dismiss() {
		undoToastState.dismiss();
	}

	async function handleUndo() {
		await undoToastState.undo();
	}
</script>

{#if undoToastState.visible}
	<div class="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4">
		<div
			class="pointer-events-auto flex w-full max-w-lg items-center justify-between gap-3 rounded-lg border border-border bg-white px-4 py-3 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.45)]"
		>
			<div class="min-w-0 flex-1">
				<p class="truncate text-sm text-text-primary">{undoToastState.message}</p>
			</div>

			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={handleUndo}
					disabled={undoToastState.busy}
					class="inline-flex items-center gap-1 rounded-md border border-sage-200 bg-sage-50 px-2 py-1 text-xs font-medium text-sage-700 transition hover:bg-sage-100 disabled:cursor-not-allowed disabled:opacity-70"
				>
					{#if undoToastState.busy}
						<Loader2 class="h-3.5 w-3.5 animate-spin" />
					{:else}
						<Undo2 class="h-3.5 w-3.5" />
					{/if}
					{undoToastState.actionLabel}
				</button>

				<button
					type="button"
					onclick={dismiss}
					class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
					aria-label="Dismiss"
				>
					<X class="h-4 w-4" />
				</button>
			</div>
		</div>
	</div>
{/if}
