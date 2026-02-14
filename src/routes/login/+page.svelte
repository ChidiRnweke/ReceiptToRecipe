<script lang="ts">
	import { ChefHat, Sparkles } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Log In - Receipt2Recipe</title>
	<meta http-equiv="refresh" content="0;url=/" />
</svelte:head>

<div
	class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg-paper p-4"
>
	<!-- Desk Texture -->
	<div
		class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.08),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.08),transparent_28%)]"
	></div>

	<!-- Decorative Elements -->
	<div class="pointer-events-none absolute top-10 left-10 rotate-12 opacity-10">
		<ChefHat class="h-32 w-32 text-ink" />
	</div>
	<div class="pointer-events-none absolute right-10 bottom-10 -rotate-12 opacity-5">
		<Sparkles class="h-40 w-40 text-amber-500" />
	</div>

	<div class="relative z-10 w-full max-w-md">
		<!-- Header -->
		<div class="mb-8 text-center">
			<div class="relative mx-auto mb-6 w-fit">
				<div
					class="flex h-20 w-20 items-center justify-center rounded-full border border-stone-200 bg-white shadow-sm"
				>
					<ChefHat class="h-10 w-10 text-ink" />
				</div>
			</div>
			<h1 class="font-display text-4xl text-ink">Welcome</h1>
			<p class="mt-2 font-serif text-ink-light italic">Redirecting to login...</p>
		</div>

		<!-- Simple card with redirect info -->
		<div
			class="relative rotate-[0.5deg] rounded-sm border border-stone-200 bg-[#fffdf5] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] md:p-10"
		>
			<!-- Top decorative border -->
			<div class="absolute top-3 right-3 left-3 h-px border-t border-dashed border-stone-300"></div>
			<div
				class="absolute right-3 bottom-3 left-3 h-px border-b border-dashed border-stone-300"
			></div>

			<div class="relative z-10 space-y-4 text-center">
				<p class="font-serif text-text-secondary">
					Please wait while we redirect you to the authentication provider.
				</p>

				<div class="pt-4">
					<a
						href="/"
						class="font-ui text-xs tracking-widest text-text-muted uppercase transition-colors hover:text-text-secondary"
					>
						Click here if not redirected
					</a>
				</div>
			</div>
		</div>
	</div>
</div>
