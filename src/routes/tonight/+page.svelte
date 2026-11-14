<script lang="ts">
	import OnboardingModal from '$lib/components/OnboardingModal.svelte';
	import NoticeToast from '$lib/components/NoticeToast.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import TonightDoor from '$lib/components/tonight/TonightDoor.svelte';
	import { workflowStore } from '$lib/state/workflow.svelte';
</script>

<svelte:head>
	<title>Tonight - Receipt2Recipe</title>
</svelte:head>

<div id="tonight" class="px-4 pt-4 sm:px-6">
	<svelte:boundary>
		<TonightDoor />
		{#snippet pending()}
			<div class="mx-auto grid max-w-md gap-4" aria-busy="true">
				<Skeleton class="h-5 w-40" />
				<Skeleton class="h-9 w-64" />
				<Skeleton class="h-72 w-full" />
			</div>
		{/snippet}
		{#snippet failed(error, reset)}
			<div class="mx-auto grid max-w-md gap-2">
				<p class="font-display text-xl text-ink">Tonight could not load.</p>
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

<NoticeToast />
<OnboardingModal receiptCount={workflowStore.receipts} recipeCount={workflowStore.recipes} />
