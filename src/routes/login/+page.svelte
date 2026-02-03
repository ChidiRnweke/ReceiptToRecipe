<script lang="ts">
  import { ChefHat, Sparkles } from "lucide-svelte";
</script>

<svelte:head>
  <title>Log In - Receipt2Recipe</title>
  <meta http-equiv="refresh" content="0;url=/" />
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-bg-paper p-4 relative overflow-hidden">
  <!-- Desk Texture -->
  <div
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.08),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.08),transparent_28%)]"
  ></div>

  <!-- Decorative Elements -->
  <div class="absolute top-10 left-10 opacity-10 rotate-12 pointer-events-none">
      <ChefHat class="h-32 w-32 text-ink" />
  </div>
  <div class="absolute bottom-10 right-10 opacity-5 -rotate-12 pointer-events-none">
      <Sparkles class="h-40 w-40 text-amber-500" />
  </div>

  <div class="relative z-10 w-full max-w-md">
    <!-- Header -->
    <div class="mb-8 text-center">
      <div class="relative mx-auto w-fit mb-6">
        <div class="flex h-20 w-20 items-center justify-center rounded-full bg-white border border-stone-200 shadow-sm">
          <ChefHat class="h-10 w-10 text-ink" />
        </div>
      </div>
      <h1 class="font-display text-4xl text-ink">Welcome</h1>
      <p class="mt-2 font-serif text-ink-light italic">Redirecting to login...</p>
    </div>

    <!-- Simple card with redirect info -->
    <div class="relative bg-[#fffdf5] rounded-sm shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-stone-200 p-8 md:p-10 rotate-[0.5deg]">
        <!-- Top decorative border -->
        <div class="absolute top-3 left-3 right-3 h-px border-t border-dashed border-stone-300"></div>
        <div class="absolute bottom-3 left-3 right-3 h-px border-b border-dashed border-stone-300"></div>

        <div class="relative z-10 text-center space-y-4">
          <p class="font-serif text-text-secondary">
            Please wait while we redirect you to the authentication provider.
          </p>
          
          <div class="pt-4">
            <a 
              href="/" 
              class="font-ui text-xs uppercase tracking-widest text-text-muted hover:text-text-secondary transition-colors"
            >
              Click here if not redirected
            </a>
          </div>
        </div>
    </div>
  </div>
</div>
