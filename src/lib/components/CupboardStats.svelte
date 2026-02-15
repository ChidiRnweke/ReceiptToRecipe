<script lang="ts">
	import type { CupboardStats } from '$controllers';
	import { Package, AlertTriangle, ShoppingCart } from 'lucide-svelte';

	let { stats } = $props<{ stats: CupboardStats }>();
</script>

<div class="grid grid-cols-3 gap-3">
	<div
		class="flex flex-col items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3"
	>
		<Package class="h-4 w-4 text-emerald-600" />
		<span class="text-lg font-semibold text-emerald-700">{stats.inStock}</span>
		<span class="text-[10px] tracking-wide text-emerald-600 uppercase">In Stock</span>
	</div>

	<div
		class="flex flex-col items-center gap-1 rounded-lg border border-amber-200 bg-amber-50/50 p-3"
	>
		<AlertTriangle class="h-4 w-4 text-amber-600" />
		<span class="text-lg font-semibold text-amber-700">{stats.runningLow}</span>
		<span class="text-[10px] tracking-wide text-amber-600 uppercase">Running Low</span>
	</div>

	<div class="flex flex-col items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/50 p-3">
		<ShoppingCart class="h-4 w-4 text-rose-600" />
		<span class="text-lg font-semibold text-rose-700">{stats.needsRestock}</span>
		<span class="text-[10px] tracking-wide text-rose-600 uppercase">Restock</span>
	</div>
</div>
