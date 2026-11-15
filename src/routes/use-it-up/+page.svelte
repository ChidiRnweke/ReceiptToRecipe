<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import UseItUpDoor from '$lib/components/useitup/UseItUpDoor.svelte';
</script>

<svelte:head>
	<title>Use it up - Receipt2Recipe</title>
</svelte:head>

<div id="use-it-up" class="px-4 pt-4 sm:px-6">
	<svelte:boundary>
		<UseItUpDoor />
		{#snippet pending()}
			<div class="mx-auto grid max-w-md gap-4" aria-busy="true">
				<Skeleton class="h-5 w-40" />
				<Skeleton class="h-9 w-64" />
				<Skeleton class="h-48 w-full" />
			</div>
		{/snippet}
		{#snippet failed(error, reset)}
			<div class="mx-auto grid max-w-md gap-2">
				<p class="font-display text-xl text-ink">Use it up could not load.</p>
				{#if error instanceof Error}
					<p class="text-sm text-text-muted">{error.message}</p>
				{/if}
				<button
					type="button"
					class="justify-self-start text-sm text-text-link underline"
					onclick={reset}
				>
					Try again
				</button>
			</div>
		{/snippet}
	</svelte:boundary>
</div>
