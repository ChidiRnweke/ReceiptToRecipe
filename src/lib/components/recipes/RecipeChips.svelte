<script lang="ts">
	import { listNames } from '$lib/services/recipes';

	interface Props {
		/** Where the recipe came from, e.g. "made up for you". */
		origin: string;
		uses: string[];
		need: string[];
		totalMinutes: number | null;
	}

	let { origin, uses, need, totalMinutes }: Props = $props();

	const chip = 'rounded-full px-2 py-0.5 text-[11.5px] font-semibold';
</script>

<ul class="flex flex-wrap gap-1.5" aria-label="About this recipe">
	<li class="{chip} bg-[#e6eef7] text-[#2f4f7a]">{origin}</li>
	{#if uses.length > 0}
		<li class="{chip} bg-sienna-100 text-sienna-700">uses the {listNames(uses)}</li>
	{/if}
	{#if need.length > 0}
		<li class="{chip} border border-warning-500/40 bg-warning-50 text-[#92560a]">
			need {listNames(need)}
		</li>
	{:else}
		<li class="{chip} bg-sage-100 text-sage-800">everything’s home</li>
	{/if}
	{#if totalMinutes}
		<li class="{chip} bg-paper-dark text-ink-light">{totalMinutes} min</li>
	{/if}
</ul>
