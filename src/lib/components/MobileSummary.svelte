<script lang="ts">
	import { ShoppingCart, Store, Upload } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		cartCount: number;
		pantryCount: number;
		completionPercent?: number;
	}

	let { cartCount, pantryCount, completionPercent = 0 }: Props = $props();
</script>

<div class="mb-6 rounded-xl border border-sand bg-bg-paper-dark/80 p-4 shadow-sm lg:hidden">
	<div class="grid grid-cols-3 gap-3">
		<!-- Shopping List Summary -->
		<a
			href="/shopping"
			class="flex flex-col items-center justify-center rounded-lg bg-white p-3 text-center shadow-sm transition-colors hover:bg-bg-hover"
		>
			<div
				class="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-sage-50 text-sage-600"
			>
				<ShoppingCart class="h-4 w-4" />
			</div>
			<p class="text-[10px] tracking-wider text-ink-muted uppercase">To Buy</p>
			<p class="font-display text-lg text-ink">{cartCount}</p>
			{#if completionPercent > 0}
				<div class="mt-1 h-1 w-12 rounded-full bg-border">
					<div
						class="h-1 rounded-full bg-primary-500 transition-all"
						style="width: {completionPercent}%"
					></div>
				</div>
			{/if}
		</a>

		<!-- Pantry Summary -->
		<a
			href="/receipts"
			class="flex flex-col items-center justify-center rounded-lg bg-white p-3 text-center shadow-sm transition-colors hover:bg-bg-hover"
		>
			<div
				class="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600"
			>
				<Store class="h-4 w-4" />
			</div>
			<p class="text-[10px] tracking-wider text-ink-muted uppercase">In Stock</p>
			<p class="font-display text-lg text-ink">{pantryCount}</p>
		</a>

		<!-- Quick Upload CTA -->
		<div class="flex flex-col items-center justify-center">
			<Button
				href="/receipts/upload"
				size="sm"
				class="h-full w-full flex-col gap-1 bg-sage-600 text-white shadow-sm hover:bg-sage-500"
			>
				<Upload class="h-4 w-4" />
				<span class="text-[10px]">Add Receipt</span>
			</Button>
		</div>
	</div>
</div>
