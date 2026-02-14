<script lang="ts">
	let {
		color = 'red',
		class: className = ''
	}: {
		color?: 'red' | 'yellow';
		class?: string;
	} = $props();

	const palette = {
		red: {
			light: '#fca5a5',
			base: '#dc2626',
			dark: '#7f1d1d'
		},
		yellow: {
			light: '#fef9c3',
			base: '#eab308',
			dark: '#713f12'
		}
	} as const;

	const c = $derived(palette[color] ?? palette.red);
</script>

<div class={`relative flex h-8 w-6 justify-center select-none ${className}`}>
	<div
		class="absolute top-[10px] h-3 w-3 rounded-full bg-black/20 blur-[1.5px]"
		style="transform: translate(4px, 6px);"
	></div>

	<div
		class="absolute top-[11px] h-5 w-[2px] rounded-b-full shadow-sm"
		style="background: linear-gradient(90deg, #6b7280 0%, #d1d5db 50%, #4b5563 100%);"
	></div>

	<div class="absolute top-[28px] h-1 w-1 rounded-full bg-stone-900/10 shadow-inner"></div>

	<div
		class="relative z-10 h-5 w-5 rounded-full"
		style={`
      background: radial-gradient(circle at 30% 30%, ${c.light} 0%, ${c.base} 45%, ${c.dark} 100%);
      box-shadow: inset 0 1px 1px rgba(255,255,255,0.4);
    `}
	>
		<div
			class="absolute top-[20%] left-[20%] h-1.5 w-1.5 rounded-full bg-white opacity-40 blur-[0.5px]"
		></div>
	</div>
</div>
