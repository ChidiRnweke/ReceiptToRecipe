<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import SubmitButton from '$lib/components/SubmitButton.svelte';
	import Notepad from '$lib/components/Notepad.svelte';

	let { data, form } = $props();
	let joining = $state(false);

	const invalidMessages: Record<string, string> = {
		expired: 'This invite link has expired. Ask for a new one.',
		used: 'This invite link has already been used. Ask for a new one.',
		not_found: 'This invite link is not valid. Check that you copied all of it.'
	};
</script>

<svelte:head>
	<title>Join a household - Receipt2Recipe</title>
</svelte:head>

<div class="font-ui relative min-h-screen bg-bg-paper p-4 md:p-8">
	<div class="relative z-10 mx-auto max-w-xl pt-8">
		<Notepad class="w-full shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)]">
			<div class="space-y-6 p-6 text-center sm:p-10">
				{#if data.status === 'valid' && data.householdName}
					<h1 class="font-display text-4xl leading-tight text-ink">
						Join {data.householdName}
					</h1>

					{#if data.alreadyMember}
						<p class="font-serif text-lg text-ink-light italic">
							You are already part of this household.
						</p>
						<Button href="/">Back to the kitchen</Button>
					{:else}
						<p class="font-serif text-lg text-ink-light italic">
							You will share receipts, recipes, the cupboard, the shopping list and the meal plan.
							Everything in your current kitchen comes with you.
						</p>

						{#if form?.error}
							<p
								class="font-hand rounded-sm border border-sienna-200 bg-sienna-50 p-4 text-xl text-sienna-800"
							>
								{form.error}
							</p>
						{/if}

						<form
							method="POST"
							use:enhance={() => {
								joining = true;
								return async ({ update }) => {
									joining = false;
									await update();
								};
							}}
						>
							<SubmitButton loading={joining} loadingText="Joining...">Join</SubmitButton>
						</form>
					{/if}
				{:else}
					<h1 class="font-display text-4xl leading-tight text-ink">Invite unavailable</h1>
					<p class="font-serif text-lg text-ink-light italic">
						{invalidMessages[data.status] ?? invalidMessages.not_found}
					</p>
					<Button href="/">Back to the kitchen</Button>
				{/if}
			</div>
		</Notepad>
	</div>
</div>
