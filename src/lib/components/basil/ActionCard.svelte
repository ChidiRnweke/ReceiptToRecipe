<script lang="ts">
	import { Check } from 'lucide-svelte';
	import type { AgentActionStatus, Touched } from '$lib/models/agent';

	interface Props {
		summary: string;
		status: AgentActionStatus;
		touched: Touched[];
		busy?: boolean;
		onapprove: () => void;
		ondecline: () => void;
		onopen: (touched: Touched) => void;
	}

	let { summary, status, touched, busy = false, onapprove, ondecline, onopen }: Props = $props();
</script>

<div
	class="grid gap-2 rounded-xl border px-3 py-2.5 text-sm {status === 'pending'
		? 'border-sage-300 bg-bg-card'
		: 'border-border bg-bg-card/70'}"
	data-status={status}
>
	<p class="text-ink">{summary}</p>
	{#if status === 'pending'}
		<div class="flex gap-2">
			<button
				type="button"
				class="h-8 rounded-lg bg-sage-600 px-4 text-[13px] font-semibold text-white hover:bg-sage-700 disabled:opacity-60"
				disabled={busy}
				onclick={onapprove}>Yes</button
			>
			<button
				type="button"
				class="h-8 rounded-lg border border-border px-3 text-[13px] font-semibold text-ink-light disabled:opacity-60"
				disabled={busy}
				onclick={ondecline}>Not now</button
			>
		</div>
	{:else if status === 'executed'}
		<p class="flex items-center gap-1 text-[13px] font-semibold text-sage-700">
			<Check class="size-3.5" aria-hidden="true" /> Done
		</p>
		{#if touched.length}
			<ul class="flex flex-wrap gap-1.5" aria-label="What changed">
				{#each touched as item (item.kind + item.id)}
					<li>
						<button
							type="button"
							class="rounded-full border border-sage-200 bg-sage-50 px-2.5 py-0.5 text-[12.5px] text-sage-800 hover:bg-sage-100"
							onclick={() => onopen(item)}>{item.label} →</button
						>
					</li>
				{/each}
			</ul>
		{/if}
	{:else if status === 'declined'}
		<p class="text-[13px] text-text-muted">Not now. Nothing changed.</p>
	{:else if status === 'failed'}
		<p class="text-[13px] text-sienna-600">That didn’t go through. Nothing changed.</p>
	{:else}
		<p class="text-[13px] text-text-muted">Working on it…</p>
	{/if}
</div>
