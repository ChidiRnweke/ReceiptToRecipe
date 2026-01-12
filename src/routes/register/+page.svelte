<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { ChefHat, User, Mail, Lock, Sparkles } from 'lucide-svelte';

	let { form } = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Sign Up - Receipt2Recipe</title>
</svelte:head>

<div class="flex min-h-[60vh] items-center justify-center py-8">
	<div class="w-full max-w-md">
		<!-- Logo -->
		<div class="mb-8 text-center">
			<div class="relative mx-auto w-fit">
				<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-100">
					<ChefHat class="h-8 w-8 text-sage-600" />
				</div>
				<Sparkles class="absolute -right-2 -top-2 h-5 w-5 text-sage-500" />
			</div>
			<h1 class="mt-4 font-serif text-3xl font-medium text-ink">Join the kitchen</h1>
			<p class="mt-1 text-ink-light">Start transforming receipts into delicious meals</p>
		</div>

		<Card.Root class="border-sand shadow-lg">
		<Card.Content class="pt-6">
			<form
				method="POST"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						loading = false;
						await update();
					};
				}}
				class="space-y-4"
			>
				{#if form?.error}
					<div class="rounded-lg bg-sienna-50 p-3 text-sm text-sienna-700">
						{form.error}
					</div>
				{/if}

				<div class="space-y-2">
					<Label for="name" class="flex items-center gap-2">
						<User class="h-4 w-4 text-ink-muted" />
						Name
					</Label>
					<Input
						id="name"
						name="name"
						type="text"
						placeholder="What should we call you?"
						required
						value={form?.name ?? ''}
					/>
				</div>

				<div class="space-y-2">
					<Label for="email" class="flex items-center gap-2">
						<Mail class="h-4 w-4 text-ink-muted" />
						Email
					</Label>
					<Input
						id="email"
						name="email"
						type="email"
						placeholder="you@example.com"
						required
						value={form?.email ?? ''}
					/>
				</div>

				<div class="space-y-2">
					<Label for="password" class="flex items-center gap-2">
						<Lock class="h-4 w-4 text-ink-muted" />
						Password
					</Label>
					<Input
						id="password"
						name="password"
						type="password"
						placeholder="••••••••"
						required
						minlength={8}
					/>
					<p class="text-xs text-ink-muted">At least 8 characters</p>
				</div>

				<Button type="submit" class="w-full" size="lg" disabled={loading}>
					{#if loading}
						Creating your account...
					{:else}
						<Sparkles class="mr-2 h-4 w-4" />
						Get Started
					{/if}
				</Button>
			</form>
		</Card.Content>
		<Card.Footer class="justify-center border-t border-sand">
			<p class="text-sm text-ink-light">
				Already have an account?
				<a href="/login" class="font-medium text-sage-600 hover:underline">Sign in</a>
			</p>
		</Card.Footer>
	</Card.Root>
	</div>
</div>
