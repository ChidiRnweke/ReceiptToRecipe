<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Loader2, Search, ShoppingCart, Trash2 } from 'lucide-svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { CameraTile, DoorHeader, IndexCardTile } from '$lib/components/doors';
	import MakeSomethingNewSheet from '$lib/components/recipes/MakeSomethingNewSheet.svelte';
	import RecipePicture from '$lib/components/recipes/RecipePicture.svelte';
	import SnapRecipeSheet from '$lib/components/recipes/SnapRecipeSheet.svelte';
	import type { MyRecipeRow, MyRecipesTab } from '$lib/models/recipes';
	import { listMine } from '$lib/remote/recipes/recipes.remote';
	import { greetingFor } from '$lib/services/doors';
	import { recipeMeta } from '$lib/services/recipes';
	import { undoToastState } from '$lib/state/undoToast.svelte';
	import { workflowStore } from '$lib/state/workflow.svelte';
	import type { RecipeFit } from './+page.server';

	let { data } = $props();

	const TABS: { key: MyRecipesTab; label: string }[] = [
		{ key: 'made', label: 'Made' },
		{ key: 'saved', label: 'Saved' },
		{ key: 'added', label: 'Added' },
		{ key: 'all', label: 'Everything' }
	];

	const EMPTY: Record<MyRecipesTab, { title: string; description: string }> = {
		made: { title: 'Nothing made yet', description: 'Cook a recipe and it lands here.' },
		saved: { title: 'Nothing saved yet', description: 'Tap Save on any recipe and it lands here.' },
		added: { title: 'Nothing added yet', description: 'Make one up, or snap a cookbook page.' },
		all: { title: 'No recipes yet', description: 'Make one up, or snap a cookbook page.' }
	};

	let tab = $state<MyRecipesTab>('made');
	let newOpen = $state(false);
	let snapOpen = $state(false);
	let search = $state('');
	let hideUnsuited = $state(false);
	let fit = $state<Record<string, RecipeFit>>({});
	let addingToShoppingId = $state<string | null>(null);
	let deletingId = $state<string | null>(null);
	let deleteDialogOpen = $state(false);
	let recipeToDelete = $state<string | null>(null);

	const now = new Date();
	const firstName = $derived(page.data.user?.name?.split(' ')[0] ?? 'there');
	const anyUnsuited = $derived(Object.values(fit).some((entry) => !entry.compatible));

	$effect(() => {
		data.streamed.fit.then((value) => (fit = value)).catch(() => (fit = {}));
	});

	function shown(rows: MyRecipeRow[]): MyRecipeRow[] {
		const needle = search.trim().toLowerCase();
		return rows.filter(
			(row) =>
				(!needle || row.title.toLowerCase().includes(needle)) &&
				(!hideUnsuited || fit[row.id]?.compatible !== false)
		);
	}

	function refreshLists() {
		listMine(tab).refresh();
	}

	function openSnap() {
		newOpen = false;
		snapOpen = true;
	}

	async function restoreDeletedRecipe(snapshot: unknown) {
		const formData = new FormData();
		formData.set('recipe', JSON.stringify(snapshot));
		const response = await fetch('?/restore', { method: 'POST', body: formData });
		if (!response.ok) throw new Error('Failed to restore recipe');
		await invalidateAll();
		refreshLists();
	}
</script>

<svelte:head>
	<title>Recipes - Receipt2Recipe</title>
</svelte:head>

<div class="mx-auto grid w-full max-w-2xl gap-6">
	<DoorHeader greeting={greetingFor(now.getHours(), firstName)} question="What shall we *cook*?" />

	<div class="grid grid-cols-2 gap-3">
		<IndexCardTile label="Make something new" tilt={-0.8} onclick={() => (newOpen = true)} />
		<CameraTile
			subject="recipe"
			label="Snap a recipe"
			tilt={0.8}
			onclick={() => (snapOpen = true)}
		/>
	</div>

	<section aria-labelledby="my-recipes" class="grid gap-3">
		<h2 id="my-recipes" class="text-xs font-bold tracking-wider text-text-muted uppercase">
			My recipes
		</h2>

		<svelte:boundary>
			{@const mine = await listMine(tab)}
			<Tabs.Root bind:value={tab} class="flex-col gap-3">
				<Tabs.List class="h-9 w-full bg-paper-dark">
					{#each TABS as item (item.key)}
						<Tabs.Trigger
							value={item.key}
							class="text-[12.5px] font-semibold data-[state=active]:bg-white data-[state=active]:text-sage-800 data-[state=active]:shadow-sm"
						>
							{item.label}
							<span class="font-medium text-text-muted">{mine.counts[item.key]}</span>
						</Tabs.Trigger>
					{/each}
				</Tabs.List>

				{#if mine.rows.length > 0}
					<div class="flex flex-wrap items-center gap-3">
						<div class="relative min-w-0 flex-1">
							<Search
								class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted"
							/>
							<Input
								bind:value={search}
								type="search"
								placeholder="Find a recipe"
								aria-label="Find a recipe"
								class="h-9 bg-white pl-8"
							/>
						</div>
						{#if anyUnsuited}
							<div class="flex items-center gap-2">
								<Checkbox id="hide-unsuited" bind:checked={hideUnsuited} />
								<Label for="hide-unsuited" class="text-xs text-text-muted">
									Hide what doesn’t suit me
								</Label>
							</div>
						{/if}
					</div>
				{/if}

				{#each TABS as item (item.key)}
					<Tabs.Content value={item.key}>
						{#if item.key === mine.tab}
							{@const rows = shown(mine.rows)}
							{#if mine.rows.length === 0}
								<EmptyState
									art="book"
									title={EMPTY[item.key].title}
									description={EMPTY[item.key].description}
								/>
							{:else if rows.length === 0}
								<p class="py-6 text-center text-sm text-text-muted">Nothing matches that.</p>
							{:else}
								<ul class="grid gap-2">
									{#each rows as row (row.id)}
										{@const rowFit = fit[row.id]}
										<li
											class="flex items-center gap-2 rounded-2xl border border-border bg-white p-2"
										>
											<a
												href={resolve('/recipes/[id]', { id: row.id })}
												class="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
											>
												<RecipePicture
													title={row.title}
													imageUrl={row.imageUrl}
													class="size-14 shrink-0 rounded-xl"
												/>
												<span class="grid min-w-0 gap-0.5">
													<span class="truncate text-[14.5px] font-semibold text-ink"
														>{row.title}</span
													>
													<span class="text-[12.5px] text-text-muted">{recipeMeta(row, now)}</span>
													{#if rowFit && !rowFit.compatible}
														<span
															class="justify-self-start rounded-full bg-danger-50 px-2 text-[11px] font-semibold text-danger-600"
															title={rowFit.notes.join(', ')}>Doesn’t suit you</span
														>
													{:else if rowFit && rowFit.matchPercentage >= 0.7}
														<span
															class="justify-self-start rounded-full bg-sage-100 px-2 text-[11px] font-semibold text-sage-800"
															>You have {Math.round(rowFit.matchPercentage * 100)}% of it</span
														>
													{/if}
												</span>
											</a>
											<form
												method="POST"
												action="?/addToShopping"
												use:enhance={() => {
													addingToShoppingId = row.id;
													workflowStore.incrementShopping();
													return async ({ result }) => {
														addingToShoppingId = null;
														if (result.type === 'failure') workflowStore.decrementShopping();
														else await invalidateAll();
													};
												}}
											>
												<input type="hidden" name="recipeId" value={row.id} />
												<Button
													type="submit"
													variant="ghost"
													size="icon"
													class="size-8 rounded-full text-text-muted"
													disabled={addingToShoppingId === row.id}
													aria-label="Add the ingredients of {row.title} to the shopping list"
												>
													{#if addingToShoppingId === row.id}
														<Loader2 class="size-4 animate-spin" />
													{:else}
														<ShoppingCart class="size-4" />
													{/if}
												</Button>
											</form>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												class="size-8 rounded-full text-text-muted hover:bg-danger-50 hover:text-danger-600"
												disabled={deletingId === row.id}
												aria-label="Delete {row.title}"
												onclick={() => {
													recipeToDelete = row.id;
													deleteDialogOpen = true;
												}}
											>
												{#if deletingId === row.id}
													<Loader2 class="size-4 animate-spin" />
												{:else}
													<Trash2 class="size-4" />
												{/if}
											</Button>
										</li>
									{/each}
								</ul>
							{/if}
						{/if}
					</Tabs.Content>
				{/each}
			</Tabs.Root>

			{#snippet pending()}
				<div class="grid gap-2" aria-busy="true">
					<Skeleton class="h-8 w-full rounded-lg" />
					{#each { length: 3 }, i (i)}
						<Skeleton class="h-18 w-full rounded-2xl" />
					{/each}
				</div>
			{/snippet}
			{#snippet failed(error, reset)}
				<div class="border-danger-200 rounded-xl border bg-danger-50 p-4 text-sm text-danger-600">
					<p>Your recipes did not load.</p>
					{#if error instanceof Error}<p class="mt-1 text-xs opacity-80">{error.message}</p>{/if}
					<Button variant="outline" size="sm" class="mt-2" onclick={reset}>Try again</Button>
				</div>
			{/snippet}
		</svelte:boundary>
	</section>
</div>

<MakeSomethingNewSheet bind:open={newOpen} onsnap={openSnap} onchange={refreshLists} />
<SnapRecipeSheet bind:open={snapOpen} onchange={refreshLists} />

<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete this recipe?</AlertDialog.Title>
			<AlertDialog.Description>
				It leaves the household’s recipes. You can bring it back from the undo note for a few
				seconds.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<form
				method="POST"
				action="?/delete"
				use:enhance={() => {
					deleteDialogOpen = false;
					if (recipeToDelete) deletingId = recipeToDelete;
					return async ({ result, update }) => {
						deletingId = null;
						await update();
						refreshLists();
						if (result.type !== 'success') return;
						const payload = (result.data as { deletedRecipe?: unknown } | undefined)?.deletedRecipe;
						if (!payload) return;
						undoToastState.show({
							message: 'Recipe deleted.',
							label: 'Restore',
							onUndo: async () => {
								await restoreDeletedRecipe(payload);
							}
						});
					};
				}}
				class="inline-block"
			>
				<input type="hidden" name="recipeId" value={recipeToDelete} />
				<AlertDialog.Action type="submit" class="btn-danger">Delete</AlertDialog.Action>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
