<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Card from "$lib/components/ui/card";
  import { ChefHat, User, Mail, Lock, Sparkles, ArrowRight } from "lucide-svelte";

  let { form } = $props();
  let loading = $state(false);
</script>

<svelte:head>
  <title>Join - Receipt2Recipe</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-[#FDFBF7] p-4 relative overflow-hidden">
  <!-- Desk Texture -->
  <div
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.08),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.08),transparent_28%)]"
  ></div>

  <!-- Decorative Elements -->
  <div class="absolute top-10 right-10 opacity-10 -rotate-12 pointer-events-none">
      <ChefHat class="h-40 w-40 text-ink" />
  </div>

  <div class="relative z-10 w-full max-w-md">
    <!-- Header -->
    <div class="mb-8 text-center">
      <div class="relative mx-auto w-fit mb-6">
        <div class="flex h-20 w-20 items-center justify-center rounded-full bg-white border border-stone-200 shadow-sm relative">
          <ChefHat class="h-10 w-10 text-ink" />
          <div class="absolute -top-1 -right-1">
              <Sparkles class="h-6 w-6 text-amber-400" />
          </div>
        </div>
      </div>
      <h1 class="font-display text-4xl text-ink">Join the Kitchen</h1>
      <p class="mt-2 font-serif text-ink-light italic">Begin your culinary collection.</p>
    </div>

    <!-- The Guest Book Card -->
    <div class="relative bg-[#fffdf5] rounded-sm shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-stone-200 p-8 md:p-10 -rotate-[0.5deg]">
        <!-- Top decorative border -->
        <div class="absolute top-3 left-3 right-3 h-px border-t border-dashed border-stone-300"></div>
        <div class="absolute bottom-3 left-3 right-3 h-px border-b border-dashed border-stone-300"></div>

        <form
            method="POST"
            use:enhance={() => {
                loading = true;
                return async ({ update }) => {
                    loading = false;
                    await update();
                };
            }}
            class="space-y-6 relative z-10"
        >
            {#if form?.error}
                <div class="bg-red-50/50 border border-red-100 text-red-800 text-sm p-3 rounded-sm text-center font-serif">
                    {form.error}
                </div>
            {/if}

            <div class="space-y-2">
                <Label for="name" class="font-mono text-xs uppercase tracking-widest text-stone-500">Full Name</Label>
                <div class="relative">
                    <User class="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <Input
                        id="name"
                        name="name"
                        type="text"
                        placeholder="Chef Gusteau"
                        required
                        value={form?.name ?? ''}
                        class="pl-8 bg-transparent border-0 border-b border-stone-300 rounded-none px-0 py-2 focus:ring-0 focus:border-stone-800 transition-colors font-serif text-lg placeholder:text-stone-300 placeholder:italic shadow-none"
                    />
                </div>
            </div>

            <div class="space-y-2">
                <Label for="email" class="font-mono text-xs uppercase tracking-widest text-stone-500">Email Address</Label>
                <div class="relative">
                    <Mail class="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="chef@example.com"
                        required
                        value={form?.email ?? ''}
                        class="pl-8 bg-transparent border-0 border-b border-stone-300 rounded-none px-0 py-2 focus:ring-0 focus:border-stone-800 transition-colors font-serif text-lg placeholder:text-stone-300 placeholder:italic shadow-none"
                    />
                </div>
            </div>

            <div class="space-y-2">
                <Label for="password" class="font-mono text-xs uppercase tracking-widest text-stone-500">Password</Label>
                <div class="relative">
                    <Lock class="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        required
                        minlength={8}
                        class="pl-8 bg-transparent border-0 border-b border-stone-300 rounded-none px-0 py-2 focus:ring-0 focus:border-stone-800 transition-colors font-serif text-lg placeholder:text-stone-300 placeholder:tracking-widest shadow-none"
                    />
                </div>
                <p class="text-[10px] text-stone-400 text-right">At least 8 characters</p>
            </div>

            <div class="pt-4">
                <Button type="submit" class="w-full bg-ink text-white hover:bg-stone-800 font-display text-lg h-12 rounded-sm shadow-md transition-transform active:scale-[0.98]" disabled={loading}>
                    {loading ? 'Creating Account...' : 'Get Started'}
                    {#if !loading}
                        <ArrowRight class="ml-2 h-4 w-4" />
                    {/if}
                </Button>
            </div>
        </form>

        <div class="mt-8 pt-6 border-t border-stone-200 text-center">
            <p class="font-serif text-stone-500 text-sm">
                Already have a spot? 
                <a href="/login" class="text-ink font-bold hover:underline decoration-wavy decoration-sage-300 underline-offset-4">
                    Sign in here
                </a>
            </p>
        </div>
    </div>
  </div>
</div>