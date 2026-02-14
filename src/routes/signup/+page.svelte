<script lang="ts">
  import { enhance } from "$app/forms";
  import { ChefHat, Sparkles, ArrowRight, Mail } from "lucide-svelte";
  import type { ActionData } from "./$types";

  let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
  <title>Join Waitlist - Receipt2Recipe</title>
</svelte:head>

<div
  class="flex min-h-screen flex-col items-center justify-center bg-[#fdfaf6] p-4 relative overflow-hidden"
>
  <!-- Desk Texture -->
  <div
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.03),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.03),transparent_28%)]"
  ></div>

  <!-- Decorative Elements -->
  <div class="absolute top-10 left-10 opacity-5 rotate-12 pointer-events-none">
    <ChefHat class="h-32 w-32 text-stone-800" />
  </div>
  <div
    class="absolute bottom-10 right-10 opacity-5 -rotate-12 pointer-events-none"
  >
    <Sparkles class="h-40 w-40 text-amber-500" />
  </div>

  <div class="relative z-10 w-full max-w-md">
    <!-- Header -->
    <div class="mb-8 text-center">
      <div class="relative mx-auto w-fit mb-6">
        <div
          class="flex h-20 w-20 items-center justify-center rounded-full bg-white border border-stone-200 shadow-sm"
        >
          <ChefHat class="h-10 w-10 text-stone-700" />
        </div>
      </div>
      <h1 class="font-display text-4xl text-stone-800 font-bold tracking-tight">
        Receipt to Recipe
      </h1>
      <p class="mt-3 font-serif text-stone-600 italic text-lg">
        Turn your grocery receipts into delicious meals.
      </p>
    </div>

    <!-- Signup Card -->
    <div
      class="relative bg-white rounded-lg shadow-xl border border-stone-200 p-8 md:p-10"
    >
      <div
        class="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-amber-400 to-orange-500 rounded-t-lg"
      ></div>

      <div class="relative z-10 space-y-6">
        <div class="text-center space-y-2">
          {#if form?.userExists}
            <h2 class="text-xl font-semibold text-stone-800">
              You already have an account!
            </h2>
            <p class="text-stone-500 text-sm">
              It looks like that email is already registered.
            </p>
          {:else}
            <h2 class="text-xl font-semibold text-stone-800">
              Join the Waitlist
            </h2>
            <p class="text-stone-500 text-sm">
              We're currently in private beta. Sign up to get early access.
            </p>
          {/if}
        </div>

        {#if form?.userExists}
          <div class="space-y-4">
            <a
              href="/login"
              class="w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors shadow-sm"
            >
              Log In
              <ArrowRight class="ml-2 h-4 w-4" />
            </a>

            <div class="text-center">
              <button
                class="text-xs text-stone-400 hover:text-stone-600 transition-colors underline"
                onclick={() => {
                  window.location.href = "/signup";
                }}
              >
                Use a different email
              </button>
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
                  <Mail class="h-5 w-5 text-stone-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  id="email"
                  class="block w-full pl-10 pr-3 py-3 border border-stone-300 rounded-md leading-5 bg-stone-50 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 sm:text-sm transition duration-150 ease-in-out"
                  placeholder="you@example.com"
                  value={form?.email ?? ""}
                  required
                />
              </div>
              {#if form?.errors?.email}
                <p class="mt-1 text-sm text-red-600">{form.errors.email[0]}</p>
              {/if}
              {#if form?.message && !form?.userExists}
                <p class="mt-1 text-sm text-red-600">{form.message}</p>
              {/if}
            </div>

            <button
              type="submit"
              class="w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-stone-800 hover:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-900 transition-colors shadow-sm group"
            >
              Request Access
              <ArrowRight
                class="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform"
              />
            </button>
          </form>

          <div class="pt-4 text-center">
            <a
              href="/login"
              class="text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              Already have an account? Log in
            </a>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
