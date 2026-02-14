<script lang="ts">
  import { ChefHat, CheckCircle, ArrowRight } from "lucide-svelte";
</script>

<svelte:head>
  <title>You're on the list! - Receipt2Recipe</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-[#fdfaf6] p-4 relative overflow-hidden">
  <!-- Desk Texture -->
  <div
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.03),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.03),transparent_28%)]"
  ></div>

  <!-- Decorative Elements -->
  <div class="absolute top-10 left-10 opacity-5 rotate-12 pointer-events-none">
      <ChefHat class="h-32 w-32 text-stone-800" />
  </div>

  <div class="relative z-10 w-full max-w-md">
    <!-- Header -->
    <div class="mb-8 text-center">
      <div class="relative mx-auto w-fit mb-6">
        <div class="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 border border-green-200 shadow-sm">
          <CheckCircle class="h-10 w-10 text-green-600" />
        </div>
      </div>
      <h1 class="font-display text-4xl text-stone-800 font-bold tracking-tight">You're on the list!</h1>
    </div>

    <!-- Success Card -->
    <div class="relative bg-white rounded-lg shadow-xl border border-stone-200 p-8 md:p-10">
      <div class="absolute top-0 left-0 w-full h-1 bg-green-500 rounded-t-lg"></div>

      <div class="relative z-10 space-y-6 text-center">
        <p class="text-stone-600 text-lg">
          Thanks for your interest in Receipt2Recipe. We've added your email to our waitlist.
        </p>
        
        <p class="text-stone-500 text-sm">
          We'll notify you as soon as a spot opens up. Keep an eye on your inbox!
        </p>

        <div class="pt-6 border-t border-stone-100">
          <a 
            href="/" 
            class="inline-flex items-center text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
          >
            Return to home
            <ArrowRight class="ml-1 h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  </div>
</div>
