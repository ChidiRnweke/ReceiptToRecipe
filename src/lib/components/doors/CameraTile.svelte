<script lang="ts">
	import PaperTile from './PaperTile.svelte';

	interface Props {
		label: string;
		/** What sits behind the camera: a receipt to scan, or a recipe card to photograph. */
		subject?: 'receipt' | 'recipe';
		href?: string;
		onclick?: () => void;
		tilt?: number;
		wide?: boolean;
		class?: string;
	}

	let { subject = 'receipt', ...rest }: Props = $props();
</script>

<PaperTile art={subject === 'receipt' ? 'camReceipt' : 'camBook'} {...rest} />
