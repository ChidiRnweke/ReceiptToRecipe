<script lang="ts">
  import { onMount } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import {
    ArrowLeft,
    Clock,
    Users,
    Flame,
    ShoppingCart,
    Share2,
    Heart,
    Minus,
    Plus,
    Link2,
    Lock,
    Unlock,
    Trash2,
    ChefHat,
    Sparkles,
    CheckCircle2,
    Circle,
    Receipt,
    Store,
    Check,
    Loader2,
  } from "lucide-svelte";
  import { getContext } from "svelte";
  import type { WorkflowState } from "$lib/state/workflow.svelte";
  import StockBadge from "$lib/components/StockBadge.svelte";

  let { data } = $props();
  const workflowState = getContext<WorkflowState>('workflowState');

  // Initialize servings from recipe data
  let servings = $derived(data.recipe?.servings ?? 1);
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let shareMessage = $state("");
  let saving = $state(false);
  let togglingPublic = $state(false);
  let addingToList = $state(false);
  let deleting = $state(false);
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
  const pantrySet = $derived(new Set(Object.keys(data.pantryMatches || {}).map((i: string) => i.toLowerCase())));
  const missingCount = $derived(data.recipe.ingredients.filter((i: any) => !pantrySet.has(i.name.toLowerCase())).length);

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

<div class="mx-auto max-w-4xl space-y-8">
  <!-- Header -->
  <div class="flex items-start gap-4">
    <Button variant="ghost" size="icon" href="/recipes">
      <ArrowLeft class="h-5 w-5" />
    </Button>
    <div class="flex-1">
      <h1 class="font-serif text-4xl font-medium tracking-tight text-ink">
        {data.recipe.title}
      </h1>
      {#if data.recipe.description}
        <p class="mt-2 text-lg text-ink-light">{data.recipe.description}</p>
      {/if}

      <!-- Source Receipt Badge -->
      {#if data.sourceReceipt}
        <a
          href="/receipts/{data.sourceReceipt.id}"
          class="mt-3 inline-flex items-center gap-2 rounded-full border border-sage-200 bg-sage-50 px-3 py-1.5 text-sm text-sage-700 hover:bg-sage-100 transition-colors"
        >
          <Receipt class="h-4 w-4" />
          <span
            >Made from: <strong
              >{data.sourceReceipt.storeName || "Receipt"}</strong
            ></span
          >
          {#if data.sourceReceipt.purchaseDate}
            <span class="text-sage-500">
              · {new Date(data.sourceReceipt.purchaseDate).toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric" },
              )}
            </span>
          {/if}
        </a>
      {/if}

      <div class="mt-4 flex flex-wrap items-center gap-4 text-ink-light">
        {#if data.recipe.prepTime}
          <span class="flex items-center gap-1">
            <Clock class="h-4 w-4" />
            Prep: {formatTime(data.recipe.prepTime)}
          </span>
        {/if}
        {#if data.recipe.cookTime}
          <span class="flex items-center gap-1">
            <Clock class="h-4 w-4" />
            Cook: {formatTime(data.recipe.cookTime)}
          </span>
        {/if}
        <span class="flex items-center gap-1">
          <Users class="h-4 w-4" />
          {data.recipe.servings} servings
        </span>
        {#if data.recipe.estimatedCalories}
          <span class="flex items-center gap-1">
            <Flame class="h-4 w-4" />
            {data.recipe.estimatedCalories} cal/serving
          </span>
        {/if}
        {#if data.recipe.cuisineType}
          <Badge variant="outline">{data.recipe.cuisineType}</Badge>
        {/if}
        {#if data.isOwner && data.recipe.isPublic}
          <Badge variant="secondary" class="bg-sage-100 text-sage-600"
            >Public</Badge
          >
        {:else if data.recipe.isPublic}
          <Badge variant="secondary" class="bg-sage-100 text-sage-600"
            >Public recipe</Badge
          >
        {/if}
      </div>
    </div>
  </div>

  <div class="grid gap-8 lg:grid-cols-3">
    <!-- Main Content -->
    <div class="lg:col-span-2 space-y-8">
      <!-- Recipe Image -->
      {#if data.recipe.imageStatus === "DONE" && data.recipe.imageUrl}
        <div class="relative overflow-hidden rounded-2xl">
          <img
            src={data.recipe.imageUrl}
            alt={data.recipe.title}
            class="w-full object-cover"
          />
          <div
            class="absolute inset-0 bg-linear-to-t from-ink/20 to-transparent pointer-events-none"
          ></div>
        </div>
      {:else if data.recipe.imageStatus === "PROCESSING" || data.recipe.imageStatus === "QUEUED"}
        <div
          class="relative aspect-video w-full overflow-hidden rounded-2xl bg-paper-dark"
        >
          <Skeleton class="h-full w-full" />
          <div class="absolute inset-0 flex items-center justify-center">
            <div
              class="flex flex-col items-center gap-3 rounded-2xl bg-paper/95 p-6 shadow-lg"
            >
              <div class="relative">
                <ChefHat class="h-10 w-10 text-sage-600" />
                <Sparkles
                  class="absolute -right-2 -top-2 h-5 w-5 animate-pulse text-sage-500"
                />
              </div>
              <p class="font-serif text-lg text-ink">Creating your dish...</p>
              <p class="text-sm text-ink-muted">
                Our AI chef is plating the image
              </p>
            </div>
          </div>
        </div>
      {/if}

      <!-- Instructions -->
      <Card.Root>
        <Card.Header>
          <div class="flex items-center justify-between">
            <Card.Title class="font-serif text-2xl">Instructions</Card.Title>
            {#if completedSteps.size > 0}
              <Badge variant="secondary" class="bg-sage-100 text-sage-700">
                {completedSteps.size}/{steps.length} done
              </Badge>
            {/if}
          </div>
          <p class="text-sm text-ink-muted">
            Tap each step to mark as complete
          </p>
        </Card.Header>
        <Card.Content>
          <ol class="space-y-4">
            {#each steps as step, i}
              <li>
                <button
                  type="button"
                  onclick={() => toggleStep(i)}
                  class="group flex w-full items-start gap-4 rounded-lg p-3 text-left transition-colors hover:bg-paper-dark {completedSteps.has(
                    i,
                  )
                    ? 'bg-sage-50'
                    : ''}"
                >
                  <div
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {completedSteps.has(
                      i,
                    )
                      ? 'bg-sage-500 text-paper'
                      : 'border-2 border-sand bg-paper text-ink-muted group-hover:border-sage-300'}"
                  >
                    {#if completedSteps.has(i)}
                      <CheckCircle2 class="h-5 w-5" />
                    {:else}
                      <span class="text-sm font-medium">{i + 1}</span>
                    {/if}
                  </div>
                  <p
                    class="flex-1 leading-relaxed {completedSteps.has(i)
                      ? 'text-ink-muted line-through'
                      : 'text-ink'}"
                  >
                    {step}
                  </p>
                </button>
              </li>
            {/each}
          </ol>
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Sidebar -->
    <div class="space-y-6">
      <!-- Servings Adjuster -->
      <Card.Root class="bg-linear-to-br from-sage-50 to-paper">
        <Card.Header class="pb-2">
          <Card.Title class="text-center">
            <Users class="mx-auto h-5 w-5 text-sage-600" />
            <span class="mt-1 block">Servings</span>
          </Card.Title>
        </Card.Header>
        <Card.Content>
          <div class="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              class="h-10 w-10 rounded-full"
              onclick={() => servings > 1 && (servings -= 1)}
              disabled={servings <= 1}
            >
              <Minus class="h-4 w-4" />
            </Button>
            <div class="text-center">
              <span class="text-3xl font-semibold text-ink">{servings}</span>
              {#if scaleFactor !== 1}
                <p class="text-xs text-sage-600">
                  {scaleFactor > 1 ? "+" : ""}{Math.round(
                    (scaleFactor - 1) * 100,
                  )}%
                </p>
              {/if}
            </div>
            <Button
              variant="outline"
              size="icon"
              class="h-10 w-10 rounded-full"
              onclick={() => servings < 20 && (servings += 1)}
              disabled={servings >= 20}
            >
              <Plus class="h-4 w-4" />
            </Button>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Ingredients -->
      <Card.Root>
        <Card.Header class="pb-3">
          <Card.Title class="font-serif text-xl">Ingredients</Card.Title>
          <p class="text-xs text-ink-muted">
            {data.recipe.ingredients.length} items
            {scaleFactor !== 1 ? "(scaled)" : ""}
          </p>
        </Card.Header>
        <Card.Content>
          <ul class="space-y-2">
            {#each data.recipe.ingredients as ingredient, i}
              {@const inPantry = pantrySet.has(ingredient.name.toLowerCase())}
              <li
                class="flex items-start gap-3 rounded-lg p-2 transition-colors {inPantry ? 'bg-emerald-50/50' : 'hover:bg-paper-dark'}"
              >
                <div
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-medium {inPantry ? 'bg-emerald-100 text-emerald-700' : 'bg-sage-100 text-sage-700'}"
                >
                  {#if inPantry}
                    <Check class="h-3 w-3" />
                  {:else}
                    {i + 1}
                  {/if}
                </div>
                <div class="flex-1">
                  <span class="font-medium text-ink {inPantry ? 'text-emerald-900' : ''}">
                    {formatQuantity(ingredient.quantity, scaleFactor)}
                    {ingredient.unit}
                  </span>
                  <span class="{inPantry ? 'text-emerald-700' : 'text-ink-light'}">
                    {ingredient.name}
                  </span>
                  {#if ingredient.optional}
                    <Badge variant="outline" class="ml-2 text-xs"
                      >optional</Badge
                    >
                  {/if}
                  {#if inPantry}
                    {#if data.pantryMatches && data.pantryMatches[ingredient.name] !== undefined}
                        <StockBadge confidence={data.pantryMatches[ingredient.name]} className="ml-2 scale-75 origin-left" />
                    {:else}
                        <span class="ml-2 text-[10px] text-emerald-600 font-medium uppercase tracking-wide">In Pantry</span>
                    {/if}
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        </Card.Content>
      </Card.Root>

      <!-- Actions -->
      <div class="space-y-3">
        <div class="rounded-xl border border-sage-200 bg-sage-50 p-4 space-y-3">
            <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-sage-900">Add to List</span>
                <label class="flex items-center gap-2 text-xs text-sage-700 cursor-pointer">
                    <input type="checkbox" bind:checked={excludePantry} class="rounded border-sage-300 text-sage-600 focus:ring-sage-500" />
                    Exclude pantry items ({data.recipe.ingredients.length - missingCount} matches)
                </label>
            </div>
            <form
            method="POST"
            action="?/addToShopping"
            use:enhance={({ formData }) => {
                addingToList = true;
                formData.set('excludePantry', excludePantry.toString());
                // Optimistic update
                // Note: we don't know exactly how many items will be added without checking the server
                // or doing complex client-side math. For now, we assume at least 1 or 
                // just let invalidateAll handle the precise count, but increment by 1 for immediate feedback.
                // Or better: calculate missing items client side.
                const countToAdd = excludePantry ? missingCount : data.recipe.ingredients.length;
                workflowState.shoppingItems += countToAdd;

                return async ({ result }) => {
                    addingToList = false;
                    if (result.type === 'failure') {
                        workflowState.shoppingItems -= countToAdd;
                    } else {
                        await invalidateAll();
                    }
                };
            }}
            class="w-full"
            >
            <Button
                class="w-full bg-sage-600 hover:bg-sage-700 text-white"
                type="submit"
                disabled={addingToList}
            >
                {#if addingToList}
                    <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                {:else}
                    <ShoppingCart class="mr-2 h-4 w-4" />
                    Add {excludePantry ? missingCount : 'All'} Ingredients
                {/if}
            </Button>
            </form>
        </div>

        {#if data.isSaved}
          <form
            method="POST"
            action="?/unsave"
            use:enhance={() => {}}
            class="w-full"
          >
            <Button
              class="w-full"
              variant="secondary"
              onclick={() => (saving = true)}
              disabled={saving}
            >
              <Heart class="mr-2 h-4 w-4 fill-current" />
              Saved
            </Button>
          </form>
        {:else}
          <form
            method="POST"
            action="?/save"
            use:enhance={() => {}}
            class="w-full"
          >
            <Button
              class="w-full"
              variant="outline"
              onclick={() => (saving = true)}
              disabled={saving}
            >
              <Heart class="mr-2 h-4 w-4" />
              Save Recipe
            </Button>
          </form>
        {/if}

        <div class="space-y-2">
          <Button class="w-full" variant="outline" onclick={copyShareLink}>
            <Share2 class="mr-2 h-4 w-4" />
            Share link
          </Button>
          {#if shareMessage}
            <p class="text-center text-xs text-ink-muted">{shareMessage}</p>
          {/if}
        </div>

        {#if data.isOwner}
          <form
            method="POST"
            action="?/togglePublic"
            use:enhance={() => {}}
            class="w-full"
          >
            <Button
              class="w-full"
              variant="ghost"
              onclick={() => (togglingPublic = true)}
              disabled={togglingPublic}
            >
              {#if data.recipe.isPublic}
                <Lock class="mr-2 h-4 w-4" />
                Make Private
              {:else}
                <Unlock class="mr-2 h-4 w-4" />
                Make Public
              {/if}
            </Button>
          </form>
          <form
            method="POST"
            action="?/delete"
            use:enhance={({ cancel }) => {
              const confirmed = confirm(
                "Are you sure you want to delete this recipe? This cannot be undone.",
              );
              if (!confirmed) {
                cancel();
                return;
              }
              deleting = true;
            }}
            class="w-full"
          >
            <Button class="w-full" variant="ghost" disabled={deleting}>
              <Trash2 class="mr-2 h-4 w-4 text-destructive" />
              <span class="text-destructive">Delete Recipe</span>
            </Button>
          </form>
        {/if}
      </div>
    </div>
  </div>
</div>
