<script lang="ts">
	import { basilKey } from '$lib/models/agent';
	import FreshnessDots from '$lib/components/doors/FreshnessDots.svelte';
	import type { HomeItem } from '$lib/models/useitup';

	interface Props {
		item: HomeItem;
		/** The Eat-first list shows freshness and ideas; "Everything at home" keeps to the amount. */
		detailed?: boolean;
		disabled?: boolean;
		onideas?: (item: HomeItem) => void;
		ongone: (item: HomeItem) => void;
		onstill?: (item: HomeItem) => void;
		onedit: (item: HomeItem) => void;
	}

	let {
		item,
		detailed = false,
		disabled = false,
		onideas,
		ongone,
		onstill,
		onedit
	}: Props = $props();
</script>

{#snippet amount()}
	{#if item.known}
		<span class="text-[13px] text-text-muted tabular-nums">{item.amount}</span>
	{:else}
		<span class="font-hand text-base text-ink-light">≈ {item.amount}</span>
	{/if}
{/snippet}

<li
	data-basil-key={basilKey.kitchenItem(item.itemKey)}
	class="flex items-center gap-2.5 border-b border-dashed border-border py-1.75 text-sm last:border-b-0"
>
	<button
		type="button"
		class="min-w-0 flex-1 rounded text-left focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none"
		aria-label="Change {item.name}"
		onclick={() => onedit(item)}
	>
		<span class="block text-ink">{item.name}</span>
		{#if detailed}{@render amount()}{/if}
	</button>
	{#if detailed}
		<FreshnessDots daysLeft={item.off ? -1 : item.daysLeft} />
		{#if !item.leftover && onideas}
			<button
				type="button"
				class="text-[13px] font-semibold text-sage-700 underline underline-offset-2"
				onclick={() => onideas(item)}>Ideas</button
			>
		{/if}
	{:else}
		{@render amount()}
	{/if}
	{#if item.off && onstill}
		<button
			type="button"
			class="h-7 w-7.5 flex-none rounded-lg bg-sage-100 font-bold text-sage-800 disabled:opacity-60"
			aria-label="{item.name} is still good"
			{disabled}
			onclick={() => onstill(item)}>↺</button
		>
	{/if}
	<button
		type="button"
		class="h-7 w-7.5 flex-none rounded-lg bg-[#fde7d6] font-bold text-sienna-700 disabled:opacity-60"
		aria-label={item.off ? `Binned the ${item.name.toLowerCase()}` : `${item.name} is gone`}
		{disabled}
		onclick={() => ongone(item)}>✕</button
	>
</li>
