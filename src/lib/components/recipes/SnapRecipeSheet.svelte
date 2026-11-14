<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { DoorArt } from '$lib/components/doors';
	import { snapRecipe, toggleSave } from '$lib/remote/recipes/recipes.remote';
	import DoorSheet from './DoorSheet.svelte';
	import RecipeResultCard from './RecipeResultCard.svelte';
	import { failureMessage } from './errors';

	interface Props {
		open: boolean;
		/** A recipe was snapped or saved, so lists may change. */
		onchange: () => void;
	}

	let { open = $bindable(), onchange }: Props = $props();

	let saved = $state(false);
	let problem = $state<string | null>(null);
	let showResult = $state(false);

	const result = $derived(showResult ? snapRecipe.result : undefined);
	const reading = $derived(snapRecipe.pending > 0);
	const photoIssue = $derived(snapRecipe.fields.photo.issues()?.[0]?.message);

	const form = snapRecipe.enhance(async ({ submit }) => {
		problem = null;
		showResult = false;
		saved = false;
		try {
			await submit();
			showResult = true;
			onchange();
		} catch (cause) {
			problem = failureMessage(cause, 'Could not read that photo. Try another one.');
		}
	});

	function choose(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		if (input.files?.length) input.form?.requestSubmit();
	}

	async function save(recipeId: string) {
		const next = !saved;
		saved = next;
		try {
			await toggleSave({ recipeId, saved: next });
			onchange();
		} catch (cause) {
			saved = !next;
			problem = failureMessage(cause, 'Could not save it. Try again.');
		}
	}
</script>

<DoorSheet
	bind:open
	title="Snap a recipe"
	description="Point the camera at a cookbook page, pick a screenshot, or snap a dish you ate. We work out the rest."
>
	<form {...form} enctype="multipart/form-data" class="grid">
		<label
			class="grid cursor-pointer justify-items-center gap-1 rounded-2xl border border-[#efe9df] bg-white px-2 pt-2.5 pb-3 text-ink shadow-[0_10px_24px_-18px_rgba(45,55,72,0.5),0_1px_2px_rgba(0,0,0,0.05)] focus-within:ring-2 focus-within:ring-ring motion-safe:transition-transform {reading
				? 'pointer-events-none opacity-60'
				: 'rotate-[-0.6deg] hover:rotate-0'}"
		>
			<DoorArt name="camBook" class="h-auto w-full max-w-[150px]" />
			<span class="text-sm font-semibold text-sage-800">
				{result ? 'Snap another' : 'Take or choose a photo'}
			</span>
			<input
				{...snapRecipe.fields.photo.as('file')}
				accept="image/*"
				capture="environment"
				class="sr-only"
				onchange={choose}
			/>
		</label>
	</form>

	<div aria-live="polite" class="grid gap-3">
		{#if reading}
			<p class="font-hand py-6 text-center text-xl text-ink-light">Reading it…</p>
		{:else if problem || photoIssue}
			<p class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">
				{problem ?? photoIssue}
			</p>
		{/if}
		{#if result && !reading}
			<RecipeResultCard {result} stepsHeading="Steps, in the app’s words">
				{#snippet actions()}
					<Button size="sm" href={resolve('/recipes/[id]', { id: result.id })}>Cook this</Button>
					<Button size="sm" variant="outline" href={resolve('/planning')}>Put it in the plan</Button
					>
					<Button size="sm" variant="outline" onclick={() => save(result.id)}>
						{saved ? 'Saved ✓' : 'Save'}
					</Button>
				{/snippet}
			</RecipeResultCard>
		{/if}
	</div>
</DoorSheet>
