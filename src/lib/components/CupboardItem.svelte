<script lang="ts">
	import type { PantryItem } from '$services';
	import { enhance } from '$app/forms';
	import StockBadge from './StockBadge.svelte';
	import ConfidenceBar from './ConfidenceBar.svelte';
	import ConfidenceDetail from './ConfidenceDetail.svelte';
	import {
		ChevronDown,
		ChevronUp,
		Trash2,
		Check,
		Receipt,
		Pencil,
		PackageMinus,
		ShoppingCart
	} from 'lucide-svelte';
	import { slide } from 'svelte/transition';

	let { item, mode = 'active' } = $props<{ item: PantryItem; mode?: 'active' | 'expired' }>();

	let expanded = $state(false);
	let isActioning = $state(false);
	let addedToList = $state(false);

	const daysSinceLabel = $derived(
		item.daysSincePurchase === 0
			? 'Today'
			: item.daysSincePurchase === 1
				? 'Yesterday'
				: `${item.daysSincePurchase}d ago`
	);

	const daysLeftLabel = $derived.by(() => {
		if (!item.confidenceFactors) return null;
		const daysLeft = Math.max(
			0,
			Math.round(item.confidenceFactors.effectiveLifespanDays - item.daysSincePurchase)
		);
		if (daysLeft === 0) return 'Expired';
		if (daysLeft === 1) return '~1 day left';
		return `~${daysLeft} days left`;
	});
</script>

<div
	class="group rounded-lg border border-sand/40 bg-bg-card transition-all hover:border-sand/70 hover:shadow-sm"
>
	<!-- Main row -->
	<button
		type="button"
		class="flex w-full items-center gap-3 p-3 text-left"
		onclick={() => (expanded = !expanded)}
	>
		<!-- Source icon -->
		<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-paper-dark">
			{#if item.source === 'receipt'}
				<Receipt class="h-3 w-3 text-text-muted" />
			{:else}
				<Pencil class="h-3 w-3 text-text-muted" />
			{/if}
		</span>

		<!-- Item info -->
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<span class="font-body truncate text-sm font-medium text-text-primary">
					{item.itemName}
				</span>
				<StockBadge confidence={item.stockConfidence} className="shrink-0" />
			</div>
			<div class="font-ui mt-0.5 flex items-center gap-2 text-[11px] text-text-muted">
				{#if item.quantity && item.quantity !== '1'}
					<span>{item.quantity} {item.unit}</span>
					<span class="text-sand">·</span>
				{/if}
				<span>{daysSinceLabel}</span>
				{#if daysLeftLabel}
					<span class="text-sand">·</span>
					<span
						class={daysLeftLabel === 'Expired'
							? 'text-rose-500'
							: item.stockConfidence <= 0.4
								? 'text-amber-600'
								: 'text-text-muted'}
					>
						{daysLeftLabel}
					</span>
				{/if}
			</div>
		</div>

		<!-- Confidence bar (compact) -->
		<div class="hidden w-16 sm:block">
			<ConfidenceBar confidence={item.stockConfidence} />
		</div>

		<!-- Expand chevron -->
		<span class="text-text-muted transition-transform" class:rotate-180={expanded}>
			<ChevronDown class="h-4 w-4" />
		</span>
	</button>

	<!-- Expanded detail panel -->
	{#if expanded}
		<div transition:slide={{ duration: 200 }} class="border-t border-sand/30 px-3 pt-2 pb-3">
			<!-- Confidence detail -->
			{#if item.confidenceFactors}
				<ConfidenceDetail
					itemName={item.itemName}
					confidence={item.stockConfidence}
					factors={item.confidenceFactors}
					daysSincePurchase={item.daysSincePurchase}
					category={item.category}
				/>
			{/if}

			<!-- Action buttons -->
			<div class="mt-3 flex flex-wrap gap-2">
				{#if mode === 'expired'}
					<!-- Rescue: confirm still in stock -->
					<form
						method="POST"
						action="?/confirmInStock"
						use:enhance={() => {
							isActioning = true;
							return async ({ update }) => {
								await update();
								isActioning = false;
							};
						}}
					>
						<input type="hidden" name="itemId" value={item.id} />
						<input type="hidden" name="source" value={item.source} />
						<button
							type="submit"
							disabled={isActioning}
							class="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
						>
							<Check class="h-3.5 w-3.5" />
							I still have this
						</button>
					</form>

					<!-- Dismiss: mark as used up -->
					<form
						method="POST"
						action="?/markUsedUp"
						use:enhance={() => {
							isActioning = true;
							return async ({ update }) => {
								await update();
								isActioning = false;
							};
						}}
					>
						<input type="hidden" name="itemId" value={item.id} />
						<input type="hidden" name="source" value={item.source} />
						<button
							type="submit"
							disabled={isActioning}
							class="flex items-center gap-1.5 rounded-lg border border-sand/60 bg-bg-card px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-bg-hover"
						>
							<PackageMinus class="h-3.5 w-3.5" />
							Dismiss
						</button>
					</form>
				{:else}
					<!-- Mark as used up -->
					<form
						method="POST"
						action="?/markUsedUp"
						use:enhance={() => {
							isActioning = true;
							return async ({ update }) => {
								await update();
								isActioning = false;
							};
						}}
					>
						<input type="hidden" name="itemId" value={item.id} />
						<input type="hidden" name="source" value={item.source} />
						<button
							type="submit"
							disabled={isActioning}
							class="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100"
						>
							<PackageMinus class="h-3.5 w-3.5" />
							I used this up
						</button>
					</form>

					<!-- Confirm still in stock -->
					<form
						method="POST"
						action="?/confirmInStock"
						use:enhance={() => {
							isActioning = true;
							return async ({ update }) => {
								await update();
								isActioning = false;
							};
						}}
					>
						<input type="hidden" name="itemId" value={item.id} />
						<input type="hidden" name="source" value={item.source} />
						<button
							type="submit"
							disabled={isActioning}
							class="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
						>
							<Check class="h-3.5 w-3.5" />
							I still have this
						</button>
					</form>

					<!-- Delete (manual items only) -->
					{#if item.source === 'manual'}
						<form
							method="POST"
							action="?/deleteItem"
							use:enhance={() => {
								isActioning = true;
								return async ({ update }) => {
									await update();
									isActioning = false;
								};
							}}
						>
							<input type="hidden" name="itemId" value={item.id} />
							<button
								type="submit"
								disabled={isActioning}
								class="flex items-center gap-1.5 rounded-lg border border-sand/60 bg-bg-card px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
							>
								<Trash2 class="h-3.5 w-3.5" />
								Remove
							</button>
						</form>
					{/if}
				{/if}

				<!-- Add to shopping list (both modes) -->
				{#if addedToList}
					<span
						class="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
					>
						<Check class="h-3.5 w-3.5" />
						Added to list
					</span>
				{:else}
					<form
						method="POST"
						action="?/addToShoppingList"
						use:enhance={() => {
							isActioning = true;
							return async ({ update, result }) => {
								await update();
								isActioning = false;
								if (result.type === 'success') {
									addedToList = true;
									setTimeout(() => (addedToList = false), 3000);
								}
							};
						}}
					>
						<input type="hidden" name="itemName" value={item.itemName} />
						<input type="hidden" name="quantity" value={item.quantity} />
						<input type="hidden" name="unit" value={item.unit} />
						<button
							type="submit"
							disabled={isActioning}
							class="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100"
						>
							<ShoppingCart class="h-3.5 w-3.5" />
							Add to list
						</button>
					</form>
				{/if}
			</div>
		</div>
	{/if}
</div>
