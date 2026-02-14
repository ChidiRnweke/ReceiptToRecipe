<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { ChefHat, ArrowRight, Mail } from 'lucide-svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Join Waitlist - Receipt2Recipe</title>
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
					class="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-white shadow-sm"
				>
					<ChefHat class="h-10 w-10 text-ink" />
				</div>
			</div>
			<h1 class="font-display text-4xl font-bold tracking-tight text-ink">Receipt to Recipe</h1>
			<p class="mt-3 font-serif text-lg text-ink-light italic">
				Turn your grocery receipts into delicious meals.
			</p>
		</div>

		<!-- Signup Card -->
		<div class="paper-card relative rotate-[0.5deg] rounded-sm p-8 md:p-10">
			<!-- Top decorative border -->
			<div class="absolute top-3 right-3 left-3 h-px border-t border-dashed border-border"></div>
			<div class="absolute right-3 bottom-3 left-3 h-px border-b border-dashed border-border"></div>

			<div class="relative z-10 space-y-6">
				<div class="space-y-2 text-center">
					{#if form?.userExists}
						<h2 class="font-display text-2xl text-ink">You already have an account!</h2>
						<p class="font-serif text-sm text-ink-light">
							It looks like that email is already registered.
						</p>
					{:else}
						<h2 class="font-display text-2xl text-ink">Join the Waitlist</h2>
						<p class="font-serif text-sm text-ink-light">
							We're currently in private beta. Sign up to get early access.
						</p>
					{/if}
				</div>

				{#if form?.userExists}
					<div class="space-y-4">
						<Button href="/login" class="w-full">
							Log In
							<ArrowRight class="ml-2 h-4 w-4" />
						</Button>

						<div class="text-center">
							<Button
								variant="link"
								class="text-xs text-text-muted hover:text-ink"
								onclick={() => {
									window.location.href = '/signup';
								}}
							>
								Use a different email
							</Button>
						</div>
					</div>
				{:else}
					<form method="POST" use:enhance class="space-y-4">
						<div class="space-y-2">
							<label for="email" class="sr-only">Email address</label>
							<div class="relative">
								<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
									<Mail class="h-5 w-5 text-text-muted" />
								</div>
								<Input
									type="email"
									name="email"
									id="email"
									placeholder="you@example.com"
									value={form?.email ?? ''}
									required
									class="pl-10"
								/>
							</div>
							{#if form?.errors?.email}
								<p class="mt-1 text-sm text-danger-600">{form.errors.email[0]}</p>
							{/if}
							{#if form?.message && !form?.userExists}
								<p class="mt-1 text-sm text-danger-600">{form.message}</p>
							{/if}
						</div>

						<Button type="submit" class="group w-full">
							Request Access
							<ArrowRight class="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
						</Button>
					</form>

					<div class="pt-4 text-center">
						<Button href="/login" variant="link" class="text-xs text-text-muted hover:text-ink">
							Already have an account? Log in
						</Button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
