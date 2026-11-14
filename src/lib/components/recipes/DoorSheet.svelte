<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Sheet from '$lib/components/ui/sheet';

	interface Props {
		open: boolean;
		title: string;
		description: string;
		children: Snippet;
	}

	let { open = $bindable(), title, description, children }: Props = $props();
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side="bottom"
		class="mx-auto max-h-[92dvh] w-full max-w-lg gap-3 overflow-y-auto rounded-t-3xl bg-paper px-4 pt-3 pb-8"
	>
		<span class="mx-auto h-1.5 w-10 rounded-full bg-border" aria-hidden="true"></span>
		<Sheet.Header class="p-0 text-left">
			<Sheet.Title class="font-display text-2xl font-semibold text-ink">{title}</Sheet.Title>
			<Sheet.Description class="text-[13px] text-text-muted">{description}</Sheet.Description>
		</Sheet.Header>
		{@render children()}
	</Sheet.Content>
</Sheet.Root>
