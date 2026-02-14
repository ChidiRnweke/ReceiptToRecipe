<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ChefHat, CheckCircle, ArrowRight } from 'lucide-svelte';
</script>

<svelte:head>
	<title>You're on the list! - Receipt2Recipe</title>
</svelte:head>

<div
	class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg-paper p-4"
>
	<!-- Desk Texture -->
	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.08),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.08),transparent_28%)]"
	></div>

	<div class="relative z-10 w-full max-w-md">
		<!-- Header -->
		<div class="mb-8 text-center">
			<div class="relative mx-auto mb-6 w-fit">
				<div
					class="border-success-200 flex h-20 w-20 items-center justify-center rounded-full border bg-success-50 shadow-sm"
				>
					<CheckCircle class="h-10 w-10 text-success-600" />
				</div>
			</div>
			<h1 class="font-display text-4xl font-bold tracking-tight text-ink">You're on the list!</h1>
		</div>

		<!-- Success Card -->
		<div class="paper-card relative -rotate-[0.5deg] rounded-sm p-8 md:p-10">
			<!-- Top decorative border -->
			<div class="absolute top-3 right-3 left-3 h-px border-t border-dashed border-border"></div>
			<div class="absolute right-3 bottom-3 left-3 h-px border-b border-dashed border-border"></div>

			<div class="relative z-10 space-y-6 text-center">
				<p class="font-serif text-lg text-ink-light">
					Thanks for your interest in Receipt2Recipe. We've added your email to our waitlist.
				</p>

				<p class="font-serif text-sm text-text-muted">
					We'll notify you as soon as a spot opens up. Keep an eye on your inbox!
				</p>

				<div class="border-t border-border pt-6">
					<Button href="/" variant="link" class="text-sm">
						Return to home
						<ArrowRight class="ml-1 h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	</div>
</div>
