<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'plain' | 'use' | 'ok' | 'need';

	interface Props {
		tone?: Tone;
		children: Snippet;
	}

	let { tone = 'plain', children }: Props = $props();

	const tones: Record<Tone, string> = {
		plain: 'bg-bg-paper-dark text-text-secondary',
		use: 'bg-sienna-100 text-sienna-800',
		ok: 'bg-sage-100 text-sage-800',
		need: 'border border-warning-100 bg-warning-50 text-[#92560a]'
	};
</script>

<span class="rounded-full px-2 py-0.5 text-xs font-semibold {tones[tone]}">
	{@render children()}
</span>
