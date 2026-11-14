<script lang="ts" module>
	export interface PickTarget {
		day: number;
		mealType: 'LUNCH' | 'DINNER' | 'PREP';
		/** "Friday dinner". */
		title: string;
		/** The planned meal a swap replaces. */
		replaceId?: string;
		exclude?: string[];
	}
</script>

<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet';
	import type { PlanIdea } from '$lib/models/plan';
	import { getIdeas } from '$lib/remote/plan/plan.remote';
	import IdeaButton from './IdeaButton.svelte';

	interface Props {
		open: boolean;
		target: PickTarget | null;
		busy?: boolean;
		onpick: (idea: PlanIdea) => void;
	}

	let { open = $bindable(), target, busy = false, onpick }: Props = $props();
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side="bottom"
		class="max-h-[80dvh] overflow-y-auto rounded-t-2xl bg-bg-paper px-4 pb-6"
	>
		<Sheet.Header class="px-0 pb-0">
			<Sheet.Title class="font-display text-2xl text-ink">{target?.title ?? ''}</Sheet.Title>
			<Sheet.Description class="sr-only">Pick a dish for this meal.</Sheet.Description>
		</Sheet.Header>
		{#if open && target}
			<svelte:boundary>
				{@const ideas = await getIdeas({
					day: target.day,
					mealType: target.mealType,
					exclude: target.exclude
				})}
				<div class="grid gap-2">
					{#each ideas as idea (idea.recipeId)}
						<IdeaButton {idea} disabled={busy} {onpick} />
					{:else}
						<p class="font-hand text-lg text-text-secondary">
							No recipes yet. Make one in Recipes.
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
