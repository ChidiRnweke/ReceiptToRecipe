<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet';
	import type { TonightIdea } from '$lib/models/tonight';
	import { getAlternatives } from '$lib/remote/tonight/tonight.remote';
	import IdeaRow from './IdeaRow.svelte';

	interface Props {
		open: boolean;
		busy?: boolean;
		showCalories?: boolean;
		onpick: (idea: TonightIdea) => void;
	}

	let { open = $bindable(), busy = false, showCalories = false, onpick }: Props = $props();
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side="bottom"
		class="max-h-[80dvh] overflow-y-auto rounded-t-2xl bg-bg-paper px-4 pb-6"
	>
		<Sheet.Header class="px-0 pb-0">
			<Sheet.Title class="font-display text-2xl text-ink">Something else</Sheet.Title>
			<Sheet.Description class="sr-only">Pick another dish for this meal.</Sheet.Description>
		</Sheet.Header>
		{#if open}
			<svelte:boundary>
				{@const ideas = await getAlternatives()}
				<div class="grid gap-2">
					{#each ideas as idea (idea.recipeId)}
						<IdeaRow {idea} {showCalories} disabled={busy} {onpick} />
					{:else}
						<p class="font-hand text-lg text-text-secondary">
							No other recipes yet. Make one in Recipes.
						</p>
					{/each}
				</div>
				{#snippet pending()}
					<p class="font-hand text-lg text-text-muted">Looking through your recipes…</p>
				{/snippet}
				{#snippet failed()}
					<p class="text-sm text-danger-600">Ideas could not load. Close this and try again.</p>
				{/snippet}
			</svelte:boundary>
		{/if}
	</Sheet.Content>
</Sheet.Root>
