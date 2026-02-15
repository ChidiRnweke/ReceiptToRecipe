<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		confidence,
		className,
		showLabel = false
	} = $props<{
		confidence: number;
		className?: string;
		showLabel?: boolean;
	}>();

	const percentage = $derived(Math.round(confidence * 100));

	const barColor = $derived(
		confidence > 0.7 ? 'bg-emerald-500' : confidence > 0.4 ? 'bg-amber-500' : 'bg-rose-500'
	);

	const trackColor = $derived(
		confidence > 0.7 ? 'bg-emerald-100' : confidence > 0.4 ? 'bg-amber-100' : 'bg-rose-100'
	);
</script>

<div class={cn('flex items-center gap-2', className)}>
	<div class={cn('h-1.5 flex-1 overflow-hidden rounded-full', trackColor)}>
		<div
			class={cn('h-full rounded-full transition-all duration-500', barColor)}
			style="width: {percentage}%"
		></div>
	</div>
	{#if showLabel}
		<span class="text-[10px] font-medium text-text-muted tabular-nums">{percentage}%</span>
	{/if}
</div>
