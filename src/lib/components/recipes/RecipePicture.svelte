<script lang="ts">
	import DoorArt from '$lib/components/doors/DoorArt.svelte';

	interface Props {
		title: string;
		imageUrl: string | null;
		/** The picture is being made: the placeholder says so instead of standing in for good. */
		pending?: boolean;
		/** Size and shape, e.g. `h-32 w-full` or `size-14 rounded-xl`. */
		class?: string;
	}

	let { title, imageUrl, pending = false, class: className = '' }: Props = $props();

	/** A warm tint from the title, so the same dish keeps the same placeholder. */
	const hue = $derived(
		20 + ([...title].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 7) % 40)
	);

	// Kept per address, so a new picture fades in again and one that cannot load shows the
	// placeholder instead.
	let loadedUrl = $state<string | null>(null);
	let failedUrl = $state<string | null>(null);
	const loaded = $derived(imageUrl !== null && loadedUrl === imageUrl);
	const failed = $derived(imageUrl !== null && failedUrl === imageUrl);
</script>

<div class="relative isolate overflow-hidden bg-bg-paper-dark {className}">
	{#if !loaded}
		<!-- An illustrated paper placeholder: a plate on a tinted sheet of paper. -->
		<div
			aria-hidden="true"
			class="absolute inset-0 flex items-center justify-center"
			style:background="radial-gradient(circle at 30% 20%, hsl({hue} 60% 96%), hsl({hue} 38% 86%))"
		>
			<DoorArt
				name="plate"
				class="h-3/5 max-h-28 w-auto opacity-80 {pending ? 'motion-safe:animate-pulse' : ''}"
			/>
		</div>
	{/if}
	{#if pending && !imageUrl}
		<span class="sr-only">The picture is being made.</span>
	{/if}
	{#if imageUrl && !failed}
		<img
			src={imageUrl}
			alt=""
			loading="lazy"
			decoding="async"
			class="absolute inset-0 size-full object-cover {loaded
				? 'opacity-100'
				: 'opacity-0'} motion-safe:transition-opacity motion-safe:duration-500"
			onload={() => (loadedUrl = imageUrl)}
			onerror={() => (failedUrl = imageUrl)}
		/>
	{/if}
</div>
