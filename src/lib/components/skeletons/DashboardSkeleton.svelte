<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { ShoppingCart, Store, Lightbulb, Upload } from 'lucide-svelte';
</script>

<!-- Sidebar Skeleton -->
<aside
	class="hidden h-full w-[320px] shrink-0 rounded-tl-4xl rounded-bl-4xl border-r border-sand bg-bg-paper-dark/80 px-6 py-6 backdrop-blur-sm lg:block"
>
	<div class="flex h-full flex-col gap-6">
		<div class="space-y-6">
			<!-- Greeting -->
			<div class="flex items-center gap-2 text-xs tracking-[0.18em] text-ink-muted uppercase">
				<Skeleton class="h-4 w-32" />
			</div>

			<!-- Tip Card -->
			<div class="rounded-xl border border-border bg-bg-card p-4 shadow-sm">
				<div class="flex items-start gap-3">
					<div class="mt-0.5 text-amber-600">
						<Lightbulb class="h-4 w-4" />
					</div>
					<div class="flex-1">
						<Skeleton class="mb-2 h-3 w-full" />
						<Skeleton class="h-3 w-2/3" />
					</div>
				</div>
			</div>

			<!-- Scan & Sort Card -->
			<div class="rounded-xl border border-border bg-bg-card shadow-sm">
				<div class="border-b border-dashed border-border p-5">
					<div class="mb-3 flex items-center justify-between">
						<div class="flex items-center gap-3">
							<Skeleton class="h-5 w-24" />
						</div>
						<div
							class="flex h-8 w-8 items-center justify-center rounded-lg bg-sage-50 text-sage-600"
						>
							<Upload class="h-4 w-4" />
						</div>
					</div>
					<Skeleton class="h-9 w-full rounded-md" />
				</div>

				<!-- Shopping List -->
				<div class="p-2">
					<div class="flex w-full items-center justify-between rounded-lg p-3">
						<div>
							<p class="text-[10px] tracking-wider text-ink-muted uppercase">Shopping List</p>
							<Skeleton class="mt-1 h-8 w-16" />
							<div class="mt-1 flex items-center gap-2">
								<Skeleton class="h-1.5 w-16 rounded-full" />
								<Skeleton class="h-2.5 w-6" />
							</div>
						</div>
						<ShoppingCart class="h-5 w-5 text-sage-600" />
					</div>
				</div>
			</div>
		</div>

		<!-- Pantry List -->
		<div class="mb-4 rotate-1 rounded-xl border border-sand/60 bg-bg-card p-4 shadow-sm">
			<div
				class="mb-2 flex items-center gap-2 border-b border-sand/40 pb-2 text-xs tracking-wider text-text-muted uppercase"
			>
				<Store class="h-3 w-3" />
				<Skeleton class="h-3 w-20" />
			</div>
			<div class="max-h-40 space-y-2 overflow-y-auto">
				{#each Array(4) as _, i}
					<div class="flex items-center justify-between text-sm">
						<Skeleton class="h-4 w-32" />
						<Skeleton class="h-4 w-12" />
					</div>
				{/each}
			</div>
		</div>
	</div>
</aside>

<!-- Main Content Skeleton -->
<main
	class="relative z-10 flex flex-1 flex-col rounded-4xl bg-white lg:rounded-l-none lg:rounded-r-4xl"
>
	<div class="mx-auto w-full max-w-5xl px-6 py-6 sm:px-10">
		<!-- Header -->
		<div class="mb-8 flex flex-wrap items-end justify-between gap-4">
			<div class="w-full max-w-lg">
				<Skeleton class="mb-2 h-5 w-48" />
				<Skeleton class="mb-4 h-10 w-full max-w-md" />
				<div class="flex items-center gap-2">
					<Skeleton class="h-3 w-12" />
					<Skeleton class="h-3 w-3" />
					<Skeleton class="h-3 w-12" />
					<Skeleton class="h-3 w-3" />
					<Skeleton class="h-3 w-12" />
				</div>
			</div>
			<Skeleton class="h-10 w-40 rounded-lg" />
		</div>

		<!-- Featured Recipe + Ingredients -->
		<div class="grid items-stretch gap-8 lg:grid-cols-12">
			<div class="lg:col-span-7">
				<div
					class="group relative flex h-full flex-col overflow-hidden rounded-l-md rounded-r-2xl border border-border bg-bg-paper shadow-sm md:flex-row"
				>
					<div class="relative h-40 w-full p-5 pr-2 md:h-auto md:w-5/12">
						<Skeleton class="h-full w-full rounded-lg" />
					</div>
					<div class="relative flex w-full flex-col justify-center p-6 md:w-7/12 md:p-8">
						<Skeleton class="mb-3 h-3 w-32" />
						<Skeleton class="mb-4 h-8 w-48" />
						<div class="flex gap-4">
							<Skeleton class="h-4 w-24" />
							<Skeleton class="h-4 w-20" />
						</div>
						<Skeleton class="mt-4 h-12 w-full" />
					</div>
				</div>
			</div>

			<div class="lg:col-span-5">
				<div
					class="relative mx-auto flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-bg-card shadow-sm"
				>
					<div
						class="flex shrink-0 items-center justify-between border-b border-border bg-bg-elevated px-6 py-4"
					>
						<Skeleton class="h-3 w-24" />
						<div class="flex gap-1">
							<Skeleton class="h-1.5 w-1.5 rounded-full" />
							<Skeleton class="h-1.5 w-1.5 rounded-full" />
							<Skeleton class="h-1.5 w-1.5 rounded-full" />
						</div>
					</div>
					<div class="relative flex-1 p-4">
						{#each Array(6) as _, i}
							<div class="flex items-center gap-3 py-3">
								<Skeleton class="h-5 w-5 rounded-full" />
								<Skeleton class="h-4 flex-1" />
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- Recent Recipes Section -->
		<div class="mt-16">
			<div class="mb-6 flex items-baseline justify-between border-b border-border pb-2">
				<Skeleton class="h-8 w-48" />
				<Skeleton class="h-4 w-32" />
			</div>

			<div class="columns-1 gap-6 md:columns-2 lg:columns-3">
				{#each Array(6) as _, i}
					<slot name="recipe-card-skeleton">
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
					</slot>
				{/each}
			</div>
		</div>
	</div>
</main>
