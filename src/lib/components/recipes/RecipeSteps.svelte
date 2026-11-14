<script lang="ts">
	import type { RecipeStep } from '$lib/models/recipes';
	import { techniqueOf } from '$lib/services/recipes';

	interface Props {
		steps: RecipeStep[];
		/** Show a "Why?" toggle on each step whose verb is a known technique. */
		explain?: boolean;
		/** Steps the cook has ticked off, by position. */
		done?: Set<number>;
		ontoggle?: (position: number) => void;
		class?: string;
	}

	let { steps, explain = false, done, ontoggle, class: className = '' }: Props = $props();

	let open = $state<number | null>(null);
</script>

<ol class="grid {className}">
	{#each steps as step (step.position)}
		{@const technique = explain ? techniqueOf(step.verb) : null}
		{@const isDone = done?.has(step.position) ?? false}
		<li class="grid gap-1.5 border-b border-dashed border-border py-3 last:border-0">
			<div class="flex items-start gap-3">
				<span
					class="font-display w-6 shrink-0 text-2xl leading-none {isDone
						? 'text-primary-300'
						: 'text-border'}"
					aria-hidden="true">{step.position + 1}</span
				>
				{#if ontoggle}
					<button
						type="button"
						class="text-left text-base leading-relaxed {isDone
							? 'text-text-muted line-through decoration-border'
							: 'text-ink'}"
						aria-pressed={isDone}
						onclick={() => ontoggle?.(step.position)}
					>
						{#if step.verb}<strong class="font-bold text-sage-800">{`${step.verb} `}</strong
							>{/if}{step.text}
					</button>
				{:else}
					<p class="text-[15px] leading-relaxed text-ink">
						{#if step.verb}<strong class="font-bold text-sage-800">{`${step.verb} `}</strong
							>{/if}{step.text}
					</p>
				{/if}
			</div>
			{#if technique}
				<div class="grid gap-1.5 pl-9">
					<button
						type="button"
						class="justify-self-start rounded-full border border-sage-300 bg-sage-50 px-2.5 py-0.5 text-xs font-semibold text-sage-800 hover:bg-sage-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
						aria-expanded={open === step.position}
						aria-controls="why-{step.position}"
						onclick={() => (open = open === step.position ? null : step.position)}
					>
						Why?
					</button>
					{#if open === step.position}
						<div
							id="why-{step.position}"
							class="rounded-xl bg-bg-card px-3 py-2 text-[13px] leading-snug text-ink-light"
						>
							<p>{technique.why}</p>
							<p class="font-hand mt-1 text-[16px] leading-tight text-sage-700">
								Try it: {technique.tryIt}
							</p>
						</div>
					{/if}
				</div>
			{/if}
		</li>
	{/each}
</ol>
