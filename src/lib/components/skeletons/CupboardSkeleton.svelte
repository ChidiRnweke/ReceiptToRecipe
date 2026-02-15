<script lang="ts">
	import Skeleton from '$lib/components/ui/skeleton/skeleton.svelte';
</script>

<div class="space-y-6">
	<!-- Stats skeleton -->
	<div class="grid grid-cols-3 gap-3">
		{#each [1, 2, 3] as _}
			<div class="flex flex-col items-center gap-2 rounded-lg border border-sand/40 p-3">
				<Skeleton class="h-4 w-4 rounded-full" />
				<Skeleton class="h-6 w-8" />
				<Skeleton class="h-3 w-14" />
			</div>
		{/each}
	</div>

	<!-- Add item skeleton -->
	<Skeleton class="h-10 w-full rounded-lg" />

	<!-- Filter skeleton -->
	<div class="flex gap-2">
		{#each [1, 2, 3, 4] as _}
			<Skeleton class="h-7 w-20 rounded-full" />
		{/each}
	</div>

	<!-- Item skeletons -->
	<div class="space-y-2">
		{#each [1, 2, 3, 4, 5, 6] as _}
			<div class="flex items-center gap-3 rounded-lg border border-sand/40 p-3">
				<Skeleton class="h-6 w-6 rounded-full" />
				<div class="flex-1 space-y-1.5">
					<Skeleton class="h-4 w-32" />
					<Skeleton class="h-3 w-24" />
				</div>
				<Skeleton class="h-5 w-16 rounded-full" />
			</div>
		{/each}
	</div>
</div>
