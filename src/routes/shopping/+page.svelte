<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Badge } from '$lib/components/ui/badge';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import {
		ShoppingCart,
		Plus,
		Trash2,
		Sparkles,
		ListPlus,
		ChevronDown,
		ChevronUp,
		Check,
		ChefHat,
		AlertTriangle,
		Lightbulb,
		X
	} from 'lucide-svelte';
	import { workflowStore } from '$lib/state/workflow.svelte';
	import Notepad from '$lib/components/Notepad.svelte';
	import PinnedNote from '$lib/components/PinnedNote.svelte';
	import WashiTape from '$lib/components/WashiTape.svelte';

	// Pantry warning state
	let pantryWarning = $state<{
		show: boolean;
		message: string;
		matchedItem: string;
		confidence: number;
		pendingItem: {
			name: string;
			quantity: string;
			unit: string;
			listId: string;
		} | null;
	}>({
		show: false,
		message: '',
		matchedItem: '',
		confidence: 0,
		pendingItem: null
	});

	function getRecipeInfo(recipeId: string | null) {
		if (!recipeId || !data.recipeMap) return null;
		return data.recipeMap[recipeId] || null;
	}

	let { data, form } = $props();

	// Use $derived for state but allow overrides for optimistic UI
	let lists = $derived(data.lists ?? []);

	let loading = $state(false);
	let newListName = $state('');
	let expandedLists = $derived<Set<string>>(new Set(lists.slice(0, 1).map((l: any) => l.id)));

	// New item inputs per list
	type NewItemInput = { name: string; quantity: string; unit: string };
	let newItemInputs = $state<Record<string, NewItemInput>>({});

	// Ensure each list has an input state without mutating inside the template.
	$effect(() => {
		const next: Record<string, NewItemInput> = {};
		let changed = false;

		for (const list of lists) {
			const existing = newItemInputs[list.id];
			next[list.id] = existing ?? { name: '', quantity: '1', unit: '' };
			if (!existing) changed = true;
		}

		if (Object.keys(newItemInputs).length !== Object.keys(next).length || changed) {
			newItemInputs = next;
		}
	});

	function toggleList(listId: string) {
		if (expandedLists.has(listId)) {
			expandedLists.delete(listId);
		} else {
			expandedLists.add(listId);
		}
		expandedLists = new Set(expandedLists);
	}

	function getCompletionPercentage(items: any[]) {
		if (items.length === 0) return 0;
		const checked = items.filter((i) => i.checked).length;
		return Math.round((checked / items.length) * 100);
	}

	// Force add item bypassing pantry check
	async function forceAddItem() {
		if (!pantryWarning.pendingItem) return;

		const listId = pantryWarning.pendingItem.listId;
		const formData = new FormData();
		formData.append('listId', listId);
		formData.append('name', pantryWarning.pendingItem.name);
		formData.append('quantity', pantryWarning.pendingItem.quantity);
		formData.append('unit', pantryWarning.pendingItem.unit);
		formData.append('skipPantryCheck', 'true');

		pantryWarning = {
			show: false,
			message: '',
			matchedItem: '',
			confidence: 0,
			pendingItem: null
		};

		// Clear the input for this list
		newItemInputs = {
			...newItemInputs,
			[listId]: { name: '', quantity: '1', unit: '' }
		};

		workflowStore.incrementShopping();

		const response = await fetch('?/addItem', {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			await invalidateAll();
		} else {
			workflowStore.decrementShopping();
		}
	}

	function dismissPantryWarning() {
		if (pantryWarning.pendingItem) {
			const listId = pantryWarning.pendingItem.listId;
			// Clear the input for this list
			newItemInputs = {
				...newItemInputs,
				[listId]: { name: '', quantity: '1', unit: '' }
			};
		}
		pantryWarning = {
			show: false,
			message: '',
			matchedItem: '',
			confidence: 0,
			pendingItem: null
		};
	}

	function groupItemsBySource(items: any[]) {
		const groups: Record<string, any[]> = {
			Other: []
		};

		for (const item of items) {
			if (item.fromRecipeId) {
				const recipe = getRecipeInfo(item.fromRecipeId);
				const groupName = recipe ? `For: ${recipe.title}` : 'Recipe Items';
				if (!groups[groupName]) groups[groupName] = [];
				groups[groupName].push(item);
			} else {
				groups['Other'].push(item);
			}
		}

		// Move Other to end
		const other = groups['Other'];
		delete groups['Other'];

		return {
			...groups,
			...(other.length > 0 ? { 'Manual & Suggestions': other } : {})
		};
	}
</script>

<svelte:head>
	<title>Shopping Lists - Receipt2Recipe</title>
</svelte:head>

<div class="relative min-h-screen overflow-x-hidden bg-bg-paper p-4 font-sans md:p-8">
	<!-- Desk Texture -->
	<div class="pointer-events-none absolute inset-0"></div>

	<div class="relative z-10 mx-auto max-w-6xl">
		<!-- Header Area -->
		<div class="mb-10 flex flex-col items-center text-center">
			<h1 class="font-display text-5xl text-ink drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
				The Market <span class="marker-highlight">List</span>
			</h1>
			<div
				class="font-ui text-fg-muted mt-2 flex items-center gap-2 text-[10px] tracking-widest uppercase"
			>
				<span>Prepared for</span>
				<span class="text-accent-600 border-accent-200 border-b font-bold">you</span>
			</div>
		</div>

		{#if form?.error}
			<div
				class="mx-auto mb-6 max-w-lg rounded-lg border border-sienna-100 bg-sienna-50 p-3 text-center text-sm text-sienna-700 shadow-sm"
			>
				{form.error}
			</div>
		{/if}

		<div class="grid items-start gap-6 lg:grid-cols-12 lg:gap-12">
			<!-- LEFT SIDEBAR: Suggestions & Quick Actions -->
			<div class="order-2 space-y-8 lg:order-1 lg:col-span-4">
				<!-- Smart Suggestions Note -->
				<PinnedNote color="yellow" rotate="-rotate-1">
					<div class="mb-3 flex items-center gap-2 border-b border-yellow-200/50 pb-2">
						<Sparkles class="h-4 w-4 text-amber-600" />
						<h3 class="font-hand text-xl font-bold text-ink/80">Stock Gaps?</h3>
					</div>

					<p class="font-hand mb-4 text-sm leading-relaxed text-ink/70">
						Based on what you usually buy, you might be on these essentials:
					</p>

					{#if data.suggestions && data.suggestions.length > 0}
						<ul class="mb-4 space-y-1">
							{#each data.suggestions.slice(0, 5) as suggestion}
								<li class="group flex items-center justify-between">
									<span class="font-hand text-lg text-ink/90">{suggestion.itemName}</span>
									<form
										method="POST"
										action="?/addSuggestion"
										use:enhance={() => {
											workflowStore.incrementShopping();
											return async ({ result }) => {
												if (result.type === 'failure') {
													workflowStore.decrementShopping();
												} else {
													await invalidateAll();
												}
											};
										}}
									>
										<input type="hidden" name="listId" value={data.activeList?.id} />
										<input type="hidden" name="itemName" value={suggestion.itemName} />
										<input
											type="hidden"
											name="suggestedQuantity"
											value={suggestion.suggestedQuantity || ''}
										/>
										<input
											type="hidden"
											name="avgFrequencyDays"
											value={suggestion.avgFrequencyDays || ''}
										/>
										<input type="hidden" name="lastPurchased" value={suggestion.lastPurchased} />
										<input
											type="hidden"
											name="daysSinceLastPurchase"
											value={suggestion.daysSinceLastPurchase}
										/>

										<Button
											type="submit"
											variant="ghost"
											size="icon"
											title="Add to list"
											class="text-amber-700 opacity-40 transition-all group-hover:opacity-100 hover:scale-110 hover:bg-transparent"
										>
											<Plus class="h-4 w-4" />
										</Button>
									</form>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="font-hand mb-4 text-sm text-ink/40 italic">
							No suggestions yet. Keep scanning receipts!
						</p>
					{/if}

					<div class="border-t border-yellow-200/50 pt-2">
						<form method="POST" action="?/generateRestock" use:enhance={() => {}}>
							<Button
								type="submit"
								variant="ghost"
								class="group flex w-full items-center justify-start gap-2 p-0 hover:bg-transparent"
							>
								<div
									class="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 transition-colors group-hover:bg-amber-200"
								>
									<Sparkles class="h-3 w-3 text-amber-700" />
								</div>
								<span
									class="font-hand text-lg text-ink/80 decoration-amber-300 decoration-wavy group-hover:underline"
									>Generate full restock list</span
								>
							</Button>
						</form>
					</div>
				</PinnedNote>

				<!-- Quick Actions Card (Small) -->
				<div
					class="border-surface-secondary relative mx-auto max-w-xs rotate-2 rounded-sm border bg-white p-6 shadow-[2px_3px_5px_rgba(0,0,0,0.05)] lg:mx-0"
				>
					<div class="absolute -top-3 left-1/2 -translate-x-1/2">
						<WashiTape color="sage" width="w-24" />
					</div>

					<h3 class="font-ui text-fg-muted mt-2 mb-4 text-center text-xs tracking-widest uppercase">
						Quick Actions
					</h3>

					<div class="space-y-3">
						<Button variant="outline" class="w-full justify-start font-serif" href="/recipes">
							<ChefHat class="text-fg-muted mr-2 h-4 w-4" />
							Browse Recipes
						</Button>

						<form
							method="POST"
							action="?/createList"
							use:enhance={() => {
								loading = true;
								return async ({ result }) => {
									loading = false;
									if (result.type === 'success') {
										newListName = '';
										await invalidateAll();
									}
								};
							}}
							class="flex flex-col gap-2 border-t border-dashed border-border pt-2"
						>
							<span class="text-fg-muted text-xs font-medium">Start a new list:</span>
							<div class="flex gap-2">
								<Input
									type="text"
									name="name"
									placeholder="e.g. Sunday Dinner..."
									bind:value={newListName}
									class="h-8 text-xs"
								/>
								<Button
									type="submit"
									size="sm"
									class="h-8"
									disabled={loading || !newListName.trim()}
								>
									<ListPlus class="h-3.5 w-3.5" />
								</Button>
							</div>
						</form>
					</div>
				</div>
			</div>

			<!-- CENTER: The Main Notepad -->
			<div class="order-1 lg:order-2 lg:col-span-8">
				<Notepad class="min-h-150 w-full shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)]">
					<div class="px-2 py-2 sm:px-4">
						{#if lists.length === 0}
							<div class="flex flex-col items-center justify-center py-20 text-center opacity-60">
								<ShoppingCart class="text-fg-muted mb-4 h-16 w-16" />
								<h3 class="font-hand text-3xl text-ink">Your list is empty</h3>
								<p class="mx-auto mt-2 max-w-xs font-serif text-ink-light">
									Create a list or generate one from your recipes to get started.
								</p>
							</div>
						{:else}
							{#each lists as list}
								{@const completion = getCompletionPercentage(list.items || [])}
								{@const isExpanded = expandedLists.has(list.id)}

								<div class="mb-8 last:mb-0">
									<!-- List Header (Handwritten Style) -->
									<div
										role="button"
										tabindex="0"
										class="group focus:ring-accent-400 mb-4 flex cursor-pointer items-center justify-between rounded-sm border-b-2 border-border pb-2 select-none focus:ring-2 focus:outline-none"
										onclick={() => toggleList(list.id)}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												toggleList(list.id);
											}
										}}
									>
										<div class="flex items-end gap-3">
											<h2 class="font-hand pt-2 text-3xl leading-none font-bold text-ink">
												{list.name}
											</h2>
											<span class="font-ui text-fg-muted mb-1 text-xs">
												{list.items?.length || 0} items
											</span>
										</div>

										<div class="flex items-center gap-3">
											{#if list.items?.length > 0}
												<div class="hidden items-center gap-2 sm:flex">
													<div class="h-1.5 w-16 rounded-full bg-muted/50">
														<div
															class="bg-accent-500 h-1.5 rounded-full transition-all"
															style="width: {completion}%"
														></div>
													</div>
												</div>
											{/if}

											<div
												class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
											>
												<!-- svelte-ignore a11y_click_events_have_key_events -->
												<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
												<form
													method="POST"
													action="?/deleteList"
													use:enhance={() => async () => invalidateAll()}
													onclick={(e) => e.stopPropagation()}
												>
													<input type="hidden" name="listId" value={list.id} />
													<Button
														type="submit"
														variant="ghost"
														size="icon"
														class="text-fg-muted hover:bg-transparent hover:text-red-500"
														aria-label="Delete list"
													>
														<Trash2 class="h-4 w-4" />
													</Button>
												</form>
											</div>

											{#if isExpanded}
												<ChevronUp class="text-fg-muted h-5 w-5" />
											{:else}
												<ChevronDown class="text-fg-muted h-5 w-5" />
											{/if}
										</div>
									</div>

									{#if isExpanded}
										<div class="space-y-6 pr-1 pl-1 sm:pl-4">
											<!-- Add Item Input (Underlined style) -->
											{#key list.id}
												{@const input = newItemInputs[list.id] ?? {
													name: '',
													quantity: '1',
													unit: ''
												}}
												<form
													method="POST"
													action="?/addItem"
													use:enhance={() => {
														workflowStore.incrementShopping();
														return async ({ result }) => {
															if (result.type === 'success') {
																const data = result.data as any;
																if (data?.pantryWarning) {
																	workflowStore.decrementShopping();
																	pantryWarning = {
																		show: true,
																		message: data.warningMessage,
																		matchedItem: data.matchedItem,
																		confidence: data.confidence,
																		pendingItem: data.pendingItem
																	};
																	return;
																}
																newItemInputs = {
																	...newItemInputs,
																	[list.id]: {
																		name: '',
																		quantity: '1',
																		unit: ''
																	}
																};
																await invalidateAll();
															} else {
																workflowStore.decrementShopping();
															}
														};
													}}
													class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-baseline"
												>
													<input type="hidden" name="listId" value={list.id} />

													<div class="relative flex-1">
														<input
															type="text"
															name="name"
															placeholder="Add an item..."
															bind:value={input.name}
															class="border-border-muted focus:border-accent-500 placeholder:text-fg-muted placeholder:font-hand w-full border-b border-none bg-transparent px-0 py-1 font-serif text-lg text-ink placeholder:text-xl focus:ring-0"
														/>
													</div>

													<div class="flex items-baseline gap-2">
														<div class="relative w-12">
															<input
																type="text"
																name="quantity"
																placeholder="#"
																bind:value={input.quantity}
																class="border-border-muted font-ui focus:border-accent-500 placeholder:text-fg-muted w-full border-b border-none bg-transparent px-0 py-1 text-right text-sm focus:ring-0"
															/>
														</div>

														<div class="relative w-16">
															<input
																type="text"
																name="unit"
																placeholder="Unit"
																bind:value={input.unit}
																class="border-border-muted font-ui focus:border-accent-500 placeholder:text-fg-muted w-full border-b border-none bg-transparent px-0 py-1 text-sm focus:ring-0"
															/>
														</div>

														<Button
															type="submit"
															variant="ghost"
															size="icon"
															class="text-fg-muted hover:text-accent-600 hover:bg-transparent"
														>
															<Plus class="h-5 w-5" />
														</Button>
													</div>
												</form>
											{/key}

											<!-- Items List -->
											{#if list.items && list.items.length > 0}
												{@const groups = groupItemsBySource(list.items)}

												{#each Object.entries(groups) as [groupName, items]}
													<div class="relative">
														<!-- Group Header (Sticky Note Style if Recipe) -->
														{#if groupName !== 'Manual & Suggestions'}
															<div class="mt-4 mb-2 flex items-center gap-2">
																<span
																	class="bg-accent-100 text-accent-800 font-ui inline-block rounded-sm px-2 py-0.5 text-[10px] tracking-widest uppercase"
																>
																	{groupName}
																</span>
																<div class="h-px flex-1 bg-border"></div>
															</div>
														{/if}

														<ul class="space-y-0">
															{#each items as item}
																<li
																	class="group relative flex items-start border-b border-dashed border-blue-200/50 py-3 transition-colors hover:bg-amber-50/30"
																>
																	<!-- Checkbox Area -->
																	<div class="pt-1 pr-3">
																		<form
																			method="POST"
																			action="?/toggleItem"
																			use:enhance={({ formData }) => {
																				const checked = formData.get('checked') === 'true';
																				lists = lists.map((l) =>
																					l.id === list.id
																						? {
																								...l,
																								items: l.items.map((i: any) =>
																									i.id === item.id ? { ...i, checked } : i
																								)
																							}
																						: l
																				);
																				return async ({ result }) => {
																					if (result.type !== 'success') {
																						lists = lists.map((l) =>
																							l.id === list.id
																								? {
																										...l,
																										items: l.items.map((i: any) =>
																											i.id === item.id
																												? {
																														...i,
																														checked: !checked
																													}
																												: i
																										)
																									}
																								: l
																						);
																					} else {
																						await invalidateAll();
																					}
																				};
																			}}
																		>
																			<input type="hidden" name="itemId" value={item.id} />
																			<input type="hidden" name="checked" value={!item.checked} />
																			<Button
																				type="submit"
																				variant="ghost"
																				size="icon"
																				class="relative h-5 w-5 p-0 hover:bg-transparent"
																			>
																				{#if item.checked}
																					<!-- Hand-drawn checkmark feel -->
																					<div
																						class="bg-fg/5 absolute inset-0 rounded-sm border-2 border-border"
																					></div>
																					<Check class="text-fg h-4 w-4" />
																				{:else}
																					<div
																						class="border-fg-muted absolute inset-0 rounded-sm border-2 transition-colors hover:border-border"
																					></div>
																				{/if}
																			</Button>
																		</form>
																	</div>

																	<!-- Item Text -->
																	<div class="flex min-h-7 min-w-0 flex-1 flex-col justify-center">
																		<div class="flex items-baseline gap-2">
																			<span
																				class="font-ui text-fg w-12 shrink-0 text-right text-sm font-bold"
																			>
																				{item.quantity}
																				{item.unit}
																			</span>
																			<span
																				class="font-serif text-lg leading-none transition-all duration-300
                                                                        {item.checked
																					? 'text-fg-muted decoration-border-muted line-through decoration-2'
																					: 'text-ink'}"
																			>
																				{item.name}
																			</span>
																		</div>
																		{#if item.notes}
																			<p class="font-hand pl-14 text-xs text-ink-muted italic">
																				{item.notes}
																			</p>
																		{/if}
																	</div>

																	<!-- Delete Action (Hover) -->
																	<div
																		class="absolute top-1/2 right-0 -translate-y-1/2 bg-white/50 px-2 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100"
																	>
																		<form
																			method="POST"
																			action="?/deleteItem"
																			use:enhance={() => {
																				lists = lists.map((l) =>
																					l.id === list.id
																						? {
																								...l,
																								items: l.items.filter((i: any) => i.id !== item.id)
																							}
																						: l
																				);
																				workflowStore.decrementShopping();
																				return async ({ result }) => {
																					if (result.type === 'failure') {
																						workflowStore.incrementShopping();
																						await invalidateAll();
																					} else {
																						await invalidateAll();
																					}
																				};
																			}}
																		>
																			<input type="hidden" name="itemId" value={item.id} />
																			<Button
																				type="submit"
																				variant="ghost"
																				size="icon"
																				class="text-fg-muted hover:bg-transparent hover:text-red-600"
																			>
																				<X class="h-4 w-4" />
																			</Button>
																		</form>
																	</div>
																</li>
															{/each}
														</ul>
													</div>
												{/each}
											{:else}
												<div class="text-fg-muted font-hand py-6 text-center text-lg italic">
													The list is waiting...
												</div>
											{/if}

											<!-- Done Shopping Button -->
											{#if list.items?.length > 0 && completion > 0}
												<div class="flex justify-end pt-8">
													<form
														method="POST"
														action="?/completeShopping"
														use:enhance={() => {
															loading = true;
															return async ({ result }) => {
																loading = false;
																if (result.type === 'success') {
																	await invalidateAll();
																}
															};
														}}
													>
														<input type="hidden" name="listId" value={list.id} />
														<Button type="submit" variant="secondary">
															<Check class="mr-2 h-4 w-4" />
															Checkout
														</Button>
													</form>
												</div>
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					</div>

					<!-- Bottom decorative spacing -->
					<div class="h-16"></div>
				</Notepad>
			</div>
		</div>
	</div>
</div>

<!-- Pantry Warning Dialog -->
<AlertDialog.Root bind:open={pantryWarning.show}>
	<AlertDialog.Content class="border-sand bg-[#fffdf5] font-serif">
		<AlertDialog.Header>
			<AlertDialog.Title class="font-display flex items-center gap-2 text-2xl text-amber-700">
				<AlertTriangle class="h-6 w-6" />
				Hold on a sec...
			</AlertDialog.Title>
			<AlertDialog.Description class="text-ink">
				<p class="mb-4 text-base leading-relaxed">{pantryWarning.message}</p>
				<div class="flex items-center gap-3 rounded-sm border border-border bg-white p-3">
					<span class="text-fg-muted text-xs font-medium tracking-wider uppercase">Certainty:</span>
					<div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
						<div class="h-full bg-amber-500" style="width: {pantryWarning.confidence}%"></div>
					</div>
					<span class="font-ui text-sm font-bold text-amber-600">{pantryWarning.confidence}%</span>
				</div>
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer class="gap-2">
			<AlertDialog.Cancel onclick={dismissPantryWarning} class="btn-ghost">
				Skip Item
			</AlertDialog.Cancel>
			<AlertDialog.Action onclick={forceAddItem} class="btn-accent-filled">
				Add Anyway
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
