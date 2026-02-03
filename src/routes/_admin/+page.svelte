<script lang="ts">
    import { enhance } from '$app/forms';
    import { Check, ShieldAlert } from 'lucide-svelte';
    import { Button } from '$lib/components/ui/button';
    import * as Card from '$lib/components/ui/card';

    let { data } = $props();
</script>

<div class="container mx-auto py-10 px-4 max-w-4xl">
    <div class="flex items-center gap-4 mb-8">
        <div class="p-3 bg-primary-100 rounded-lg text-primary-700">
             <ShieldAlert class="w-6 h-6" />
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
                <div class="py-12 text-center text-ink-muted bg-sand-50 rounded-lg border border-dashed border-sand">
                    All caught up! No chefs waiting.
                </div>
            {:else}
                <div class="space-y-4">
                    {#each data.waitingUsers as user}
                        <div class="flex items-center justify-between p-4 border border-border rounded-lg bg-white hover:bg-bg-hover transition-colors">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 rounded-full bg-sand-200 overflow-hidden flex items-center justify-center text-ink-muted font-bold text-lg">
                                    {#if user.avatarUrl}
                                        <img src={user.avatarUrl} alt={user.name} class="w-full h-full object-cover" />
                                    {:else}
                                        {user.name[0].toUpperCase()}
                                    {/if}
                                </div>
                                <div>
                                    <p class="font-bold text-ink">{user.name}</p>
                                    <p class="text-sm text-ink-muted">{user.email}</p>
                                    <p class="text-xs text-ink-muted mt-1">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            
                            <form method="POST" action="?/approve" use:enhance>
                                <input type="hidden" name="userId" value={user.id} />
                                <Button type="submit" size="sm" class="bg-sage-600 hover:bg-sage-500 text-white gap-2">
                                    <Check class="w-4 h-4" />
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