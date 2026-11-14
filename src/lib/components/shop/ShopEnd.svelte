<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { CameraTile } from '$lib/components/doors';
	import type { ShopMethod } from '$lib/models/kitchen';
	import { endButtons, endHint } from '$lib/services/shop';

	interface Props {
		/** How this member usually finishes a shop. */
		habit: ShopMethod;
		hasList: boolean;
		busy?: boolean;
		onsnap: () => void;
		ongot: () => void;
	}

	let { habit, hasList, busy = false, onsnap, ongot }: Props = $props();

	const order = $derived(endButtons(habit));
	const label = { receipt: 'Snap the receipt', tick: 'Got everything' } as const;
</script>

{#if !hasList}
	<CameraTile label="Shopped? Snap the receipt" wide tilt={-0.5} onclick={onsnap} />
{:else}
	<div class="grid gap-2">
		{#each order as action, i (action)}
			<Button
				variant={i === 0 ? 'default' : 'secondary'}
				class="h-11 w-full text-base {i === 0 ? 'bg-sage-600 text-white hover:bg-sage-700' : ''}"
				disabled={busy}
				onclick={action === 'receipt' ? onsnap : ongot}
			>
				{label[action]}
			</Button>
		{/each}
		<p class="text-center text-[13px] text-text-muted">{endHint(habit)}</p>
	</div>
{/if}
