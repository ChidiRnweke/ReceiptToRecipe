<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { ChefHat, Mail, Lock } from 'lucide-svelte';

	let { form } = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Log In - Receipt2Recipe</title>
</svelte:head>

<div class="flex min-h-[60vh] items-center justify-center py-8">
	<div class="w-full max-w-md">
		<!-- Logo -->
		<div class="mb-8 text-center">
			<div class="relative mx-auto w-fit">
				<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-100">
					<ChefHat class="h-8 w-8 text-sage-600" />
				</div>
			</div>
			<h1 class="mt-4 font-serif text-3xl font-medium text-ink">Welcome back</h1>
			<p class="mt-1 text-ink-light">Sign in to continue cooking</p>
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
					<Input id="password" name="password" type="password" placeholder="••••••••" required />
				</div>

				<Button type="submit" class="w-full" size="lg" disabled={loading}>
					{loading ? 'Signing in...' : 'Sign In'}
				</Button>
			</form>
		</Card.Content>
		<Card.Footer class="justify-center border-t border-sand">
			<p class="text-sm text-ink-light">
				New here?
				<a href="/register" class="font-medium text-sage-600 hover:underline">Create an account</a>
			</p>
		</Card.Footer>
	</Card.Root>
	</div>
</div>
