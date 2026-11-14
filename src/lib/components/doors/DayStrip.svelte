<script lang="ts" module>
	export interface StripDay {
		/** Day index; the same number the range and `onpick` use. */
		day: number;
		/** Short weekday, e.g. "Mon". */
		weekday: string;
		/** Day of the month. */
		date: number;
		/** The dinner planned for the day, if any; `hue` colours its dot. */
		dish?: { name: string; hue: number } | null;
		/** The household usually shops on this day. */
		shopDay?: boolean;
	}
</script>

<script lang="ts">
	import { inRange, type DayRange } from '$lib/services/doors';

	interface Props {
		days: StripDay[];
		range: DayRange | null;
		onpick: (day: number) => void;
		label?: string;
		class?: string;
	}

	let {
		days,
		range,
		onpick,
		label = 'Days to plan. Tap a first and a last day.',
		class: className = ''
	}: Props = $props();

	function describe(d: StripDay): string {
		const bits = [`${d.weekday} ${d.date}`];
		bits.push(d.dish ? `dinner: ${d.dish.name}` : 'no dinner planned');
		if (d.shopDay) bits.push('usual shop day');
		return bits.join(', ');
	}

	const dishDot = (hue: number) =>
		`linear-gradient(135deg, hsl(${hue} 70% 78%), hsl(${hue} 40% 48%))`;

	const rings =
		'radial-gradient(circle at 7px 6px, var(--bg-paper-dark) 0 2.2px, #9aa7a1 2.8px 4.2px, transparent 4.6px) 0 0 / 28px 12px repeat-x';
</script>

<div class="relative mt-2 {className}">
	<span
		aria-hidden="true"
		class="pointer-events-none absolute -top-1.5 right-4 left-4 h-3"
		style:background={rings}
	></span>
	<div
		role="group"
		aria-label={label}
		class="grid rounded-2xl border border-border bg-white px-1 py-1.5"
		style:grid-template-columns="repeat({days.length}, minmax(0, 1fr))"
	>
		{#each days as d (d.day)}
			{@const on = inRange(range, d.day)}
			{@const first = on && range?.start === d.day}
			{@const last = on && range?.end === d.day}
			<button
				type="button"
				aria-pressed={on}
				aria-label={describe(d)}
				onclick={() => onpick(d.day)}
				class="relative grid cursor-pointer justify-items-center gap-px pt-1.25 pb-1 text-ink-light focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-safe:transition-colors
					{on ? 'bg-sage-100' : 'hover:bg-bg-paper-dark/60'}
					{first ? 'rounded-l-[10px]' : ''} {last ? 'rounded-r-[10px]' : ''}"
			>
				<small class="text-[10.5px] font-semibold text-ink-muted">{d.weekday.slice(0, 1)}</small>
				<b class="text-[13px] tabular-nums {on ? 'text-sage-800' : ''}">{d.date}</b>
				{#if d.dish}
					<i class="mt-0.5 size-3 rounded-full" style:background={dishDot(d.dish.hue)}></i>
				{:else}
					<i class="mt-0.5 size-3 rounded-full border-[1.5px] border-dashed border-border"></i>
				{/if}
				{#if d.shopDay}
					<em
						class="absolute top-px right-0.75 text-[8px] text-sienna-500 not-italic"
						aria-hidden="true"
						title="Usual shop day">●</em
					>
				{/if}
			</button>
		{/each}
	</div>
</div>
