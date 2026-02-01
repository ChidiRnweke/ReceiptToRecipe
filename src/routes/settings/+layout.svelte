<script lang="ts">
	import { page } from '$app/stores';
	import { User, Settings, Heart, ArrowLeft } from 'lucide-svelte';
    import { Button } from "$lib/components/ui/button";

	let { children } = $props();

	const navItems = [
		{ href: '/preferences', label: 'General', icon: Settings },
		{ href: '/settings/taste-profile', label: 'Taste Profile', icon: Heart },
		// { href: '/settings/account', label: 'Account', icon: User },
	];
</script>

<div class="min-h-screen bg-[#FDFBF7] p-6 md:p-10 font-serif text-ink">
    <div class="mx-auto max-w-5xl">
        <div class="mb-8">
            <Button href="/" variant="ghost" class="pl-0 hover:bg-transparent hover:text-sage-600 mb-2">
                <ArrowLeft class="mr-2 h-4 w-4" />
                Back to Kitchen
            </Button>
            <h1 class="font-display text-4xl text-ink">Kitchen Settings</h1>
            <p class="text-ink-light mt-2">Customize your culinary experience.</p>
        </div>

        <div class="flex flex-col md:flex-row gap-8">
            <!-- Sidebar -->
            <aside class="w-full md:w-64 shrink-0">
                <nav class="space-y-1">
                    {#each navItems as item}
                        {@const isActive = $page.url.pathname === item.href}
                        <a
                            href={item.href}
                            class="flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                            {isActive 
                                ? 'bg-sage-100 text-sage-900 font-medium' 
                                : 'text-ink-light hover:bg-stone-100 hover:text-ink'}"
                        >
                            <item.icon class="h-4 w-4" />
                            {item.label}
                        </a>
                    {/each}
                </nav>
            </aside>

            <!-- Content -->
            <div class="flex-1 min-w-0">
                {@render children()}
            </div>
        </div>
    </div>
</div>
