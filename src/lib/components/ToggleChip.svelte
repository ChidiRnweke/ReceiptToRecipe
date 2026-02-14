<script lang="ts">
	interface Props {
		selected: boolean;
		label: string;
		onToggle: () => void;
		class?: string;
	}

	let { selected, label, onToggle, class: className = '' }: Props = $props();
</script>

<button
	type="button"
	onclick={onToggle}
	class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200
		{selected
		? 'border border-sage-300 bg-sage-100 text-sage-900'
		: 'border border-stone-200 bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-800'}
		{className}"
>
	<span
		class="flex h-4 w-4 items-center justify-center rounded-full border transition-colors
		{selected ? 'border-sage-500 bg-sage-500 text-white' : 'border-stone-300'}"
	>
		{#if selected}
			<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
			</svg>
		{/if}
	</span>
	{label}
</button>
