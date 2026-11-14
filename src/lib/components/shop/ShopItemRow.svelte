<script lang="ts">
	interface Props {
		name: string;
		amount: string;
		checked: boolean;
		/** Short weekday names of the other dishes that need it. */
		also?: string[];
		ontoggle: (checked: boolean) => void;
		/** Shown for items added by hand. */
		onremove?: () => void;
	}

	let { name, amount, checked, also = [], ontoggle, onremove }: Props = $props();
</script>

<li
	class="flex items-center gap-2.5 border-b border-dashed border-border py-1.5 text-sm last:border-b-0"
>
	<button
		type="button"
		class="font-hand grid size-6 flex-none place-items-center rounded-[7px] border-[1.5px] text-xl leading-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none {checked
			? 'border-sage-600 text-sage-700'
			: 'border-sage-300'}"
		aria-pressed={checked}
		aria-label="{checked ? 'Untick' : 'Tick'} {name}"
		onclick={() => ontoggle(!checked)}
	>
		{checked ? '✓' : ''}
	</button>
	<span class="flex-1 {checked ? 'text-text-muted line-through' : 'text-ink'}">
		{name}
		{#if also.length}
			<span class="text-xs text-text-muted no-underline">also {also.join(', ')}</span>
		{/if}
	</span>
	{#if amount}
		<span class="text-[13px] text-text-muted tabular-nums">{amount}</span>
	{/if}
	{#if onremove}
		<button
			type="button"
			class="px-1 text-base leading-none text-text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none"
			aria-label="Remove {name}"
			onclick={onremove}>×</button
		>
	{/if}
</li>
