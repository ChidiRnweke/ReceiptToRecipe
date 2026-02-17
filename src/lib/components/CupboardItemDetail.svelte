<script lang="ts">
	import type { PantryItem } from '$services';
	import { enhance } from '$app/forms';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import StockBadge from './StockBadge.svelte';
	import ConfidenceDetail from './ConfidenceDetail.svelte';
	import CategoryIcon from './CategoryIcon.svelte';
	import {
		Trash2,
		Check,
		Receipt,
		Pencil,
		PackageMinus,
		ShoppingCart,
		Calendar,
		X
	} from 'lucide-svelte';

	let {
		item,
		mode = 'active',
		open = $bindable(false)
	} = $props<{
		item: PantryItem | null;
		mode?: 'active' | 'expired';
		open: boolean;
	}>();

	let isActioning = $state(false);
	let addedToList = $state(false);

	function formatQuantity(qty: string): string {
		const num = parseFloat(qty);
		if (isNaN(num)) return qty;
		if (Math.abs(num - Math.round(num)) < 0.05) return Math.round(num).toString();
		return num.toFixed(1);
	}

	const displayQuantity = $derived(item ? formatQuantity(item.quantity) : '');

	const daysSinceLabel = $derived(
		!item
			? ''
			: item.daysSincePurchase === 0
				? 'Bought today'
				: item.daysSincePurchase === 1
					? 'Bought yesterday'
					: `Bought ${item.daysSincePurchase} days ago`
	);

	const purchaseDateLabel = $derived(
		item
			? item.lastPurchased.toLocaleDateString('en-GB', {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				})
			: ''
	);
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content
		class="max-w-md overflow-hidden bg-bg-paper p-0"
		interactOutsideBehavior="close"
	>
		{#if item}
			<!-- Header -->
			<AlertDialog.Header class="relative border-b border-sand/40 bg-white p-5 pr-12">
				<!-- Close button -->
				<button
					type="button"
					class="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-bg-hover hover:text-ink"
					onclick={() => (open = false)}
				>
					<X class="h-4 w-4" />
					<span class="sr-only">Close</span>
				</button>

				<div class="flex items-start gap-3">
					<span
						class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-paper-dark text-ink-muted"
					>
						<CategoryIcon category={item.category} class="h-4 w-4" />
					</span>
					<div class="min-w-0 flex-1">
						<AlertDialog.Title class="font-display text-lg leading-snug text-ink">
							{item.itemName}
						</AlertDialog.Title>
						<AlertDialog.Description>
							<div class="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
								{#if item.quantity && displayQuantity !== '1'}
									<span class="font-medium text-ink-light">
										{displayQuantity}
										{item.unit}
									</span>
									<span class="text-sand">·</span>
								{/if}
								{#if item.category}
									<span>{item.category}</span>
									<span class="text-sand">·</span>
								{/if}
								{#if item.source === 'receipt'}
									<span class="flex items-center gap-1">
										<Receipt class="h-3 w-3" /> From receipt
									</span>
								{:else}
									<span class="flex items-center gap-1">
										<Pencil class="h-3 w-3" /> Added manually
									</span>
								{/if}
							</div>
						</AlertDialog.Description>
					</div>
					<StockBadge confidence={item.stockConfidence} />
				</div>
			</AlertDialog.Header>

			<!-- Body -->
			<div class="space-y-4 bg-white p-5">
				<!-- Purchase date -->
				<div class="flex items-center gap-2 text-sm text-ink-light">
					<Calendar class="h-4 w-4 text-ink-muted" />
					<span>{daysSinceLabel}</span>
					<span class="text-sand">·</span>
					<span class="text-ink-muted">{purchaseDateLabel}</span>
				</div>

				<!-- Confidence breakdown -->
				{#if item.confidenceFactors}
					<ConfidenceDetail
						itemName={item.itemName}
						confidence={item.stockConfidence}
						factors={item.confidenceFactors}
						daysSincePurchase={item.daysSincePurchase}
						category={item.category}
					/>
				{/if}
			</div>

			<!-- Actions -->
			<AlertDialog.Footer
				class="flex flex-wrap gap-2 border-t border-sand/40 bg-bg-paper-dark/30 p-4"
			>
				{#if mode === 'expired'}
					<form
						method="POST"
						action="?/confirmInStock"
						use:enhance={() => {
							isActioning = true;
							return async ({ update }) => {
								await update();
								isActioning = false;
								open = false;
							};
						}}
					>
						<input type="hidden" name="itemId" value={item.id} />
						<input type="hidden" name="source" value={item.source} />
						<Button
							type="submit"
							variant="outline"
							size="sm"
							disabled={isActioning}
							class="border-success-200 text-success-700 bg-success-50 hover:bg-success-100"
						>
							<Check class="mr-1.5 h-3.5 w-3.5" />
							I still have this
						</Button>
					</form>

					<form
						method="POST"
						action="?/markUsedUp"
						use:enhance={() => {
							isActioning = true;
							return async ({ update }) => {
								await update();
								isActioning = false;
								open = false;
							};
						}}
					>
						<input type="hidden" name="itemId" value={item.id} />
						<input type="hidden" name="source" value={item.source} />
						<Button type="submit" variant="outline" size="sm" disabled={isActioning}>
							<PackageMinus class="mr-1.5 h-3.5 w-3.5" />
							Dismiss
						</Button>
					</form>
				{:else}
					<form
						method="POST"
						action="?/markUsedUp"
						use:enhance={() => {
							isActioning = true;
							return async ({ update }) => {
								await update();
								isActioning = false;
								open = false;
							};
						}}
					>
						<input type="hidden" name="itemId" value={item.id} />
						<input type="hidden" name="source" value={item.source} />
						<Button
							type="submit"
							variant="outline"
							size="sm"
							disabled={isActioning}
							class="border-destructive/30 text-destructive hover:bg-destructive/10"
						>
							<PackageMinus class="mr-1.5 h-3.5 w-3.5" />
							Used up
						</Button>
					</form>

					<form
						method="POST"
						action="?/confirmInStock"
						use:enhance={() => {
							isActioning = true;
							return async ({ update }) => {
								await update();
								isActioning = false;
								open = false;
							};
						}}
					>
						<input type="hidden" name="itemId" value={item.id} />
						<input type="hidden" name="source" value={item.source} />
						<Button
							type="submit"
							variant="outline"
							size="sm"
							disabled={isActioning}
							class="border-success-200 text-success-700 bg-success-50 hover:bg-success-100"
						>
							<Check class="mr-1.5 h-3.5 w-3.5" />
							Still have this
						</Button>
					</form>

					{#if item.source === 'manual'}
						<form
							method="POST"
							action="?/deleteItem"
							use:enhance={() => {
								isActioning = true;
								return async ({ update }) => {
									await update();
									isActioning = false;
									open = false;
								};
							}}
						>
							<input type="hidden" name="itemId" value={item.id} />
							<Button
								type="submit"
								variant="outline"
								size="sm"
								disabled={isActioning}
								class="border-border text-ink-muted hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
							>
								<Trash2 class="mr-1.5 h-3.5 w-3.5" />
								Remove
							</Button>
						</form>
					{/if}
				{/if}

				<!-- Add to shopping list -->
				<div class="ml-auto">
					{#if addedToList}
						<Button
							variant="outline"
							size="sm"
							disabled
							class="border-success-200 text-success-700 bg-success-50"
						>
							<Check class="mr-1.5 h-3.5 w-3.5" />
							Added
						</Button>
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
							<Button
								type="submit"
								variant="outline"
								size="sm"
								disabled={isActioning}
								class="border-info-200 text-info-700 bg-info-50 hover:bg-info-100"
							>
								<ShoppingCart class="mr-1.5 h-3.5 w-3.5" />
								Add to list
							</Button>
						</form>
					{/if}
				</div>
			</AlertDialog.Footer>
		{/if}
	</AlertDialog.Content>
</AlertDialog.Root>
