<script lang="ts">
	interface Props {
		title: string;
		imageUrl: string | null;
		/** A square thumbnail instead of the wide card photo. */
		small?: boolean;
		class?: string;
	}

	let { title, imageUrl, small = false, class: className = '' }: Props = $props();

	/** A warm hue from the title, so the same dish keeps the same placeholder. */
	const hue = $derived(
		[...title].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 7) % 50
	);
</script>

{#if imageUrl}
	<img
		src={imageUrl}
		alt=""
		loading="lazy"
		class="{small ? 'size-14 flex-none rounded-[10px]' : 'h-40 w-full'} object-cover {className}"
	/>
{:else}
	<div
		aria-hidden="true"
		class="{small ? 'size-14 flex-none rounded-[10px]' : 'h-40 w-full'} {className}"
		style:background="linear-gradient(135deg, hsl({hue} 70% 80%), hsl({hue} 40% 48%))"
	></div>
{/if}
