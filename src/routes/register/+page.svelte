<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';

	let { form } = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Sign Up - Receipt2Recipe</title>
</svelte:head>

<div class="flex min-h-[60vh] items-center justify-center">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="text-center">
			<Card.Title class="font-serif text-2xl">Create Account</Card.Title>
			<Card.Description>Start transforming your receipts into recipes</Card.Description>
		</Card.Header>
		<Card.Content>
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
					<Label for="name">Name</Label>
					<Input
						id="name"
						name="name"
						type="text"
						placeholder="Your name"
						required
						value={form?.name ?? ''}
					/>
				</div>

				<div class="space-y-2">
					<Label for="email">Email</Label>
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
					<Label for="password">Password</Label>
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

				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? 'Creating account...' : 'Create Account'}
				</Button>
			</form>
		</Card.Content>
		<Card.Footer class="justify-center">
			<p class="text-sm text-ink-light">
				Already have an account?
				<a href="/login" class="font-medium text-sage-600 hover:underline">Sign in</a>
			</p>
		</Card.Footer>
	</Card.Root>
</div>
