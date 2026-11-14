<script lang="ts">
	import type { DoorArtName } from './art';

	interface Props {
		name: DoorArtName;
		class?: string;
	}

	let { name, class: className = '' }: Props = $props();

	const tall = $derived(name === 'camReceipt' || name === 'camBook' || name === 'pencilCard');
</script>

<svg
	viewBox={tall ? '0 0 120 96' : '0 0 120 90'}
	class={className}
	aria-hidden="true"
	focusable="false"
	xmlns="http://www.w3.org/2000/svg"
>
	{#if name === 'plate'}
		<ellipse cx="60" cy="52" rx="38" ry="30" fill="#fff" stroke="#b3d0b8" stroke-width="2.5" />
		<ellipse
			cx="60"
			cy="52"
			rx="24"
			ry="18"
			fill="none"
			stroke="#e5dcc4"
			stroke-width="2"
			stroke-dasharray="4 4"
		/>
		<path
			d="M12 22v26M8 22v10a4 4 0 0 0 8 0V22"
			fill="none"
			stroke="#718096"
			stroke-width="2.2"
			stroke-linecap="round"
		/>
		<path
			d="M108 22c-6 4-6 16 0 20v10"
			fill="none"
			stroke="#718096"
			stroke-width="2.2"
			stroke-linecap="round"
		/>
	{:else if name === 'basket'}
		<path
			d="M24 38h72l-8 36H32z"
			fill="#fff"
			stroke="#b3d0b8"
			stroke-width="2.5"
			stroke-linejoin="round"
		/>
		<path d="M40 38l14-20M80 38L66 18" stroke="#718096" stroke-width="2.2" stroke-linecap="round" />
		<path
			d="M44 50v14M60 50v14M76 50v14"
			stroke="#e5dcc4"
			stroke-width="2.2"
			stroke-linecap="round"
		/>
		<path
			d="M52 30l6 6 12-12"
			fill="none"
			stroke="#4a8560"
			stroke-width="3"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{:else if name === 'jar'}
		<rect
			x="40"
			y="22"
			width="40"
			height="56"
			rx="9"
			fill="#fff"
			stroke="#b3d0b8"
			stroke-width="2.5"
		/>
		<rect
			x="45"
			y="12"
			width="30"
			height="10"
			rx="3"
			fill="#e8f0e9"
			stroke="#b3d0b8"
			stroke-width="2"
		/>
		<path d="M46 58h28" stroke="#e5dcc4" stroke-width="2" stroke-dasharray="3 4" />
		<path
			d="M90 30l4-4M94 40h5M90 50l4 4"
			stroke="#f48c3f"
			stroke-width="2.2"
			stroke-linecap="round"
		/>
	{:else if name === 'book'}
		<path
			d="M60 24c-10-6-24-6-34-2v50c10-4 24-4 34 2 10-6 24-6 34-2V22c-10-4-24-4-34 2z"
			fill="#fff"
			stroke="#b3d0b8"
			stroke-width="2.5"
			stroke-linejoin="round"
		/>
		<path d="M60 24v50" stroke="#e5dcc4" stroke-width="2" />
		<path
			d="M34 36h16M34 44h12M70 36h16M70 44h10"
			stroke="#e5dcc4"
			stroke-width="2"
			stroke-linecap="round"
		/>
		<path
			d="M82 14l3 6 6 1-4 4 1 6-6-3-5 3 1-6-4-4 6-1z"
			fill="#ffc999"
			stroke="#f48c3f"
			stroke-width="1.4"
			stroke-linejoin="round"
		/>
	{:else if name === 'receipt'}
		<path
			d="M38 10h44v70l-5.5-4-5.5 4-5.5-4-5.5 4-5.5-4-5.5 4-5.5-4-5.5 4z"
			fill="#fff"
			stroke="#b3d0b8"
			stroke-width="2.5"
			stroke-linejoin="round"
		/>
		<path
			d="M46 24h20M46 33h28M46 42h16M46 51h24"
			stroke="#e5dcc4"
			stroke-width="2.4"
			stroke-linecap="round"
		/>
		<path d="M46 62h28" stroke="#718096" stroke-width="2.4" stroke-linecap="round" />
		<rect
			x="74"
			y="52"
			width="30"
			height="22"
			rx="5"
			fill="#e8f0e9"
			stroke="#4a8560"
			stroke-width="2.2"
		/>
		<circle cx="89" cy="63" r="5.5" fill="none" stroke="#4a8560" stroke-width="2.2" />
		<path
			d="M82 52l3-4h8l3 4"
			fill="none"
			stroke="#4a8560"
			stroke-width="2.2"
			stroke-linejoin="round"
		/>
	{:else if name === 'cal'}
		<rect
			x="28"
			y="20"
			width="64"
			height="56"
			rx="8"
			fill="#fff"
			stroke="#b3d0b8"
			stroke-width="2.5"
		/>
		<path d="M28 34h64" stroke="#b3d0b8" stroke-width="2.5" />
		<path d="M44 14v10M76 14v10" stroke="#718096" stroke-width="2.4" stroke-linecap="round" />
		<circle cx="46" cy="48" r="3" fill="#e5dcc4" />
		<circle cx="60" cy="48" r="3" fill="#e5dcc4" />
		<circle cx="74" cy="48" r="3" fill="#4a8560" />
		<circle cx="46" cy="62" r="3" fill="#e5dcc4" />
		<circle cx="60" cy="62" r="3" fill="#e5dcc4" />
	{:else if name === 'pencilCard'}
		<g transform="rotate(-4 60 50)">
			<rect
				x="22"
				y="18"
				width="72"
				height="62"
				rx="3"
				fill="#fff"
				stroke="#c9bfa8"
				stroke-width="1.6"
			/>
			<path d="M22 30h72" stroke="#f6a5a5" stroke-width="1.6" />
			<path
				d="M30 42h44M30 52h36M30 62h40"
				stroke="#d8cfbb"
				stroke-width="2.2"
				stroke-linecap="round"
			/>
		</g>
		<g transform="rotate(38 84 52)">
			<rect x="78" y="18" width="11" height="52" rx="2" fill="#f6c27a" />
			<rect x="78" y="18" width="11" height="8" fill="#f6a5a5" />
			<path d="M78 70h11l-5.5 12z" fill="#f3e2c5" />
			<path d="M81.8 78h3.4l-1.7 4z" fill="#2d3748" />
		</g>
		<path d="M90 10l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="#ffc999" />
	{:else}
		{#if name === 'camReceipt'}
			<path d="M40 6h40v50H40z" fill="#fff" stroke="#c9bfa8" stroke-width="1.6" />
			<path
				d="M47 15h18M47 22h26M47 29h14M47 36h22"
				stroke="#d8cfbb"
				stroke-width="2.2"
				stroke-linecap="round"
			/>
		{:else}
			<g transform="rotate(-6 60 30)">
				<rect
					x="34"
					y="6"
					width="52"
					height="46"
					rx="2"
					fill="#fff"
					stroke="#c9bfa8"
					stroke-width="1.6"
				/>
				<path d="M34 15h52" stroke="#f6a5a5" stroke-width="1.6" />
				<path
					d="M41 24h30M41 31h22M41 38h26"
					stroke="#d8cfbb"
					stroke-width="2.2"
					stroke-linecap="round"
				/>
			</g>
		{/if}
		<rect x="22" y="46" width="76" height="44" rx="10" fill="#4a8560" />
		<rect x="22" y="46" width="76" height="12" rx="6" fill="#5c9a72" />
		<rect x="40" y="40" width="20" height="9" rx="3" fill="#3d6b52" />
		<circle cx="60" cy="69" r="15" fill="#2f5144" stroke="#e8f0e9" stroke-width="3.5" />
		<circle cx="60" cy="69" r="7.5" fill="#1c2a26" />
		<circle cx="56.5" cy="65.5" r="2.6" fill="#fff" opacity=".7" />
		<rect x="80" y="51" width="10" height="6" rx="1.5" fill="#ffe0c4" />
	{/if}
</svg>
