<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { ChefHat, ArrowRight, Mail } from "lucide-svelte";
  import type { ActionData } from "./$types";

  let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
  <title>Join Waitlist - Receipt2Recipe</title>
</svelte:head>

<div
  class="flex min-h-screen flex-col items-center justify-center bg-bg-paper p-4 relative overflow-hidden"
>
  <!-- Desk Texture -->
  <div
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.08),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.08),transparent_28%)]"
  ></div>

  <div class="relative z-10 w-full max-w-md">
    <!-- Header -->
    <div class="mb-8 text-center">
      <div class="relative mx-auto w-fit mb-6">
        <div
          class="flex h-20 w-20 items-center justify-center rounded-full bg-white border border-border shadow-sm"
        >
          <ChefHat class="h-10 w-10 text-ink" />
        </div>
      </div>
      <h1 class="font-display text-4xl text-ink font-bold tracking-tight">
        Receipt to Recipe
      </h1>
      <p class="mt-3 font-serif text-ink-light italic text-lg">
        Turn your grocery receipts into delicious meals.
      </p>
    </div>

    <!-- Signup Card -->
    <div class="paper-card relative p-8 md:p-10 rounded-sm rotate-[0.5deg]">
      <!-- Top decorative border -->
      <div class="absolute top-3 left-3 right-3 h-px border-t border-dashed border-border"></div>
      <div class="absolute bottom-3 left-3 right-3 h-px border-b border-dashed border-border"></div>

      <div class="relative z-10 space-y-6">
        <div class="text-center space-y-2">
          {#if form?.userExists}
            <h2 class="font-display text-2xl text-ink">
              You already have an account!
            </h2>
            <p class="font-serif text-ink-light text-sm">
              It looks like that email is already registered.
            </p>
          {:else}
            <h2 class="font-display text-2xl text-ink">Join the Waitlist</h2>
            <p class="font-serif text-ink-light text-sm">
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
                  window.location.href = "/signup";
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
                <div
                  class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                >
                  <Mail class="h-5 w-5 text-text-muted" />
                </div>
                <Input
                  type="email"
                  name="email"
                  id="email"
                  placeholder="you@example.com"
                  value={form?.email ?? ""}
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

            <Button type="submit" class="w-full group">
              Request Access
              <ArrowRight
                class="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform"
              />
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
