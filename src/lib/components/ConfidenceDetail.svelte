<script lang="ts">
	import type { ConfidenceFactors } from '$services';
	import ConfidenceBar from './ConfidenceBar.svelte';
	import { ChevronDown, ChevronUp } from 'lucide-svelte';

	let { itemName, confidence, factors, daysSincePurchase, category } = $props<{
		itemName: string;
		confidence: number;
		factors: ConfidenceFactors;
		daysSincePurchase: number;
		category: string | null;
	}>();

	let showTechnical = $state(false);

	const daysLeft = $derived(
		Math.max(0, Math.round(factors.effectiveLifespanDays - daysSincePurchase))
	);

	const lifespanLabel = $derived(
		(
			{
				purchase_frequency: 'your buying pattern',
				user_override: 'your custom estimate',
				category_default: `typical for ${category || 'this category'}`,
				global_default: 'a general estimate'
			} as Record<string, string>
		)[factors.lifespanSource] ?? 'an estimate'
	);

	const percentText = $derived(Math.round(confidence * 100));
</script>

<div class="space-y-3 rounded-lg border border-sand/60 bg-bg-paper-dark/50 p-3">
	<!-- Friendly explanation -->
	<p class="font-body text-sm leading-relaxed text-text-secondary">
		You bought <strong class="text-text-primary">{itemName}</strong>
		{#if daysSincePurchase === 0}
			today.
		{:else if daysSincePurchase === 1}
			yesterday.
		{:else}
			<strong class="text-text-primary">{daysSincePurchase} days ago</strong>.
		{/if}
		Based on {lifespanLabel}, it typically lasts about
		<strong class="text-text-primary">{factors.effectiveLifespanDays} days</strong>.
		{#if daysLeft > 0}
			We think you have about <strong class="text-text-primary">{daysLeft} days left</strong>.
		{:else}
			It's likely <strong class="text-rose-600">past its expected lifespan</strong>.
		{/if}
	</p>

	<ConfidenceBar {confidence} showLabel={true} />

	<!-- Technical details toggle -->
	<button
		type="button"
		class="flex items-center gap-1 text-[11px] tracking-wide text-text-muted uppercase transition-colors hover:text-text-secondary"
		onclick={() => (showTechnical = !showTechnical)}
	>
		{showTechnical ? 'Hide' : 'Show'} details
		{#if showTechnical}
			<ChevronUp class="h-3 w-3" />
		{:else}
			<ChevronDown class="h-3 w-3" />
		{/if}
	</button>

	{#if showTechnical}
		<div class="font-ui space-y-1.5 border-t border-sand/40 pt-2 text-xs text-text-muted">
			<div class="flex justify-between">
				<span>Effective date</span>
				<span class="text-text-secondary">
					{factors.effectiveDate.toLocaleDateString('en-GB', {
						day: 'numeric',
						month: 'short',
						year: 'numeric'
					})}
				</span>
			</div>
			<div class="flex justify-between">
				<span>Days since</span>
				<span class="text-text-secondary">{daysSincePurchase}</span>
			</div>
			<div class="flex justify-between">
				<span>Estimated lifespan</span>
				<span class="text-text-secondary">
					{factors.effectiveLifespanDays} days
					<span class="text-text-muted">({factors.lifespanSource.replace(/_/g, ' ')})</span>
				</span>
			</div>
			<div class="flex justify-between">
				<span>Quantity</span>
				<span class="text-text-secondary">{factors.effectiveQuantity}</span>
			</div>
			{#if factors.quantityBoost > 0}
				<div class="flex justify-between">
					<span>Quantity boost</span>
					<span class="text-emerald-600">+{Math.round(factors.quantityBoost * 100)}%</span>
				</div>
			{/if}
			{#if factors.purchaseCount}
				<div class="flex justify-between">
					<span>Times purchased</span>
					<span class="text-text-secondary">{factors.purchaseCount}</span>
				</div>
			{/if}
			<div class="flex justify-between border-t border-sand/40 pt-1.5 font-medium">
				<span>Confidence</span>
				<span
					class={confidence > 0.7
						? 'text-emerald-600'
						: confidence > 0.4
							? 'text-amber-600'
							: 'text-rose-600'}
				>
					{percentText}%
				</span>
			</div>
		</div>
	{/if}
</div>
