<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import type { TonightIdea } from '$lib/models/tonight';
	import { formatAmount } from '$lib/services/tonight';

	interface Props {
		recipe: TonightIdea | null;
		open: boolean;
		busy?: boolean;
		ondone: () => void;
	}

	let { recipe, open = $bindable(), busy = false, ondone }: Props = $props();
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side="bottom"
		class="max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-bg-paper px-4 pb-6"
	>
		{#if recipe}
			<Sheet.Header class="px-0 pb-0">
				<Sheet.Title class="font-display text-2xl leading-tight text-ink"
					>{recipe.title}</Sheet.Title
				>
				<Sheet.Description class="text-sm text-text-muted">
					For {recipe.servings}{recipe.minutes ? ` · ${recipe.minutes} min` : ''}
				</Sheet.Description>
			</Sheet.Header>

			{#if recipe.ingredients.length}
				<section
					class="rounded-2xl border border-border bg-bg-card p-3"
					aria-labelledby="cook-need"
				>
					<h3 id="cook-need" class="font-display mb-1 text-lg text-ink">You need</h3>
					<ul class="divide-y divide-border">
						{#each recipe.ingredients as ingredient, i (i)}
							<li class="flex items-center gap-2 py-1.5 text-sm">
								<span class="flex-1 text-ink">{ingredient.name}</span>
								<span class="text-text-secondary tabular-nums">
									{formatAmount(ingredient.quantity, ingredient.unit)}
								</span>
								{#if ingredient.missing}
									<span
										class="rounded-full border border-warning-100 bg-warning-50 px-2 py-0.5 text-xs font-semibold text-[#92560a]"
										>get it</span
									>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if recipe.steps.length}
				<section
					class="rounded-2xl border border-border bg-bg-card p-3"
					aria-labelledby="cook-steps"
				>
					<h3 id="cook-steps" class="font-display mb-1 text-lg text-ink">Steps</h3>
					<ol class="grid list-decimal gap-2 pl-5 text-sm leading-relaxed text-ink">
						{#each recipe.steps as step, i (i)}
							<li>{step}</li>
						{/each}
					</ol>
				</section>
			{/if}

			<Button
				class="h-11 w-full bg-sage-600 text-base text-white hover:bg-sage-700"
				disabled={busy}
				onclick={ondone}
			>
				Done, we ate
			</Button>
		{/if}
	</Sheet.Content>
</Sheet.Root>
