<script lang="ts">
  import { onMount } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import {
    ArrowLeft,
    Clock,
    Users,
    Flame,
    ShoppingCart,
    Share2,
    Heart,
    Trash2,
    ChefHat,
    Sparkles,
    Check,
    Loader2,
    Printer,
    PenLine,
    Utensils,
    Receipt,
    Bookmark,
  } from "lucide-svelte";
  import { getContext } from "svelte";
  import type { WorkflowState } from "$lib/state/workflow.svelte";
  import StockBadge from "$lib/components/StockBadge.svelte";
  import WashiTape from "$lib/components/WashiTape.svelte";
  import PinnedNote from "$lib/components/PinnedNote.svelte";
  import RecipeNarrator from "$lib/components/RecipeNarrator.svelte";
  import RecipeAdjuster from "$lib/components/RecipeAdjuster.svelte";

  let { data } = $props();
  const workflowState = getContext<WorkflowState>("workflowState");

  // Initialize servings from recipe data
  let servings = $derived(data.recipe?.servings ?? 1);
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let shareMessage = $state("");
  let addingToList = $state(false);
  let completedSteps = $state<Set<number>>(new Set());
  let excludePantry = $state(true);

  const scaleFactor = $derived(servings / data.recipe.servings);
  const steps = $derived(
    data.recipe.instructions
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );

  // Calculate missing ingredients
  const pantrySet = $derived(
    new Set(
      Object.keys(data.pantryMatches || {}).map((i: string) => i.toLowerCase()),
    ),
  );
  const missingCount = $derived(
    data.recipe.ingredients.filter(
      (i: any) => !pantrySet.has(i.name.toLowerCase()),
    ).length,
  );

  function toggleStep(index: number) {
    const newSet = new Set(completedSteps);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    completedSteps = newSet;
  }

  onMount(() => {
    if (
      data.recipe.imageStatus === "QUEUED" ||
      data.recipe.imageStatus === "PROCESSING"
    ) {
      pollingInterval = setInterval(async () => {
        await invalidateAll();
        if (
          data.recipe.imageStatus === "DONE" ||
          data.recipe.imageStatus === "FAILED"
        ) {
          if (pollingInterval) clearInterval(pollingInterval);
        }
      }, 3000);
    }

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  });

  function formatTime(minutes: number | null) {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0
      ? `${hours}h ${mins}m`
      : `${hours} hour${hours > 1 ? "s" : ""}`;
  }

  function formatQuantity(qty: string, scale: number) {
    const num = parseFloat(qty) * scale;
    if (num === Math.floor(num)) return num.toString();
    return num.toFixed(1);
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      shareMessage = "Link copied";
      setTimeout(() => (shareMessage = ""), 2000);
    } catch (err) {
      shareMessage = "Unable to copy";
      setTimeout(() => (shareMessage = ""), 2000);
    }
  }
</script>

<svelte:head>
  <title>{data.recipe.title} - Receipt2Recipe</title>
</svelte:head>

<div
  class="min-h-screen bg-bg-paper p-4 md:p-8 relative font-body text-text-primary overflow-x-hidden"
>
  <!-- Desk Texture -->
  <div
    class="pointer-events-none absolute inset-0 opacity-[0.03]"
    style="background-image: url('https://www.transparenttextures.com/patterns/cardboard-flat.png')"
  ></div>

  <!-- Back Navigation (Diegetic: Sticky Note) -->
  <div class="absolute top-4 left-4 z-50 hidden md:block">
    <a
      href="/recipes"
      class="flex items-center gap-1 text-text-secondary hover:text-text-primary hover:underline decoration-wavy decoration-secondary-400"
    >
      <ArrowLeft class="h-4 w-4" />
      <span class="font-hand font-bold text-lg">Index</span>
    </a>
  </div>

  <!-- Mobile Back Button -->
  <div class="md:hidden mb-4">
    <Button variant="ghost" href="/recipes" class="-ml-2 text-text-muted">
      <ArrowLeft class="mr-2 h-4 w-4" />
      Back to Cookbook
    </Button>
  </div>

  <div
    class="mx-auto max-w-5xl bg-white shadow-2xl relative mt-4 md:mt-8 min-h-[90vh] overflow-hidden border-l-4 border-border"
  >
    <!-- Paper Texture Overlay -->
    <div
      class="pointer-events-none absolute inset-0 bg-bg-card/20 mix-blend-multiply"
    ></div>

    <!-- Bookmark Ribbon -->
    <div class="absolute top-0 right-8 z-20">
      <div class="relative flex flex-col items-center">
        <div
          class="w-8 h-24 bg-red-700 shadow-md flex items-end justify-center pb-2"
        >
          <Bookmark
            class="h-4 w-4 text-red-900 drop-shadow-sm"
            fill="currentColor"
          />
        </div>
        <div
          class="w-8 h-4 border-l-[16px] border-r-[16px] border-t-[10px] border-l-transparent border-r-transparent border-t-red-700"
        ></div>
      </div>
    </div>

    <!-- Hero Image Area (Compact) -->
    <div
      class="relative h-[200px] md:h-[300px] w-full bg-bg-card overflow-hidden group"
    >
      {#if data.recipe.imageStatus === "DONE" && data.recipe.imageUrl}
        <img
          src={data.recipe.imageUrl}
          alt={data.recipe.title}
          class="h-full w-full object-cover transition-transform duration-[2s] group-hover:scale-105"
        />
        <div
          class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60"
        ></div>
      {:else if data.recipe.imageStatus === "PROCESSING" || data.recipe.imageStatus === "QUEUED"}
        <div
          class="h-full w-full flex items-center justify-center bg-bg-paper-dark"
        >
          <div class="text-center">
            <Loader2 class="h-8 w-8 animate-spin text-text-muted mx-auto mb-2" />
            <p class="font-display text-lg text-text-secondary">
              Developing photo...
            </p>
          </div>
        </div>
      {:else}
        <div
          class="h-full w-full flex items-center justify-center bg-bg-card pattern-grid-lg text-text-muted/50"
        >
          <ChefHat class="h-16 w-16 opacity-20" />
        </div>
      {/if}

      <!-- Actions Toolbar (Floating on Image) -->
      <div
        class="absolute top-4 right-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30"
      >
        <Button
          variant="secondary"
          size="icon"
          class="h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white"
          onclick={copyShareLink}
          title="Share"
        >
          <Share2 class="h-3.5 w-3.5 text-text-primary" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          class="h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white"
          onclick={() => window.print()}
          title="Print"
        >
          <Printer class="h-3.5 w-3.5 text-text-primary" />
        </Button>
        {#if data.isOwner}
          <form method="POST" action="?/delete" use:enhance>
            <input type="hidden" name="recipeId" value={data.recipe.id} />
            <Button
              variant="secondary"
              size="icon"
              class="h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm shadow-sm hover:bg-danger-50 hover:text-danger-600 text-text-primary"
              type="submit"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </Button>
          </form>
        {/if}
      </div>
    </div>

    <!-- Title Card (Compact & Overlapping) -->
    <div class="relative px-6 md:px-12 -mt-12 mb-8 z-10">
      <div
        class="bg-white p-6 shadow-[0_5px_20px_-5px_rgba(0,0,0,0.1)] relative border border-border/50"
      >
        <div
          class="flex flex-col md:flex-row md:items-start md:justify-between gap-4"
        >
          <div class="flex-1 space-y-2">
            {#if data.recipe.cuisineType}
              <p
                class="font-ui text-[10px] uppercase tracking-[0.2em] text-text-muted"
              >
                {data.recipe.cuisineType}
              </p>
            {/if}

            <h1
              class="font-display text-3xl md:text-4xl text-text-primary leading-tight"
            >
              {data.recipe.title}
            </h1>

            {#if data.recipe.description}
              <p
                class="font-body italic text-base text-text-secondary leading-snug"
              >
                {data.recipe.description}
              </p>
            {/if}
          </div>

          <!-- Compact Meta Data -->
          <div
            class="flex flex-row md:flex-col gap-4 md:gap-2 border-t md:border-t-0 md:border-l border-border pt-3 md:pt-0 md:pl-6 shrink-0 min-w-[140px]"
          >
            {#if data.recipe.prepTime || data.recipe.cookTime}
              <div class="flex items-center gap-2 text-text-secondary">
                <Clock class="h-4 w-4 text-secondary-500" />
                <span class="font-ui text-xs uppercase tracking-wider">
                  {formatTime(
                    (data.recipe.prepTime || 0) + (data.recipe.cookTime || 0),
                  )}
                </span>
              </div>
            {/if}

            <div class="flex items-center gap-2 text-text-secondary group relative">
              <Users class="h-4 w-4 text-primary-500" />
              <span class="font-ui text-xs uppercase tracking-wider">
                {servings} Servings
              </span>
              <!-- Popover Servings Control -->
              <div
                class="absolute left-0 top-full mt-1 bg-white shadow-lg border border-border rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity z-50 flex gap-1"
              >
                <button
                  class="w-6 h-6 flex items-center justify-center hover:bg-bg-hover rounded text-text-muted"
                  onclick={() => servings > 1 && (servings -= 1)}>-</button
                >
                <button
                  class="w-6 h-6 flex items-center justify-center hover:bg-bg-hover rounded text-text-muted"
                  onclick={() => servings < 20 && (servings += 1)}>+</button
                >
              </div>
            </div>

            {#if data.recipe.estimatedCalories}
              <div class="flex items-center gap-2 text-text-secondary">
                <Flame class="h-4 w-4 text-danger-500" />
                <span class="font-ui text-xs uppercase tracking-wider">
                  {data.recipe.estimatedCalories} kcal
                </span>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- The Spread (Two Columns) -->
    <div class="grid md:grid-cols-[1fr_1.5fr] gap-0 border-t border-border">
      <!-- Left: Ingredients (Textured Background) -->
      <div
        class="bg-[#faf9f6] p-8 md:p-12 border-r border-border/50 relative"
      >
        <div class="sticky top-8">
          <div class="flex items-center justify-between mb-8">
            <h2 class="font-display text-3xl text-text-primary">Ingredients</h2>
            <Utensils class="h-5 w-5 text-text-muted/50" />
          </div>

          <ul class="space-y-4 font-body text-text-primary relative z-10">
            {#each data.recipe.ingredients as ingredient}
              {@const inPantry = pantrySet.has(ingredient.name.toLowerCase())}
              <li class="flex items-baseline gap-3 group">
                <div
                  class="relative top-1 h-3 w-3 shrink-0 rounded-full border border-border transition-colors {inPantry
                    ? 'bg-success-200 border-success-300'
                    : ''}"
                >
                  {#if inPantry}
                    <Check
                      class="h-2.5 w-2.5 text-success-700 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                    />
                  {/if}
                </div>
                <div
                  class="flex-1 border-b border-dashed border-border pb-2 group-hover:border-border/80 transition-colors"
                >
                  <span class="font-bold text-text-secondary"
                    >{formatQuantity(ingredient.quantity, scaleFactor)}
                    {ingredient.unit}</span
                  >
                  <span class="text-text-secondary">{ingredient.name}</span>
                  {#if ingredient.optional}
                    <span class="text-xs text-text-muted italic ml-2"
                      >(optional)</span
                    >
                  {/if}
                </div>
              </li>
            {/each}
          </ul>

          <!-- Shopping List Action (Diegetic Note) -->
          <div class="mt-12 transform -rotate-1">
            <div
              class="bg-secondary-50 border border-secondary-200 p-4 shadow-sm relative group"
            >
              <!-- Pushpin -->
              <div
                class="absolute -top-3 left-1/2 -translate-x-1/2 text-danger-500 drop-shadow-sm"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="none"
                  ><path
                    d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z"
                  /></svg
                >
              </div>

              <div class="flex items-center justify-between mb-3 pt-2">
                <h3 class="font-hand text-xl font-bold text-text-primary/80">
                  Shopping List
                </h3>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    bind:checked={excludePantry}
                    class="rounded border-border text-secondary-600 focus:ring-0"
                  />
                  <span
                    class="font-ui text-[10px] uppercase tracking-wide text-text-muted"
                    >Hide Items In Stock</span
                  >
                </label>
              </div>

              <form
                method="POST"
                action="?/addToShopping"
                use:enhance={({ formData }) => {
                  addingToList = true;
                  formData.set("excludePantry", excludePantry.toString());
                  const countToAdd = excludePantry
                    ? missingCount
                    : data.recipe.ingredients.length;
                  workflowState.shoppingItems += countToAdd;
                  return async ({ result }) => {
                    addingToList = false;
                    if (result.type === "failure")
                      workflowState.shoppingItems -= countToAdd;
                    else await invalidateAll();
                  };
                }}
              >
                <button
                  type="submit"
                  disabled={addingToList}
                  class="w-full font-hand text-xl text-text-primary hover:text-secondary-700 underline decoration-dashed decoration-border hover:decoration-secondary-400 underline-offset-4 transition-all text-left flex items-center justify-between"
                >
                  <span>
                    {addingToList ? "Adding..." : "Add Missing Items"}
                  </span>
                  <PenLine class="h-5 w-5 opacity-50" />
                </button>
              </form>
            </div>
          </div>

          <!-- Recipe Adjuster (AI-Powered) -->
          <div class="mt-6">
            <RecipeAdjuster
              recipeId={data.recipe.id}
              title={data.recipe.title}
              description={data.recipe.description}
              ingredients={data.recipe.ingredients}
              instructions={data.recipe.instructions}
              isOwner={data.isOwner}
              onAdjust={() => invalidateAll()}
            />
          </div>
        </div>
      </div>

      <!-- Right: Instructions (Clean White) -->
      <div class="bg-white p-8 md:p-12">
        <div class="flex items-center justify-between mb-8">
          <div class="flex items-center gap-4">
            <h2 class="font-display text-3xl text-text-primary">
              <span class="marker-highlight">Method</span>
            </h2>
            <RecipeNarrator
              title={data.recipe.title}
              ingredients={data.recipe.ingredients}
              instructions={data.recipe.instructions}
              servings={servings}
            />
          </div>
          {#if completedSteps.size > 0}
            <Badge variant="outline" class="font-ui"
              >{completedSteps.size}/{steps.length}</Badge
            >
          {/if}
        </div>

        <div class="space-y-10">
          {#each steps as step, i}
            <button
              class="flex gap-6 text-left group w-full"
              onclick={() => toggleStep(i)}
            >
              <div class="shrink-0 flex flex-col items-center gap-1 pt-1">
                <span
                  class="font-display text-4xl leading-none transition-colors {completedSteps.has(
                    i,
                  )
                    ? 'text-primary-300'
                    : 'text-border group-hover:text-border/80'}"
                >
                  {i + 1}
                </span>
              </div>
              <div
                class="pb-8 border-b border-border/50 w-full group-last:border-0"
              >
                <p
                  class="font-body text-lg leading-relaxed transition-colors {completedSteps.has(
                    i,
                  )
                    ? 'text-text-muted line-through decoration-border'
                    : 'text-text-primary group-hover:text-text-secondary'}"
                >
                  {step}
                </p>
              </div>
            </button>
          {/each}
        </div>

        <!-- Footer Notes -->
        <div
          class="mt-16 pt-8 border-t border-border flex items-center justify-between text-text-muted text-sm font-body italic"
        >
          <span>{data.user?.name || "Chef"}'s Kitchen</span>
          {#if data.sourceReceipt}
            <span class="flex items-center gap-1">
              <Receipt class="h-3 w-3" />
              Source: {data.sourceReceipt.storeName}
            </span>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Spacer for visual balance -->
  <div class="h-20"></div>
</div>
