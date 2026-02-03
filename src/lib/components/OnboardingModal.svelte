<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import {
    Upload,
    Store,
    ChefHat,
    ShoppingCart,
    ArrowRight,
    X,
  } from "lucide-svelte";
  import { browser } from "$app/environment";

  type Props = {
    receiptCount: number;
    recipeCount: number;
  };

  let { receiptCount, recipeCount }: Props = $props();

  const STORAGE_KEY = "r2r_onboarding_dismissed";

  // Check if onboarding was already dismissed
  let dismissed = $state(browser ? localStorage.getItem(STORAGE_KEY) === "true" : true);

  // Show onboarding if user is new (0 receipts) and hasn't dismissed
  let showOnboarding = $derived(!dismissed && receiptCount === 0);

  // Current step in the workflow explanation
  let currentStep = $state(0);

  const steps = [
    {
      icon: Upload,
      title: "Scan Your Receipt",
      description:
        "Drop a photo of your grocery receipt. We'll extract and organize all your purchased items automatically.",
      cta: "This tells us what's in your kitchen.",
    },
    {
      icon: Store,
      title: "Build Your Kitchen",
      description:
        "Your scanned items become your virtual kitchen. We track what you have and estimate when things run low.",
      cta: "Smart stock tracking, no manual entry.",
    },
    {
      icon: ChefHat,
      title: "Generate Recipes",
      description:
        "Get personalized recipe suggestions based on what you have. We'll prioritize ingredients in your kitchen.",
      cta: "Cook with what you've got!",
    },
    {
      icon: ShoppingCart,
      title: "Smart Shopping Lists",
      description:
        "Missing ingredients? Add them to your shopping list with one click. We'll even suggest restocks.",
      cta: "Never forget an ingredient again.",
    },
  ];

  function dismissOnboarding() {
    if (browser) {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    dismissed = true;
  }

  function nextStep() {
    if (currentStep < steps.length - 1) {
      currentStep++;
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
    }
  }
</script>

<AlertDialog.Root bind:open={showOnboarding}>
  <AlertDialog.Content class="max-w-md">
    <button
      onclick={dismissOnboarding}
      class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      <X class="h-4 w-4" />
      <span class="sr-only">Close</span>
    </button>

    <div class="text-center">
      <!-- Step indicator -->
      <div class="flex justify-center gap-2 mb-6">
        {#each steps as step, i}
          <button
            onclick={() => (currentStep = i)}
            aria-label="Go to step {i + 1}: {step.title}"
            class="h-2 w-2 rounded-full transition-all {i === currentStep
              ? 'bg-sage-600 w-6'
              : 'bg-stone-200 hover:bg-stone-300'}"
          ></button>
        {/each}
      </div>

      <!-- Current step content -->
      {#each [steps[currentStep]] as step}
        <div class="space-y-4">
          <div
            class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-50"
          >
            <step.icon class="h-8 w-8 text-sage-600" />
          </div>

          <div class="space-y-2">
            <p
              class="text-xs font-mono uppercase tracking-widest text-ink-muted"
            >
              Step {currentStep + 1} of {steps.length}
            </p>
            <h3 class="font-display text-2xl text-ink">{step.title}</h3>
          </div>

          <p class="text-sm text-ink-light leading-relaxed">{step.description}</p>

          <p class="text-xs font-medium text-sage-600 italic">{step.cta}</p>
        </div>
      {/each}
    </div>

    <AlertDialog.Footer class="flex-col gap-2 sm:flex-row sm:justify-between">
      {#if currentStep > 0}
        <Button variant="ghost" onclick={prevStep}>Back</Button>
      {:else}
        <Button variant="ghost" onclick={dismissOnboarding}>Skip tour</Button>
      {/if}

      {#if currentStep < steps.length - 1}
        <Button onclick={nextStep}>
          Next
          <ArrowRight class="ml-2 h-4 w-4" />
        </Button>
      {:else}
        <Button href="/receipts/upload" onclick={dismissOnboarding}>
          <Upload class="mr-2 h-4 w-4" />
          Upload Your First Receipt
        </Button>
      {/if}
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
