<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Sheet from '$lib/components/ui/sheet';
	import Chip from '$lib/components/tonight/Chip.svelte';
	import RecipePhoto from '$lib/components/tonight/RecipePhoto.svelte';
	import type { HomeItem } from '$lib/models/useitup';
	import { getIdeas } from '$lib/remote/useitup/useitup.remote';
	import { listNames } from '$lib/services/tonight';

	interface Props {
		open: boolean;
		item: Pick<HomeItem, 'itemKey' | 'name'> | null;
	}

	let { open = $bindable(), item }: Props = $props();
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side="bottom"
		class="mx-auto max-h-[85dvh] w-full max-w-lg gap-3 overflow-y-auto rounded-t-3xl bg-bg-paper px-4 pt-3 pb-8"
	>
		<span class="mx-auto h-1.5 w-10 rounded-full bg-border" aria-hidden="true"></span>
		<Sheet.Header class="p-0 text-left">
			<Sheet.Title class="font-display text-2xl font-semibold text-ink">
				Ideas for the {item?.name.toLowerCase() ?? ''}
			</Sheet.Title>
			<Sheet.Description class="sr-only">Recipes that use it, best first.</Sheet.Description>
		</Sheet.Header>
		{#if open && item}
			<svelte:boundary>
				{@const ideas = await getIdeas({ itemKey: item.itemKey })}
				<div class="grid gap-2">
					{#each ideas as idea (idea.recipeId)}
						<a
							href={resolve('/recipes/[id]', { id: idea.recipeId })}
							class="flex items-center gap-2.5 rounded-2xl border border-border bg-bg-card p-2 transition hover:border-sage-300 focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none"
						>
							<RecipePhoto title={idea.title} imageUrl={idea.imageUrl} small />
							<span class="grid min-w-0 flex-1 gap-1">
								<span class="text-[15px] font-semibold text-ink">{idea.title}</span>
								<span class="flex flex-wrap gap-1.5">
									{#if idea.uses.length}
										<Chip tone="use">uses the {listNames(idea.uses)}</Chip>
									{/if}
									{#if idea.missing.length}
										<Chip tone="need">need {listNames(idea.missing)}</Chip>
									{:else}
										<Chip tone="ok">everything’s home</Chip>
									{/if}
									{#if idea.minutes}
										<Chip>{idea.minutes} min</Chip>
									{/if}
								</span>
							</span>
						</a>
					{:else}
						<p class="font-hand text-lg text-text-secondary">
							No recipe uses it yet. Make one up in Recipes.
						</p>
					{/each}
				</div>
				{#snippet pending()}
					<p class="font-hand text-lg text-text-muted">Looking through your recipes…</p>
				{/snippet}
				{#snippet failed()}
					<p class="text-sm text-text-muted">The ideas could not load.</p>
				{/snippet}
			</svelte:boundary>
		{/if}
	</Sheet.Content>
</Sheet.Root>
