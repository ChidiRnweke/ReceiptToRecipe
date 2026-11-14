<script lang="ts">
	import PaperTile from './PaperTile.svelte';

	interface Props {
		label: string;
		href?: string;
		onclick?: () => void;
		tilt?: number;
		wide?: boolean;
		class?: string;
	}

	let { tilt = 0.8, ...rest }: Props = $props();
</script>

<PaperTile art="pencilCard" {tilt} {...rest} />
