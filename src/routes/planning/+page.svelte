<script lang="ts">
	import { enhance } from '$app/forms';
	import { Sparkles, ShoppingCart, Trash2, ChefHat } from 'lucide-svelte';
	import WashiTape from '$lib/components/WashiTape.svelte';

	let { data, form } = $props();

	type PlannedMeal = {
		id: string;
		mealName: string;
		mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
		plannedDate: string;
		recipeTitle: string;
		recipeImageUrl: string | null;
		calories: number | null;
	};

	const plannedMeals = $derived(data.plannedMeals as PlannedMeal[]);
	const rangeStart = $derived(new Date(data.rangeStart));
	const rangeEnd = $derived(new Date(data.rangeEnd));

	let calorieLimit = $state(2000);

	let generating = $state(false);
	let activeDayKey = $state<string | null>(null);

	/** Local-time YYYY-MM-DD for Date objects; pass-through for strings already in that format */
	function toDateKey(input: string | Date): string {
		if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}/.test(input)) {
			return input.slice(0, 10);
		}
		const date = new Date(input);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	const dayKeys = $derived.by(() => {
		const days: string[] = [];
		const cursor = new Date(rangeStart);
		while (cursor <= rangeEnd) {
			days.push(toDateKey(cursor));
			cursor.setDate(cursor.getDate() + 1);
		}
		return days;
	});

	const mealsByDate = $derived.by(() => {
		const map = new Map<string, PlannedMeal[]>();
		for (const meal of plannedMeals) {
			const key = meal.plannedDate; // already YYYY-MM-DD from server
			const existing = map.get(key) ?? [];
			existing.push(meal);
			map.set(key, existing);
		}

		for (const key of map.keys()) {
			map.set(
				key,
				(map.get(key) ?? []).slice().sort((a, b) => a.mealType.localeCompare(b.mealType))
			);
		}

		return map;
	});

	function dayLabel(key: string): string {
		return new Date(`${key}T00:00:00`).toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	function dayNum(key: string): string {
		return new Date(`${key}T00:00:00`).getDate().toString();
	}

	const planStartLabel = $derived(dayKeys.length ? dayLabel(dayKeys[0]) : '-');
	const planEndLabel = $derived(dayKeys.length ? dayLabel(dayKeys[dayKeys.length - 1]) : '-');

	function polaroidTilt(index: number): string {
		const classes = ['-rotate-2', 'rotate-1', '-rotate-1', 'rotate-2'];
		return classes[index % classes.length];
	}

	const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
	const visibleDayKeys = $derived.by(() => {
		const todayKey = toDateKey(new Date());
		return dayKeys
			.filter((key) => {
				if (key < todayKey) return false;
				const weekday = new Date(`${key}T00:00:00`).getDay();
				return weekday >= 1 && weekday <= 5;
			})
			.slice(0, 5);
	});

	function shortWeekDay(index: number): string {
		return weekDays[index]!.slice(0, 3);
	}

	const mealTypeEmoji: Record<string, string> = {
		BREAKFAST: 'morning',
		LUNCH: 'midday',
		DINNER: 'evening',
		SNACK: 'snack'
	};

	function isToday(key: string): boolean {
		return key === toDateKey(new Date());
	}

	const enhanceAndRefresh = (dayKey?: string) => {
		return () => {
			generating = true;
			activeDayKey = dayKey ?? null;
			return async ({
				update
			}: {
				update: (opts?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
			}) => {
				await update({ reset: false, invalidateAll: true });
				generating = false;
				activeDayKey = null;
			};
		};
	};
</script>

<svelte:head>
	<title>Meal Planning - Receipt2Recipe</title>
</svelte:head>

<div
	class="paper-card relative min-h-screen overflow-hidden rounded-4xl border border-sand bg-bg-paper shadow-[0_30px_80px_-50px_rgba(45,55,72,0.6)]"
>
	<!-- Radial gradient background (matches recipes page) -->
	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.08),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.08),transparent_28%)]"
	></div>

	<main class="relative z-10 min-h-screen bg-white">
		<div class="mx-auto w-full max-w-6xl px-6 py-8 sm:px-10">
			<!-- Header + Generate form — single compact section -->
			<div class="mb-10">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div>
						<p class="font-hand mb-1 text-lg text-text-secondary">Plan your week</p>
						<h1
							class="font-display text-4xl leading-[1.1] text-text-primary drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]"
						>
							Meal <span class="marker-highlight">Planner</span>
						</h1>
						<p class="font-ui mt-2 text-xs tracking-widest text-text-muted uppercase">
							{planStartLabel} &mdash; {planEndLabel}
							&middot; {plannedMeals.length}
							{plannedMeals.length === 1 ? 'meal' : 'meals'} planned
						</p>
					</div>

					<!-- Action buttons -->
					<div class="flex items-center gap-2">
						{#if plannedMeals.length > 0}
							<form method="POST" action="?/addPlanToShopping" use:enhance={enhanceAndRefresh()}>
								<button
									type="submit"
									disabled={generating}
									class="group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-lg border border-primary-300 bg-white px-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-400 hover:bg-bg-card hover:shadow-md active:scale-95 disabled:opacity-60"
								>
									<ShoppingCart
										class="h-4 w-4 text-primary-600 transition-transform duration-500 group-hover:rotate-12"
									/>
									<span class="font-display text-sm font-medium text-text-primary"
										>Add to Shopping</span
									>
								</button>
							</form>

							<form method="POST" action="?/clearPlan" use:enhance={enhanceAndRefresh()}>
								<button
									type="submit"
									disabled={generating}
									class="group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-lg border border-red-200 bg-white px-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:shadow-md active:scale-95 disabled:opacity-60"
								>
									<Trash2 class="h-4 w-4 text-red-400 group-hover:text-red-500" />
									<span class="font-display text-sm font-medium text-red-500">Clear</span>
								</button>
							</form>
						{/if}
					</div>
				</div>

				<!-- Inline generate form — compact row under the title -->
				<form
					id="planner-form"
					method="POST"
					action="?/generatePlan"
					use:enhance={enhanceAndRefresh()}
					class="mt-5 flex flex-wrap items-end gap-2.5 border-t border-border/50 pt-4"
				>
					<input type="hidden" name="mealsCount" value={Math.max(3, visibleDayKeys.length * 3)} />
					<label class="flex flex-col gap-0.5">
						<span class="font-hand text-[11px] text-text-muted">daily kcal</span>
						<input
							type="number"
							name="calorieLimit"
							min="200"
							step="50"
							bind:value={calorieLimit}
							class="font-hand w-20 rounded-md border border-border bg-bg-paper/60 px-2 py-1 text-center text-sm text-text-primary focus:border-primary-400 focus:ring-1 focus:ring-primary-300 focus:outline-none"
						/>
					</label>

					<button
						type="submit"
						disabled={generating}
						class="group relative inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary-300 bg-white px-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-400 hover:shadow-md active:scale-95 disabled:opacity-60"
					>
						<Sparkles
							class="h-3.5 w-3.5 text-primary-600 transition-transform duration-500 group-hover:rotate-12"
						/>
						<span class="font-display text-sm font-medium text-text-primary">
							{generating ? 'Generating...' : 'Generate Week'}
						</span>
					</button>
				</form>

				{#if form?.error}
					<p class="font-hand mt-2 text-sm text-red-500">{form.error}</p>
				{/if}
			</div>

			<!-- Weekday polaroid board -->
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
				{#each visibleDayKeys as key, dayIdx}
					{@const dayMeals = mealsByDate.get(key) ?? []}
					{@const today = isToday(key)}
					<div
						class="group {polaroidTilt(dayIdx)} transition-transform duration-300 hover:rotate-0"
					>
						<div
							class="relative bg-white p-2 pb-12 shadow-[0_2px_10px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.08)]"
						>
							<WashiTape
								color={dayIdx % 2 === 0 ? 'teal' : 'yellow'}
								class="absolute -top-2 left-1/2 z-10 w-14 -translate-x-1/2"
							/>

							<div class="min-h-44 bg-bg-paper p-2">
								{#if dayMeals.length === 0}
									<div
										class="flex h-full min-h-40 flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-border/40 bg-white/35 px-2"
									>
										<div class="flex w-full flex-col gap-1">
											<p
												class="font-hand rounded-sm border border-border/30 bg-white/70 px-2 py-1 text-center text-xs text-text-secondary"
											>
												Breakfast
											</p>
											<p
												class="font-hand rounded-sm border border-border/30 bg-white/70 px-2 py-1 text-center text-xs text-text-secondary"
											>
												Lunch
											</p>
											<p
												class="font-hand rounded-sm border border-border/30 bg-white/70 px-2 py-1 text-center text-xs text-text-secondary"
											>
												Dinner
											</p>
										</div>
										<form
											method="POST"
											action="?/generateForDay"
											use:enhance={enhanceAndRefresh(key)}
										>
											<input type="hidden" name="plannedDate" value={key} />
											<input type="hidden" name="calorieLimit" value={calorieLimit} />
											<button
												type="submit"
												disabled={generating}
												class="font-hand rounded-md border border-primary-300 bg-white px-2.5 py-1 text-[11px] text-primary-700 transition-colors hover:border-primary-400 hover:bg-bg-card disabled:opacity-60"
											>
												{#if generating && activeDayKey === key}Filling...{:else}Fill Day{/if}
											</button>
										</form>
									</div>
								{:else}
									<div class="space-y-2">
										{#each dayMeals as meal, idx}
											<div
												class="group/meal relative overflow-hidden rounded-sm border border-[#e6dece] bg-white p-1.5 shadow-[0_2px_5px_rgba(0,0,0,0.09)]"
											>
												<div class="relative h-16 overflow-hidden bg-bg-card">
													{#if meal.recipeImageUrl}
														<img
															src={meal.recipeImageUrl}
															alt={meal.recipeTitle}
															class="h-full w-full object-cover"
														/>
													{:else}
														<div class="flex h-full w-full items-center justify-center bg-bg-card">
															<ChefHat class="h-5 w-5 text-text-muted" />
														</div>
													{/if}

													<div
														class="absolute right-1 bottom-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-text-muted uppercase"
													>
														{mealTypeEmoji[meal.mealType] ?? meal.mealType}
													</div>
												</div>
												<p
													class="font-display mt-1 truncate text-center text-[10px] text-text-primary"
													title={meal.recipeTitle}
												>
													{meal.recipeTitle}
												</p>

												{#if meal.calories}
													<div
														class="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover/meal:opacity-100"
													>
														<div
															class="rounded bg-text-primary px-2 py-1 text-[9px] whitespace-nowrap text-white shadow-lg"
														>
															~{meal.calories} kcal
														</div>
													</div>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</div>

							<div
								class="absolute right-0 bottom-0 left-0 flex h-10 flex-col items-center justify-center"
							>
								<p class="font-hand text-sm {today ? 'text-primary-600' : 'text-text-secondary'}">
									{shortWeekDay(dayIdx)}
								</p>
								<p class="font-display text-sm text-text-muted">{dayNum(key)}</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</main>
</div>
