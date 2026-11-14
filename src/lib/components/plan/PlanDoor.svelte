<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { DayStrip, DoorHeader, SlimState, type StripDay } from '$lib/components/doors';
	import RecipePhoto from '$lib/components/tonight/RecipePhoto.svelte';
	import type { PlanIdea, PlanRange, PlanSlot, PrepMeal } from '$lib/models/plan';
	import { nextRange, type DayRange } from '$lib/services/doors';
	import { pickingLine } from '$lib/services/plan';
	import { weekdayName } from '$lib/services/tonight';
	import {
		cookForTwoDays,
		discoverRecipe,
		getPlan,
		markPrepDone,
		pickRange,
		planBatchPrep,
		planWholeWeek,
		removeSlot,
		setSlot,
		suggestRest
	} from '$lib/remote/plan/plan.remote';
	import { notice } from '$lib/state/notice.svelte';
	import MealSheet from './MealSheet.svelte';
	import PickSheet, { type PickTarget } from './PickSheet.svelte';
	import PrepSection from './PrepSection.svelte';
	import SectionLabel from './SectionLabel.svelte';
	import SlotRow from './SlotRow.svelte';

	/** The range the member picked; the default stretch until then. */
	let picked = $state<PlanRange | undefined>(undefined);
	/** The first day while the member picks the last one. */
	let pickStart = $state<number | null>(null);
	let busy = $state(false);

	let pickOpen = $state(false);
	let pickTarget = $state<PickTarget | null>(null);
	let mealOpen = $state(false);
	let openSlot = $state<PlanSlot | null>(null);

	const view = $derived(await getPlan(picked));

	const stripDays: StripDay[] = $derived(
		view.days.map((d) => ({
			day: d.day,
			weekday: weekdayName(d.weekday).slice(0, 3),
			date: d.date,
			dish: d.dish,
			shopDay: d.shopDay
		}))
	);
	const stripRange: DayRange = $derived(
		pickStart !== null
			? { start: pickStart, end: pickStart }
			: { start: view.stretch.start, end: view.stretch.end - 1 }
	);
	const showPrepPrompt = $derived(
		view.prep === null && view.nextPrepDay !== null && view.nextPrepDay - view.today <= 2
	);

	const slotName = (slot: { mealType: string }) => (slot.mealType === 'LUNCH' ? 'lunch' : 'dinner');
	const slotTitle = (slot: PlanSlot) => `${weekdayName(slot.weekday)} ${slotName(slot)}`;

	async function run<T>(action: () => Promise<T>, onDone?: (result: T) => void) {
		busy = true;
		try {
			const result = await action();
			await getPlan(picked).refresh();
			onDone?.(result);
		} catch {
			notice.show('That didn’t go through. Try again in a moment.');
		} finally {
			busy = false;
		}
	}

	const toast = (result: { message: string }) => notice.show(result.message);

	function tapDay(day: number) {
		const picking = pickStart !== null;
		const next = nextRange(picking ? { start: pickStart!, end: pickStart! } : null, day, picking);
		if (next.picking) {
			pickStart = next.range.start;
			return;
		}
		pickStart = null;
		const range = { start: next.range.start, end: next.range.end + 1 };
		busy = true;
		pickRange(range)
			.then((stretch) => (picked = { start: stretch.start, end: stretch.end }))
			.catch(() => notice.show('That didn’t go through. Try again in a moment.'))
			.finally(() => (busy = false));
	}

	function fill() {
		run(() => (view.style === 'week' ? planWholeWeek(picked) : suggestRest(picked)), toast);
	}

	function openRow(slot: PlanSlot) {
		if (slot.meal) {
			openSlot = slot;
			mealOpen = true;
			return;
		}
		pickTarget = { day: slot.day, mealType: slot.mealType, title: slotTitle(slot) };
		pickOpen = true;
	}

	function pick(idea: PlanIdea) {
		const target = pickTarget;
		if (!target) return;
		run(
			() =>
				setSlot({
					day: target.day,
					mealType: target.mealType,
					recipeId: idea.recipeId,
					replaceId: target.replaceId
				}),
			(result) => {
				pickOpen = false;
				toast(result);
			}
		);
	}

	function swap() {
		const slot = openSlot;
		if (!slot?.meal) return;
		mealOpen = false;
		pickTarget = {
			day: slot.day,
			mealType: slot.mealType,
			title: slotTitle(slot),
			replaceId: slot.meal.plannedMealId,
			exclude: slot.meal.recipeId ? [slot.meal.recipeId] : []
		};
		pickOpen = true;
	}

	function swapPrep(meal: PrepMeal) {
		if (!view.prep) return;
		pickTarget = {
			day: view.prep.day,
			mealType: 'PREP',
			title: `${weekdayName(view.prep.weekday)} prep`,
			replaceId: meal.plannedMealId,
			exclude: meal.recipeId ? [meal.recipeId] : []
		};
		pickOpen = true;
	}

	function twoDays() {
		const meal = openSlot?.meal;
		if (!meal) return;
		run(
			() => cookForTwoDays({ plannedMealId: meal.plannedMealId }),
			(result) => {
				mealOpen = false;
				toast(result);
			}
		);
	}

	function remove() {
		const meal = openSlot?.meal;
		if (!meal) return;
		run(
			() => removeSlot({ plannedMealId: meal.plannedMealId }),
			() => (mealOpen = false)
		);
	}

	function discover(idea: PlanIdea) {
		run(
			() => discoverRecipe({ recipeId: idea.recipeId, range: picked }),
			(result) => {
				if (result.planned) toast(result);
				else goto(resolve('/recipes/[id]', { id: idea.recipeId }));
			}
		);
	}

	function prepDone() {
		const prep = view.prep;
		if (!prep) return;
		run(() => markPrepDone({ day: prep.day }), toast);
	}

	function planPrep() {
		const day = view.nextPrepDay;
		if (day === null) return;
		run(() => planBatchPrep({ day }), toast);
	}
</script>

<div class="mx-auto grid max-w-md gap-3 pb-8">
	<DoorHeader greeting={view.greeting} question={view.question} />

	{#if view.prep}
		<SectionLabel>Prep · {weekdayName(view.prep.weekday)}</SectionLabel>
		<PrepSection prep={view.prep} {busy} ondone={prepDone} onswap={swapPrep} />
		<SectionLabel>Meals</SectionLabel>
	{:else if showPrepPrompt && view.nextPrepDay !== null && view.prepDay !== null}
		<SectionLabel>Prep · {weekdayName(view.prepDay)}</SectionLabel>
		<section class="grid gap-2 rounded-2xl border border-border bg-white p-3">
			<h3 class="text-base font-semibold text-ink">No prep planned</h3>
			<Button variant="secondary" size="sm" disabled={busy} onclick={planPrep}>
				Plan the prep
			</Button>
		</section>
		<SectionLabel>Meals</SectionLabel>
	{/if}

	{#if view.slim}
		<SlimState art="cal" title="No plan needed" hand="Only if you feel like it." />
	{/if}

	<DayStrip
		days={stripDays}
		range={stripRange}
		onpick={tapDay}
		label="Days to plan. Tap a day to stretch or shorten."
	/>

	<div class="flex items-center justify-between gap-2 px-0.5">
		<p class="font-hand text-lg leading-snug text-ink-light" aria-live="polite">
			{#if pickStart !== null}
				{pickingLine(pickStart)} <span class="text-sienna-700">Now tap the last day.</span>
			{:else}
				{view.stretchLine} <span class="text-text-muted">Tap a first day to change it.</span>
			{/if}
		</p>
		{#if view.gaps.length && pickStart === null}
			<Button
				size="sm"
				class="shrink-0 bg-sage-600 text-white hover:bg-sage-700"
				disabled={busy}
				onclick={fill}
			>
				{view.fillLabel}
			</Button>
		{/if}
	</div>

	<div class="grid gap-1.5">
		{#each view.slots as slot (`${slot.day}-${slot.mealType}`)}
			<SlotRow {slot} onopen={openRow} />
		{/each}
	</div>

	{#if view.discover.length}
		<SectionLabel>Something new</SectionLabel>
		<div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
			{#each view.discover as idea (idea.recipeId)}
				<button
					type="button"
					disabled={busy}
					onclick={() => discover(idea)}
					class="grid w-33 flex-none gap-1.25 rounded-xl border border-border bg-white p-1.75 text-left transition hover:border-sage-300 focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none"
				>
					<RecipePhoto title={idea.title} imageUrl={idea.imageUrl} class="h-17.5! rounded-lg" />
					<b class="text-[13px] leading-tight text-ink">{idea.title}</b>
					<span class="text-xs text-text-muted"
						>{idea.minutes ? `${idea.minutes} min` : ''}{idea.missing.length
							? ''
							: `${idea.minutes ? ' · ' : ''}all home`}</span
					>
				</button>
			{/each}
		</div>
	{/if}

	{#if view.toBuy > 0}
		<Button href={resolve('/shop')} variant="secondary" class="h-10 w-full">
			{view.toBuy} thing{view.toBuy === 1 ? '' : 's'} to buy for these →
		</Button>
	{/if}
</div>

<PickSheet bind:open={pickOpen} target={pickTarget} {busy} onpick={pick} />
<MealSheet
	bind:open={mealOpen}
	meal={openSlot?.meal ?? null}
	when={openSlot ? slotTitle(openSlot) : ''}
	{busy}
	onswap={swap}
	ontwodays={twoDays}
	onremove={remove}
/>
