<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div class="flex items-center justify-between py-3">
	<div class="flex items-center gap-3">
		<Skeleton class="h-5 w-5 rounded-full" />
		<Skeleton class="h-4 w-48" />
	</div>
	<Skeleton class="h-6 w-16" />
</div>
