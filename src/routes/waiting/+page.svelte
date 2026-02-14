<script lang="ts">
	import { Clock } from 'lucide-svelte';
	import PinnedNote from '$lib/components/PinnedNote.svelte';
	import WashiTape from '$lib/components/WashiTape.svelte';
	import { Button } from '$lib/components/ui/button';
</script>

<div class="bg-sand-50 flex min-h-screen items-center justify-center p-4">
	<div class="relative w-full max-w-md">
		<!-- Backing card visual -->
		<div class="absolute inset-0 rotate-1 transform rounded-lg bg-white shadow-xl"></div>

		<div
			class="relative flex flex-col items-center rounded-lg border border-sand bg-bg-paper p-10 text-center shadow-sm"
		>
			<WashiTape class="absolute -top-3 left-1/2 w-32 -translate-x-1/2" />

			<div class="mb-6 rounded-full border border-sage-100 bg-sage-50 p-4">
				<Clock class="h-10 w-10 text-sage-600" />
			</div>

			<h1 class="font-display mb-3 text-4xl text-ink">You're on the list</h1>

			<p class="font-body mx-auto mb-8 max-w-xs leading-relaxed text-ink-muted">
				We're currently rolling out access to new chefs gradually. Sit tight—we'll email you as soon
				as your kitchen is ready.
			</p>

			<div class="mb-8 w-full border-t border-dashed border-border/60"></div>

			<PinnedNote class="mb-8 max-w-70 -rotate-1">
				<p class="font-hand text-center text-lg leading-snug text-ink/80">
					"Good things come to those who wait... and marinate."
				</p>
			</PinnedNote>

			<Button
				href="/logout"
				variant="outline"
				class="w-full border-border text-ink-muted hover:bg-bg-hover hover:text-ink"
			>
				Sign Out
			</Button>
		</div>
	</div>
</div>
