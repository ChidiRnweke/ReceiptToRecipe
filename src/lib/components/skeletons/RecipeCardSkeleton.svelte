<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div class="group relative mb-8 block break-inside-avoid">
	<div
		class="relative overflow-hidden rounded-xl border border-border bg-bg-paper p-3 shadow-[2px_2px_0_rgba(0,0,0,0.05)]"
	>
		<div
			class="relative aspect-video overflow-hidden rounded-lg border border-black/5 bg-bg-paper-dark"
		>
			<Skeleton class="h-full w-full" />
		</div>

		<div class="px-1 pt-4 pb-2">
			<Skeleton class="mb-3 h-6 w-3/4" />
			<div class="flex flex-wrap gap-2">
				<Skeleton class="h-5 w-16" />
				<Skeleton class="h-5 w-12" />
			</div>
		</div>
	</div>
</div>
