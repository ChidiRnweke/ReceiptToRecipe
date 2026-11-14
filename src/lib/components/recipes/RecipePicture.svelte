<script lang="ts">
	interface Props {
		title: string;
		imageUrl: string | null;
		/** Size and shape, e.g. `h-32 w-full` or `size-14 rounded-xl`. */
		class?: string;
	}

	let { title, imageUrl, class: className = '' }: Props = $props();

	// Without a photo, a soft gradient whose colour comes from the title stands in for one.
	const hue = $derived([...title].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 7));
</script>

{#if imageUrl}
	<img src={imageUrl} alt="" class="object-cover {className}" loading="lazy" />
{:else}
	<div
		aria-hidden="true"
		class={className}
		style:background="linear-gradient(135deg, hsl({hue} 70% 82%), hsl({hue} 40% 52%))"
	></div>
{/if}
