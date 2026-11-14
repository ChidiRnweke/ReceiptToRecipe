<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import { CameraTile, ReceiptSlip } from '$lib/components/doors';
	import { confirmWhatCameHome, getReceiptResult, snapReceipt } from '$lib/remote/shop/shop.remote';
	import { staysLine } from '$lib/services/shop';

	interface Props {
		open: boolean;
		/** Called with the toast after "Looks right". */
		onconfirmed: (message: string) => void;
	}

	let { open = $bindable(), onconfirmed }: Props = $props();

	/** How often the sheet asks again while the receipt is being read. */
	const POLL_MS = 1500;

	let receiptId = $state<string | null>(null);
	let confirming = $state(false);
	let failed = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	const result = $derived(receiptId ? getReceiptResult(receiptId) : null);
	const reading = $derived(
		result?.current
			? result.current.status === 'QUEUED' || result.current.status === 'PROCESSING'
			: !!receiptId
	);

	// Poll by refreshing the query while OCR runs.
	$effect(() => {
		if (!result || !reading) return;
		const timer = setTimeout(() => result.refresh(), POLL_MS);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		if (!open) {
			receiptId = null;
			failed = null;
		}
	});

	async function looksRight() {
		if (!receiptId) return;
		confirming = true;
		try {
			const { message } = await confirmWhatCameHome({ receiptId });
			open = false;
			onconfirmed(message);
		} catch {
			failed = 'That didn’t go through. Try again in a moment.';
		} finally {
			confirming = false;
		}
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side="bottom"
		class="max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-bg-paper px-4 pb-6"
	>
		{#if !receiptId}
			<Sheet.Header class="px-0 pb-0">
				<Sheet.Title class="font-display text-2xl text-ink">Snap the receipt</Sheet.Title>
				<Sheet.Description class="text-sm text-text-muted">
					A photo of the receipt fills the kitchen. Nothing to type.
				</Sheet.Description>
			</Sheet.Header>
			<form
				{...snapReceipt.enhance(async ({ submit }) => {
					failed = null;
					try {
						await submit();
					} catch {
						failed = 'The photo didn’t upload. Try again.';
						return;
					}
					const issue = snapReceipt.fields.receipt.issues()?.[0];
					if (issue) failed = issue.message;
					else if (snapReceipt.result) receiptId = snapReceipt.result.receiptId;
				})}
				enctype="multipart/form-data"
				class="grid gap-3"
			>
				<input
					bind:this={fileInput}
					{...snapReceipt.fields.receipt.as('file')}
					accept="image/*"
					capture="environment"
					class="sr-only"
					onchange={(event) => event.currentTarget.form?.requestSubmit()}
				/>
				<CameraTile
					label={snapReceipt.pending ? 'Uploading…' : 'Take or choose a photo'}
					wide
					tilt={-0.5}
					onclick={() => fileInput?.click()}
				/>
				{#if failed}
					<p class="text-sm text-sienna-700" role="alert">{failed}</p>
				{/if}
			</form>
		{:else if !result?.current || reading}
			<Sheet.Header class="px-0 pb-0">
				<Sheet.Title class="font-display text-2xl text-ink">Snap the receipt</Sheet.Title>
				<Sheet.Description class="sr-only">The receipt is being read.</Sheet.Description>
			</Sheet.Header>
			<p class="font-hand text-xl text-ink-light" aria-live="polite">Reading it…</p>
		{:else if result.current.status === 'FAILED'}
			<Sheet.Header class="px-0 pb-0">
				<Sheet.Title class="font-display text-2xl text-ink">That one didn’t read</Sheet.Title>
				<Sheet.Description class="text-sm text-text-muted">
					{result.current.error ?? 'The photo could not be read.'}
				</Sheet.Description>
			</Sheet.Header>
			<Button variant="secondary" class="h-11 w-full" onclick={() => (receiptId = null)}>
				Try another photo
			</Button>
		{:else}
			{@const done = result.current}
			<Sheet.Header class="px-0 pb-0">
				<Sheet.Title class="font-display text-2xl text-ink">Here’s what came home</Sheet.Title>
				<Sheet.Description class="sr-only">The receipt, matched to your list.</Sheet.Description>
			</Sheet.Header>
			{#if done.slip}
				<ReceiptSlip
					store={done.slip.store}
					when={done.slip.when}
					lines={done.slip.lines}
					total={done.slip.total}
					currency={done.slip.currency}
				/>
			{/if}
			{#if done.cameHome}
				{@const came = done.cameHome}
				<ul
					class="rounded-2xl border border-border bg-bg-card px-3 py-1"
					aria-label="What came home"
				>
					{#if came.fromList}
						<li class="flex items-center gap-2.5 border-b border-dashed border-border py-2 text-sm">
							<span class="grid size-6 place-items-center rounded-full bg-sage-100 text-sage-800"
								>✓</span
							>
							<span class="flex-1 text-ink">
								{came.matched} thing{came.matched === 1 ? '' : 's'} matched your list
							</span>
						</li>
					{/if}
					{#each came.extras as extra, i (i)}
						<li class="flex items-center gap-2.5 border-b border-dashed border-border py-2 text-sm">
							<span class="grid size-6 place-items-center rounded-full bg-sage-100 text-sage-800"
								>+</span
							>
							<span class="flex-1 text-ink">
								{extra.name}{extra.amount ? `, ${extra.amount}` : ''}<br />
								<span class="text-xs text-text-muted"
									>{came.fromList
										? 'wasn’t on the list, so it’s added'
										: 'added to the kitchen'}</span
								>
							</span>
						</li>
					{/each}
					{#each came.missing as item, i (i)}
						<li class="flex items-center gap-2.5 border-b border-dashed border-border py-2 text-sm">
							<span class="grid size-6 place-items-center rounded-full bg-warning-50 text-[#92560a]"
								>−</span
							>
							<span class="flex-1 text-ink">
								{item.name}<br />
								<span class="text-xs text-text-muted">{staysLine(item.name)}</span>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
			{#if failed}
				<p class="text-sm text-sienna-700" role="alert">{failed}</p>
			{/if}
			<Button
				class="h-11 w-full bg-sage-600 text-base text-white hover:bg-sage-700"
				disabled={confirming}
				onclick={looksRight}
			>
				Looks right
			</Button>
		{/if}
	</Sheet.Content>
</Sheet.Root>
