<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import {
		CameraTile,
		DayStrip,
		DoorHeader,
		DoorNav,
		FreshnessDots,
		IndexCardTile,
		PolaroidCard,
		ReceiptSlip,
		SlimState,
		type EmptyArtName,
		type StripDay
	} from '$lib/components/doors';
	import { greetingFor, nextRange, type DayRange } from '$lib/services/doors';
	import { getMe } from '$lib/remote/household/household.remote';

	const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const dishes: Record<number, { name: string; hue: number }> = {
		0: { name: 'Shakshuka', hue: 12 },
		1: { name: 'Chicken tacos', hue: 38 },
		3: { name: 'Pea gnocchi', hue: 110 },
		6: { name: 'Lentil dal', hue: 48 }
	};
	const days: StripDay[] = Array.from({ length: 10 }, (_, day) => ({
		day,
		weekday: weekdays[day % 7],
		date: 16 + day,
		dish: dishes[day] ?? null,
		shopDay: day % 7 === 3
	}));

	let range = $state<DayRange | null>({ start: 1, end: 4 });
	let picking = $state(false);
	let tapped = $state(0);

	function pick(day: number) {
		const next = nextRange(range, day, picking);
		range = next.range;
		picking = next.picking;
	}

	const receiptLines = [
		{ name: 'Spinach', qty: 1, price: 1.89 },
		{ name: 'Chicken thighs', qty: 2, price: 7.4 },
		{ name: 'Feta', qty: 1, price: 2.29 },
		{ name: 'Tortillas', qty: 1, price: 1.65 }
	];

	const arts: EmptyArtName[] = ['plate', 'basket', 'jar', 'book', 'cal', 'receipt'];
	const freshness = [-1, 0, 1, 2, 3, 6];
</script>

<svelte:head>
	<title>Door components - Receipt2Recipe</title>
</svelte:head>

<div id="door-components" class="mx-auto max-w-3xl space-y-12 pb-16">
	<section aria-labelledby="dev-header" class="space-y-4">
		<h2 id="dev-header" class="text-xs font-semibold tracking-widest text-text-muted uppercase">
			DoorHeader
		</h2>
		<DoorHeader question="What's for *dinner*?" greeting={greetingFor(18, 'Noor')}>
			{#snippet actions()}
				<Button variant="outline" size="sm">Needs you</Button>
			{/snippet}
		</DoorHeader>
		<DoorHeader question="What needs eating *first*?" greeting={greetingFor(9, 'Sam')} />
		{#if page.data.user}
			<svelte:boundary>
				{@const me = await getMe()}
				<DoorHeader
					question="What's the *plan*?"
					greeting="{greetingFor(new Date().getHours(), me.displayName)} ({me.householdName})"
				/>
				{#snippet pending()}
					<p class="font-hand text-text-muted">Asking who you are…</p>
				{/snippet}
				{#snippet failed()}
					<p class="text-sm text-danger-600">getMe failed.</p>
				{/snippet}
			</svelte:boundary>
		{/if}
	</section>

	<section aria-labelledby="dev-nav" class="space-y-4">
		<h2 id="dev-nav" class="text-xs font-semibold tracking-widest text-text-muted uppercase">
			DoorNav
		</h2>
		<DoorNav placement="header" />
		<div class="relative overflow-hidden rounded-xl border border-border">
			<DoorNav placement="bottom" class="static!" />
		</div>
	</section>

	<section aria-labelledby="dev-paper" class="space-y-4">
		<h2 id="dev-paper" class="text-xs font-semibold tracking-widest text-text-muted uppercase">
			PolaroidCard and ReceiptSlip
		</h2>
		<div class="grid gap-8 sm:grid-cols-2">
			<PolaroidCard caption="Shakshuka with feta">
				<div class="h-36 bg-linear-to-br from-[hsl(12_70%_80%)] to-[hsl(12_40%_48%)]"></div>
			</PolaroidCard>
			<ReceiptSlip store="Delhaize" when="Thu 19 Nov, 18:12" lines={receiptLines} total={13.23} />
		</div>
	</section>

	<section aria-labelledby="dev-tiles" class="space-y-4">
		<h2 id="dev-tiles" class="text-xs font-semibold tracking-widest text-text-muted uppercase">
			CameraTile and IndexCardTile
		</h2>
		<div class="grid max-w-sm grid-cols-2 gap-3">
			<CameraTile label="Scan a receipt" onclick={() => (tapped += 1)} />
			<IndexCardTile label="Write one down" onclick={() => (tapped += 1)} />
			<CameraTile
				label="Snap a recipe card"
				subject="recipe"
				wide
				class="col-span-2"
				tilt={-0.5}
				onclick={() => (tapped += 1)}
			/>
		</div>
		<p class="text-sm text-text-muted" aria-live="polite">Tiles tapped: {tapped}</p>
	</section>

	<section aria-labelledby="dev-strip" class="space-y-4">
		<h2 id="dev-strip" class="text-xs font-semibold tracking-widest text-text-muted uppercase">
			DayStrip
		</h2>
		<DayStrip {days} {range} onpick={pick} />
		<p class="font-hand text-text-secondary" aria-live="polite">
			{#if range}
				{picking
					? 'Now tap the last day.'
					: `Planning ${days[range.start].weekday} ${days[range.start].date} to ${days[range.end].weekday} ${days[range.end].date}.`}
			{/if}
		</p>
	</section>

	<section aria-labelledby="dev-fresh" class="space-y-4">
		<h2 id="dev-fresh" class="text-xs font-semibold tracking-widest text-text-muted uppercase">
			FreshnessDots
		</h2>
		<ul class="grid gap-2">
			{#each freshness as daysLeft (daysLeft)}
				<li class="flex items-center gap-3 text-sm">
					<FreshnessDots {daysLeft} />
					<span class="text-text-secondary">{daysLeft} days left</span>
				</li>
			{/each}
		</ul>
	</section>

	<section aria-labelledby="dev-slim" class="space-y-4">
		<h2 id="dev-slim" class="text-xs font-semibold tracking-widest text-text-muted uppercase">
			SlimState and EmptyState
		</h2>
		<SlimState art="basket" title="Nothing to buy" hand="Everything for the week is home." />
		<SlimState art="cal" title="No plan yet" hand="Pick a few days above." />
		<div class="grid gap-4 sm:grid-cols-3">
			{#each arts as art (art)}
				<EmptyState {art} title="Empty {art}" description="Whole-screen empty state with art." />
			{/each}
		</div>
	</section>
</div>
