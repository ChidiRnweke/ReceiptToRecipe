<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ChefHat, CheckCircle, ArrowRight } from "lucide-svelte";
</script>

<svelte:head>
  <title>You're on the list! - Receipt2Recipe</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-bg-paper p-4 relative overflow-hidden">
  <!-- Desk Texture -->
  <div
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.08),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.08),transparent_28%)]"
  ></div>

  <div class="relative z-10 w-full max-w-md">
    <!-- Header -->
    <div class="mb-8 text-center">
      <div class="relative mx-auto w-fit mb-6">
        <div class="flex h-20 w-20 items-center justify-center rounded-full bg-success-50 border border-success-200 shadow-sm">
          <CheckCircle class="h-10 w-10 text-success-600" />
        </div>
      </div>
      <h1 class="font-display text-4xl text-ink font-bold tracking-tight">You're on the list!</h1>
    </div>

    <!-- Success Card -->
    <div class="paper-card relative p-8 md:p-10 rounded-sm -rotate-[0.5deg]">
      <!-- Top decorative border -->
      <div class="absolute top-3 left-3 right-3 h-px border-t border-dashed border-border"></div>
      <div class="absolute bottom-3 left-3 right-3 h-px border-b border-dashed border-border"></div>

      <div class="relative z-10 space-y-6 text-center">
        <p class="font-serif text-ink-light text-lg">
          Thanks for your interest in Receipt2Recipe. We've added your email to our waitlist.
        </p>
        
        <p class="font-serif text-text-muted text-sm">
          We'll notify you as soon as a spot opens up. Keep an eye on your inbox!
        </p>

        <div class="pt-6 border-t border-border">
          <Button href="/" variant="link" class="text-sm">
            Return to home
            <ArrowRight class="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</div>
