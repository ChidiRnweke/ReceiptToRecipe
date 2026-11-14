<script lang="ts" module>
	export interface ReceiptLine {
		name: string;
		qty: string | number;
		price: number;
	}
</script>

<script lang="ts">
	interface Props {
		store: string;
		when: string;
		lines: ReceiptLine[];
		total: number;
		currency?: string;
		class?: string;
	}

	let { store, when, lines, total, currency = 'EUR', class: className = '' }: Props = $props();

	const money = $derived(new Intl.NumberFormat('en-GB', { style: 'currency', currency }));

	const barcode =
		'repeating-linear-gradient(90deg, var(--ink) 0 2px, transparent 2px 4px, var(--ink) 4px 5px, transparent 5px 8px, var(--ink) 8px 11px, transparent 11px 12px)';

	// Zig-zag torn edge along the bottom: 20 teeth, 8px deep.
	const tornEdge = (() => {
		const teeth = 20;
		const points = ['0 0', '100% 0', '100% calc(100% - 8px)'];
		for (let i = teeth - 1; i >= 0; i--) {
			const x = (i * 100) / teeth;
			points.push(`${x + 100 / teeth / 2}% 100%`, `${x}% calc(100% - 8px)`);
		}
		return `polygon(${points.join(',')})`;
	})();
</script>

<figure
	class="mx-2 grid -rotate-[1.2deg] gap-1 rounded-t bg-white px-4 pt-3.5 pb-6 font-mono text-xs text-ink shadow-[0_6px_18px_rgba(0,0,0,0.12)] {className}"
	style:clip-path={tornEdge}
	aria-label="Receipt from {store}, {when}"
>
	<b class="text-center tracking-[0.2em] uppercase">{store}</b>
	<span class="mb-1.5 text-center text-ink-muted">{when}</span>
	<ul class="grid gap-1">
		{#each lines as line, i (i)}
			<li class="flex justify-between gap-2.5">
				<span class="min-w-0 truncate">{line.qty} × {line.name}</span>
				<span class="tabular-nums">{money.format(line.price)}</span>
			</li>
		{/each}
	</ul>
	<div
		class="mt-1.5 flex justify-between gap-2.5 border-t border-dashed border-ink-muted pt-1.5 font-bold"
	>
		<span>TOTAL</span>
		<span class="tabular-nums">{money.format(total)}</span>
	</div>
	<span aria-hidden="true" class="mx-5 mt-2 block h-6.5 opacity-75" style:background={barcode}
	></span>
</figure>
