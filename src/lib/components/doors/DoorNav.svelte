<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { DOORS, activeDoor } from './doors';

	interface Props {
		/** `header`: inline row for wide screens. `bottom`: fixed tab bar for phones. */
		placement: 'header' | 'bottom';
		class?: string;
	}

	let { placement, class: className = '' }: Props = $props();

	const active = $derived(activeDoor(page.url.pathname));
</script>

{#if placement === 'header'}
	<nav aria-label="Doors" class="flex items-center gap-1 {className}">
		{#each DOORS as door (door.key)}
			{@const on = door.key === active}
			<a
				href={resolve(door.href)}
				aria-current={on ? 'page' : undefined}
				class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-safe:transition-colors
					{on
					? 'bg-primary-100 text-primary-700'
					: 'text-text-secondary hover:bg-bg-paper-dark hover:text-text-primary'}"
			>
				<door.icon class="h-4 w-4" aria-hidden="true" />
				<span>{door.label}</span>
			</a>
		{/each}
	</nav>
{:else}
	<nav
		aria-label="Doors"
		class="fixed right-0 bottom-0 left-0 z-50 border-t border-border bg-bg-paper/95 backdrop-blur-md {className}"
		style="padding-bottom: max(env(safe-area-inset-bottom, 0px), 8px);"
	>
		<div class="flex items-stretch px-1">
			{#each DOORS as door (door.key)}
				{@const on = door.key === active}
				<a
					href={resolve(door.href)}
					aria-current={on ? 'page' : undefined}
					class="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 pt-2.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset motion-safe:transition-colors
						{on ? 'text-primary-700' : 'text-text-muted'}"
				>
					{#if on}
						<span
							aria-hidden="true"
							class="absolute top-0 right-1/4 left-1/4 h-0.5 rounded-full bg-primary-600"
						></span>
					{/if}
					<door.icon class="h-5 w-5" aria-hidden="true" />
					<span class="truncate text-[11px] {on ? 'font-semibold' : 'font-medium'}"
						>{door.label}</span
					>
				</a>
			{/each}
		</div>
	</nav>
{/if}
