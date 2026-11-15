<script lang="ts">
	import RecipePicture from '$lib/components/recipes/RecipePicture.svelte';

	interface Props {
		title: string;
		imageUrl: string | null;
		/** A square thumbnail instead of the wide card photo. */
		small?: boolean;
		class?: string;
	}

	let { title, imageUrl, small = false, class: className = '' }: Props = $props();
</script>

<RecipePicture
	{title}
	{imageUrl}
	class="{small ? 'size-14 flex-none rounded-[10px]' : 'h-40 w-full'} {className}"
/>
