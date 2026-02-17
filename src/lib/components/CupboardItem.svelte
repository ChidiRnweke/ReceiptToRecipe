<script lang="ts">
	import type { PantryItem } from '$services';
	import CategoryIcon from './CategoryIcon.svelte';

	let { item, onclick } = $props<{
		item: PantryItem;
		onclick?: () => void;
	}>();

	function formatQuantity(qty: string): string {
		const num = parseFloat(qty);
		if (isNaN(num)) return qty;
		if (Math.abs(num - Math.round(num)) < 0.05) return Math.round(num).toString();
		return num.toFixed(1);
	}

	const displayQuantity = $derived(formatQuantity(item.quantity));

	// Consumption-oriented language
	const freshnessLabel = $derived.by(() => {
		if (!item.confidenceFactors) return null;
		const conf = item.stockConfidence;
		const daysLeft = Math.max(
			0,
			Math.round(item.confidenceFactors.effectiveLifespanDays - item.daysSincePurchase)
		);

		if (daysLeft === 0) return { text: 'Probably gone', tone: 'expired' as const };
		if (conf > 0.8) return { text: 'Fresh', tone: 'good' as const };
		if (conf > 0.6) return { text: 'Still good', tone: 'good' as const };
		if (conf > 0.4) return { text: 'Use soon', tone: 'warning' as const };
		if (conf > 0.2) return { text: 'Use it up', tone: 'urgent' as const };
		return { text: 'Probably gone', tone: 'expired' as const };
	});

	const freshnessColor = $derived.by(() => {
		if (!freshnessLabel) return '';
		return (
			(
				{
					good: 'text-emerald-600',
					warning: 'text-amber-600',
					urgent: 'text-rose-500',
					expired: 'text-rose-600'
				} as Record<string, string>
			)[freshnessLabel.tone] ?? ''
		);
	});
</script>

<!-- Notepad row: clickable, name wraps -->
<button
	type="button"
	class="group flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-bg-hover/50"
	{onclick}
>
	<!-- Category icon -->
	<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-ink-muted/70">
		<CategoryIcon category={item.category} class="h-3.5 w-3.5" />
	</span>

	<!-- Item name (wraps, not truncated) -->
	<span class="font-hand min-w-0 flex-1 text-base leading-snug text-ink">
		{item.itemName}
	</span>

	<!-- Right side: quantity + freshness -->
	<span class="mt-0.5 flex shrink-0 items-center gap-2">
		{#if item.quantity && displayQuantity !== '1'}
			<span class="font-ui text-[10px] text-ink-muted">
				x{displayQuantity}
			</span>
		{/if}

		{#if freshnessLabel}
			<span class="font-ui text-[10px] font-medium {freshnessColor}">
				{freshnessLabel.text}
			</span>
		{/if}
	</span>
</button>
