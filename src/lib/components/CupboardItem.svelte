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

	let {
		item,
		mode = 'active',
		expanded = false,
		ontoggle
	} = $props<{
		item: PantryItem;
		mode?: 'active' | 'expired';
		expanded?: boolean;
		ontoggle?: () => void;
	}>();
	let isActioning = $state(false);
	let addedToList = $state(false);

	function formatQuantity(qty: string): string {
		const num = parseFloat(qty);
		if (isNaN(num)) return qty;
		// Show whole number if close to integer, otherwise 1 decimal
		if (Math.abs(num - Math.round(num)) < 0.05) return Math.round(num).toString();
		return num.toFixed(1);
	}

	const displayQuantity = $derived(formatQuantity(item.quantity));

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
	class="group rounded-lg border border-border bg-bg-card transition-all hover:border-sand hover:shadow-sm"
>
	<!-- Main row -->
	<button
		type="button"
		class="flex w-full flex-col gap-3 p-4 text-left"
		onclick={() => ontoggle?.()}
	>
		<div class="flex w-full items-start gap-3">
			<!-- Source icon -->
			<span
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-paper-dark text-ink-muted"
			>
				{#if item.source === 'receipt'}
					<Receipt class="h-4 w-4" />
				{:else}
					<Pencil class="h-4 w-4" />
				{/if}
			</span>

			<!-- Item info -->
			<div class="min-w-0 flex-1">
				<div class="flex items-start justify-between gap-2">
					<span class="line-clamp-2 text-sm leading-tight font-medium text-ink">
						{item.itemName}
					</span>
					<!-- Expand chevron -->
					<span class="shrink-0 text-ink-muted transition-transform" class:rotate-180={expanded}>
						<ChevronDown class="h-4 w-4" />
					</span>
				</div>

				<div class="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<div class="flex items-center gap-2 text-[11px] text-ink-muted">
						{#if item.quantity && displayQuantity !== '1'}
							<span class="font-medium text-ink-light">{displayQuantity} {item.unit}</span>
							<span class="text-border">|</span>
						{/if}
						<span>{daysSinceLabel}</span>
						{#if daysLeftLabel}
							<span class="text-border">|</span>
							<span
								class={daysLeftLabel === 'Expired'
									? 'font-medium text-destructive'
									: item.stockConfidence <= 0.4
										? 'font-medium text-warning-600'
										: 'text-ink-muted'}
							>
								{daysLeftLabel}
							</span>
						{/if}
					</div>
					<StockBadge confidence={item.stockConfidence} className="scale-90 origin-right" />
				</div>
			</div>
		</div>

		<!-- Confidence bar (full width) -->
		<div class="w-full px-1">
			<ConfidenceBar confidence={item.stockConfidence} />
		</div>
	</button>

	<!-- Expanded detail panel -->
	{#if expanded}
		<div transition:slide={{ duration: 200 }} class="border-t border-sand/30 px-4 pt-3 pb-4">
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
			<div class="mt-4 flex flex-wrap gap-2">
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
							class="border-success-200 text-success-700 flex items-center gap-1.5 rounded-lg border bg-success-50 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-success-100"
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
							class="flex items-center gap-1.5 rounded-lg border border-border bg-bg-paper px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-bg-hover hover:text-ink"
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
							class="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
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
							class="border-success-200 text-success-700 flex items-center gap-1.5 rounded-lg border bg-success-50 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-success-100"
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
								class="flex items-center gap-1.5 rounded-lg border border-border bg-bg-paper px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
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
						class="border-success-200 text-success-700 flex items-center gap-1.5 rounded-lg border bg-success-50 px-3 py-1.5 text-xs font-medium"
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
							class="border-info-200 text-info-700 flex items-center gap-1.5 rounded-lg border bg-info-50 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-info-100"
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
