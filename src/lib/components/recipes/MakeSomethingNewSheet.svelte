<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { RecipeCardResult } from '$lib/models/recipes';
	import { makeSomethingNew, toggleSave } from '$lib/remote/recipes/recipes.remote';
	import DoorSheet from './DoorSheet.svelte';
	import RecipeResultCard from './RecipeResultCard.svelte';
	import { failureMessage } from './errors';

	interface Props {
		open: boolean;
		/** Opens the snap sheet instead. */
		onsnap: () => void;
		/** A recipe was made or saved, so lists may change. */
		onchange: () => void;
	}

	let { open = $bindable(), onsnap, onchange }: Props = $props();

	const QUICK = [
		'Something spicy, 20 minutes',
		'Eggs, spinach and feta',
		'Quick and light',
		'Something creamy'
	];

	let draft = $state('');
	let asked = $state<string | null>(null);
	let offered = $state<string[]>([]);
	let result = $state<RecipeCardResult | null>(null);
	let saved = $state(false);
	let working = $state(false);
	let problem = $state<string | null>(null);

	async function ask(text: string, previousTitles: string[]) {
		working = true;
		problem = null;
		try {
			const made = await makeSomethingNew({ text, previousTitles });
			asked = text;
			result = made;
			saved = made.saved;
			offered = [...previousTitles, made.title];
			draft = '';
			onchange();
		} catch (cause) {
			problem = failureMessage(cause, 'That did not work. Try again in a moment.');
		} finally {
			working = false;
		}
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const text = draft.trim();
		if (text) ask(text, []);
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
	title="Make something new"
	description="Say a craving, or what you’ve got. You get a recipe straight away."
>
	<form class="flex gap-2" onsubmit={submit}>
		<Input
			bind:value={draft}
			placeholder="What do you fancy? A craving, or what you’ve got"
			aria-label="What do you fancy?"
			maxlength={200}
			class="min-w-0 flex-1 bg-white"
			disabled={working}
		/>
		<Button type="submit" size="sm" class="h-9" disabled={working || !draft.trim()}>Go</Button>
	</form>
	<div class="flex flex-wrap gap-1.5">
		{#each QUICK as quick (quick)}
			<button
				type="button"
				class="rounded-full border border-border bg-white px-2.5 py-1 text-[12.5px] text-ink-light hover:border-sage-300 hover:text-sage-800 disabled:opacity-50"
				disabled={working}
				onclick={() => ask(quick, [])}>{quick}</button
			>
		{/each}
	</div>
	<button
		type="button"
		class="justify-self-start text-left text-[13.5px] font-semibold text-sage-700 hover:underline"
		onclick={onsnap}>Or snap a photo of one</button
	>
	<a
		href={resolve('/recipes/generate')}
		class="-mt-1 justify-self-start text-[13px] text-text-muted underline-offset-2 hover:underline"
		>Or pick exactly what to use from the cupboard</a
	>

	<div aria-live="polite" class="grid gap-3">
		{#if working}
			<p class="font-hand py-6 text-center text-xl text-ink-light">Making something up…</p>
		{:else if problem}
			<p class="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">{problem}</p>
		{/if}
		{#if result && !working}
			<p class="text-xs font-bold tracking-wider text-text-muted uppercase">For “{asked}”</p>
			<RecipeResultCard {result}>
				{#snippet actions()}
					<Button size="sm" href={resolve('/recipes/[id]', { id: result!.id })}>Cook this</Button>
					<Button size="sm" variant="outline" onclick={() => save(result!.id)}>
						{saved ? 'Saved ✓' : 'Save'}
					</Button>
					<Button
						size="sm"
						variant="outline"
						onclick={() => asked && ask(asked, offered)}
						disabled={working}>Another one</Button
					>
				{/snippet}
			</RecipeResultCard>
		{/if}
	</div>
</DoorSheet>
