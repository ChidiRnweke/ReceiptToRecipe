<script lang="ts">
	import NoticeToast from '$lib/components/NoticeToast.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import PlanDoor from '$lib/components/plan/PlanDoor.svelte';
</script>

<svelte:head>
	<title>Plan - Receipt2Recipe</title>
</svelte:head>

<div id="plan" class="px-4 pt-4 sm:px-6">
	<svelte:boundary>
		<PlanDoor />
		{#snippet pending()}
			<div class="mx-auto grid max-w-md gap-4" aria-busy="true">
				<Skeleton class="h-5 w-40" />
				<Skeleton class="h-9 w-64" />
				<Skeleton class="h-16 w-full" />
				<Skeleton class="h-48 w-full" />
			</div>
		{/snippet}
		{#snippet failed(error, reset)}
			<div class="mx-auto grid max-w-md gap-2">
				<p class="font-display text-xl text-ink">The plan could not load.</p>
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
