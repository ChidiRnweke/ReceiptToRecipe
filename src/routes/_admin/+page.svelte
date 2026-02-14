<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, ShieldAlert } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';

	let { data } = $props();
</script>

<div class="container mx-auto max-w-4xl px-4 py-10">
	<div class="mb-8 flex items-center gap-4">
		<div class="rounded-lg bg-primary-100 p-3 text-primary-700">
			<ShieldAlert class="h-6 w-6" />
		</div>
		<div>
			<h1 class="font-display text-3xl text-ink">Kitchen Administration</h1>
			<p class="text-ink-muted">Manage access and chef permissions.</p>
		</div>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Waiting List ({data.waitingUsers.length})</Card.Title>
			<Card.Description>Chefs waiting for their apron.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if data.waitingUsers.length === 0}
				<div
					class="bg-sand-50 rounded-lg border border-dashed border-sand py-12 text-center text-ink-muted"
				>
					All caught up! No chefs waiting.
				</div>
			{:else}
				<div class="space-y-4">
					{#each data.waitingUsers as user}
						<div
							class="flex items-center justify-between rounded-lg border border-border bg-white p-4 transition-colors hover:bg-bg-hover"
						>
							<div class="flex items-center gap-4">
								<div
									class="bg-sand-200 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-lg font-bold text-ink-muted"
								>
									{#if user.avatarUrl}
										<img src={user.avatarUrl} alt={user.name} class="h-full w-full object-cover" />
									{:else}
										{user.name[0].toUpperCase()}
									{/if}
								</div>
								<div>
									<p class="font-bold text-ink">{user.name}</p>
									<p class="text-sm text-ink-muted">{user.email}</p>
									<p class="mt-1 text-xs text-ink-muted">
										Joined {new Date(user.createdAt).toLocaleDateString()}
									</p>
								</div>
							</div>

							<form method="POST" action="?/approve" use:enhance>
								<input type="hidden" name="userId" value={user.id} />
								<Button
									type="submit"
									size="sm"
									class="gap-2 bg-sage-600 text-white hover:bg-sage-500"
								>
									<Check class="h-4 w-4" />
									Approve
								</Button>
							</form>
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
