<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus } from 'lucide-svelte';
	import SubmitButton from './SubmitButton.svelte';

	let { existingItems = [] } = $props<{
		existingItems?: string[];
	}>();

	let itemName = $state('');
	let isSubmitting = $state(false);
</script>

<form
	method="POST"
	action="?/addItem"
	use:enhance={() => {
		isSubmitting = true;
		return async ({ update }) => {
			await update();
			isSubmitting = false;
			itemName = '';
		};
	}}
	class="flex items-center gap-2"
>
	<div class="relative flex-1">
		<input
			type="text"
			name="itemName"
			bind:value={itemName}
			placeholder="Add something to your cupboard..."
			autocomplete="off"
			list="cupboard-suggestions"
			required
			class="font-body w-full border-b-2 border-sand/60 bg-transparent py-2 pr-2 pl-1 text-sm text-text-primary placeholder:text-text-muted/60 focus:border-primary-400 focus:outline-none"
		/>
		{#if existingItems.length > 0}
			<datalist id="cupboard-suggestions">
				{#each existingItems as item}
					<option value={item}></option>
				{/each}
			</datalist>
		{/if}
	</div>
	<SubmitButton
		loading={isSubmitting}
		disabled={!itemName.trim()}
		class="h-8 w-8 rounded-full !p-0"
	>
		<Plus class="h-4 w-4" />
	</SubmitButton>
</form>
