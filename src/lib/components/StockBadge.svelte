<script lang="ts">
	import { cn } from "$lib/utils";

	let { confidence, className } = $props<{ confidence: number; className?: string }>();

	const status = $derived(
		confidence > 0.7 ? 'high' : confidence > 0.4 ? 'medium' : 'low'
	);
	
	const color = $derived({
		high: 'bg-emerald-100 text-emerald-700 border-emerald-200',
		medium: 'bg-amber-100 text-amber-700 border-amber-200',
		low: 'bg-rose-100 text-rose-700 border-rose-200'
	}[status]);
	
	const label = $derived({
		high: 'In Stock',
		medium: 'Running Low',
		low: 'Restock'
	}[status]);
</script>

<span class={cn(
	"inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
	color,
	className
)}>
	{label}
</span>
