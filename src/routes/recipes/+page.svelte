<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import {
    ChefHat,
    Trash2,
    Sparkles,
    ShoppingCart,
    Loader2,
    AlertTriangle,
    ShieldAlert,
    Filter
  } from "lucide-svelte";
  import { getContext } from "svelte";
  import type { WorkflowState } from "$lib/state/workflow.svelte";
  import WashiTape from "$lib/components/WashiTape.svelte";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { Label } from "$lib/components/ui/label";

  let { data } = $props();
  const workflowState = getContext<WorkflowState>("workflowState");
  let deletingId = $state<string | null>(null);
  let addingToShoppingId = $state<string | null>(null);
  
  // Dialog state
  let deleteDialogOpen = $state(false);
  let recipeToDelete = $state<string | null>(null);

  // Filters
  let hideIncompatible = $state(false);

  const suggestedRecipes = $derived(
    data.recipes.filter((r: any) => r.isSuggested && (!hideIncompatible || (r.compatibility?.compatible ?? true))),
  );
  const otherRecipes = $derived(
    data.recipes.filter((r: any) => !r.isSuggested && (!hideIncompatible || (r.compatibility?.compatible ?? true))),
  );

  function formatTime(minutes: number | null) {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  
  function confirmDelete(id: string) {
    recipeToDelete = id;
    deleteDialogOpen = true;
  }

  const quotes = [
    "Cooking is like love. It should be entered into with abandon or not at all.",
    "The secret ingredient is always love.",
    "Good food is the foundation of genuine happiness.",
    "Life is too short for boring meals.",
  ];
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
</script>

<svelte:head>
  <title>Cookbook - Receipt2Recipe</title>
</svelte:head>

<div
  class="paper-card relative min-h-screen rounded-4xl border border-sand bg-[#FDFBF7] shadow-[0_30px_80px_-50px_rgba(45,55,72,0.6)] overflow-hidden"
>
  <!-- Radial gradient background -->
  <div
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.08),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.08),transparent_28%)]"
  ></div>

  <!-- Main Content -->
  <main class="relative z-10 bg-white min-h-screen">
    <div class="mx-auto w-full max-w-6xl px-6 py-8 sm:px-10">
      <!-- Header -->
      <div class="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="font-hand text-lg text-ink-light mb-1">
            Your culinary collection
          </p>
          <h1
            class="font-display text-4xl leading-[1.1] text-ink drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]"
          >
            Recipe <span class="marker-highlight">Scrapbook</span>
          </h1>
          <div class="flex items-center gap-4 mt-2">
            <p
                class="font-mono text-xs uppercase tracking-widest text-stone-400"
            >
                {data.recipes.length}
                {data.recipes.length === 1 ? "recipe" : "recipes"} saved
            </p>
            <div class="flex items-center gap-2">
                <Checkbox id="hide-incompatible" bind:checked={hideIncompatible} class="h-4 w-4" />
                <Label for="hide-incompatible" class="text-xs text-stone-500 cursor-pointer font-medium">Hide Incompatible</Label>
            </div>
          </div>
        </div>

        <Button
          href="/recipes/generate"
          class="group relative h-10 overflow-hidden rounded-lg border border-sage-300 bg-white px-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sage-400 hover:bg-[#fafaf9] hover:shadow-md active:scale-95"
        >
          <div class="flex items-center gap-2">
            <Sparkles class="h-4 w-4 text-sage-600 transition-transform duration-500 group-hover:rotate-12 group-hover:text-sage-700" />
            <span class="font-display text-base font-medium text-ink">New Recipe</span>
          </div>
        </Button>
      </div>

      <!-- Suggested Recipes -->
      {#if suggestedRecipes.length > 0}
        <div class="mb-16">
          <div
            class="mb-8 flex items-baseline justify-between border-b border-stone-200 pb-3"
          >
            <h2 class="font-display text-2xl text-ink">
              Made for <span class="marker-highlight">Your Pantry</span>
            </h2>
            <span
              class="font-mono text-[10px] uppercase tracking-widest text-sage-600"
            >
              <Sparkles class="h-3 w-3 inline mr-1" />
              AI Suggested
            </span>
          </div>

          <!-- 3 cards per row for suggested -->
          <div
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10"
          >
            {#each suggestedRecipes as recipe, i (recipe.id)}
              {@const rotations = ["-rotate-2", "rotate-2", "-rotate-1"]}
              {@const marginTops = ["mt-0", "mt-6", "mt-3"]}
              <div class="group {marginTops[i % marginTops.length]}">
                <!-- Action button on top -->
                <div class="flex items-center justify-center mb-3">
                  <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
                  <form
                    method="POST"
                    action="?/addToShopping"
                    use:enhance={() => {
                      addingToShoppingId = recipe.id;
                      workflowState.incrementShopping();
                      return async ({ result }) => {
                        addingToShoppingId = null;
                        if (result.type === "failure")
                          workflowState.decrementShopping();
                        else await invalidateAll();
                      };
                    }}
                    onclick={(e) => e.stopPropagation()}
                  >
                    <input type="hidden" name="recipeId" value={recipe.id} />
                    <button
                      type="submit"
                      class="flex items-center gap-1.5 bg-amber-100 text-amber-700 hover:bg-amber-400 hover:text-white text-xs font-semibold px-4 py-2 rounded-full shadow-sm transition-colors"
                      disabled={addingToShoppingId === recipe.id}
                    >
                      {#if addingToShoppingId === recipe.id}
                        <Loader2 class="h-3.5 w-3.5 animate-spin" />
                      {:else}
                        <ShoppingCart class="h-3.5 w-3.5" />
                      {/if}
                      Shop Ingredients
                    </button>
                  </form>
                </div>

                <!-- Photo Frame -->
                <a href="/recipes/{recipe.id}" class="block">
                  <div
                    class="
                    relative bg-white p-2 pb-16
                    shadow-[0_2px_8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)]
                    transition-all duration-300 ease-out
                    {rotations[i % rotations.length]}
                    group-hover:rotate-0 group-hover:-translate-y-2 group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)] group-hover:z-50
                  "
                  >
                    <!-- Washi Tape -->
                    <WashiTape
                      color="sage"
                      class="absolute -top-2 left-1/2 -translate-x-1/2 w-16 z-10"
                    />

                    <!-- Photo -->
                    <div
                      class="relative aspect-square overflow-hidden bg-stone-100"
                    >
                      {#if recipe.imageUrl}
                        <img
                          src={recipe.imageUrl}
                          alt={recipe.title}
                          class="h-full w-full object-cover"
                        />
                      {:else}
                        <div
                          class="flex h-full w-full items-center justify-center bg-stone-100"
                        >
                          <ChefHat class="h-12 w-12 text-stone-300" />
                        </div>
                      {/if}
                      <!-- Match badge -->
                      <div
                        class="absolute bottom-2 right-2 bg-emerald-500 text-white px-2 py-0.5 text-xs font-bold rounded-full shadow-sm"
                      >
                        {Math.round(recipe.matchPercentage * 100)}%
                      </div>
                    </div>

                    <!-- Caption area -->
                    <div
                      class="absolute bottom-0 left-0 right-0 h-14 px-3 py-1.5 flex flex-col justify-center"
                    >
                      <p
                        class="font-display text-base text-ink leading-tight truncate text-center"
                        title={recipe.title}
                      >
                        {recipe.title}
                      </p>
                      
                      <!-- Compatibility Badge / Metadata -->
                      <div class="flex items-center justify-center gap-2 mt-0.5">
                        {#if recipe.compatibility && !recipe.compatibility.compatible}
                            <span class="inline-flex items-center text-[10px] font-bold text-red-600 bg-red-50 px-1.5 rounded border border-red-100" title={recipe.compatibility.blockers.join(", ")}>
                                <ShieldAlert class="h-3 w-3 mr-1" />
                                Avoid
                            </span>
                        {:else if recipe.compatibility && recipe.compatibility.warnings.length > 0}
                            <span class="inline-flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 rounded border border-amber-100" title={recipe.compatibility.warnings.join(", ")}>
                                <AlertTriangle class="h-3 w-3 mr-1" />
                                Warning
                            </span>
                        {:else}
                            <p
                                class="font-mono text-xs text-stone-400 text-center uppercase tracking-wide"
                            >
                                {formatTime(
                                (recipe.prepTime || 0) + (recipe.cookTime || 0),
                                ) || "?"} · {recipe.servings} servings
                            </p>
                        {/if}
                      </div>
                    </div>

                    <!-- Full title tooltip on hover -->
                    <div
                      class="absolute -bottom-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30"
                    >
                      <div
                        class="bg-stone-800 text-white text-sm px-3 py-1.5 rounded shadow-lg max-w-[260px] text-center whitespace-normal"
                      >
                        {recipe.title}
                      </div>
                    </div>
                  </div>
                </a>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- All Recipes -->
      {#if otherRecipes.length > 0}
        <div class="mt-8">
          <div
            class="mb-8 flex items-baseline justify-between border-b border-stone-200 pb-3"
          >
            <h2 class="font-display text-2xl text-ink">
              All Recipes
            </h2>
            <span
              class="font-mono text-[10px] uppercase tracking-widest text-stone-400"
            >
              {otherRecipes.length} saved
            </span>
          </div>

          <!-- 3 cards per row -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
            {#each otherRecipes as recipe, i (recipe.id)}
              {@const rotations = ["-rotate-2", "rotate-2", "-rotate-1"]}
              {@const marginTops = ["mt-0", "mt-6", "mt-3"]}
              <div class="group {marginTops[i % marginTops.length]}">
                <!-- Action buttons on top -->
                <div class="flex items-center justify-center gap-2 mb-3">
                  <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
                  <form
                    method="POST"
                    action="?/addToShopping"
                    use:enhance={() => {
                      addingToShoppingId = recipe.id;
                      workflowState.incrementShopping();
                      return async ({ result }) => {
                        addingToShoppingId = null;
                        if (result.type === "failure")
                          workflowState.decrementShopping();
                        else await invalidateAll();
                      };
                    }}
                    onclick={(e) => e.stopPropagation()}
                  >
                    <input type="hidden" name="recipeId" value={recipe.id} />
                    <button
                      type="submit"
                      disabled={addingToShoppingId === recipe.id}
                      class="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 hover:bg-amber-400 hover:text-white transition-colors"
                      title="Add to shopping list"
                    >
                      {#if addingToShoppingId === recipe.id}
                        <Loader2 class="h-4 w-4 animate-spin" />
                      {:else}
                        <ShoppingCart class="h-4 w-4" />
                      {/if}
                    </button>
                  </form>

                  <button
                    type="button"
                    onclick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        confirmDelete(recipe.id);
                    }}
                    disabled={deletingId === recipe.id}
                    class="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-400 hover:bg-red-400 hover:text-white transition-colors"
                    title="Delete recipe"
                  >
                    {#if deletingId === recipe.id}
                        <Loader2 class="h-4 w-4 animate-spin" />
                    {:else}
                        <Trash2 class="h-4 w-4" />
                    {/if}
                  </button>
                </div>

                <!-- Photo Frame -->
                <a href="/recipes/{recipe.id}" class="block">
                  <div
                    class="
                    relative bg-white p-2 pb-16
                    shadow-[0_2px_6px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06)]
                    transition-all duration-300 ease-out
                    {rotations[i % rotations.length]}
                    group-hover:rotate-0 group-hover:-translate-y-2 group-hover:shadow-[0_12px_24px_rgba(0,0,0,0.15)]
                    group-hover:z-10
                  "
                  >
                    <!-- Photo -->
                    <div
                      class="relative aspect-square overflow-hidden bg-stone-100"
                    >
                      {#if recipe.imageUrl}
                        <img
                          src={recipe.imageUrl}
                          alt={recipe.title}
                          class="h-full w-full object-cover"
                        />
                      {:else}
                        <div
                          class="flex h-full w-full items-center justify-center bg-stone-100"
                        >
                          <ChefHat class="h-10 w-10 text-stone-300" />
                        </div>
                      {/if}
                    </div>

                    <!-- Caption area -->
                    <div
                      class="absolute bottom-0 left-0 right-0 h-14 px-2 py-1.5 flex flex-col justify-center"
                    >
                      <p
                        class="font-display text-sm text-ink leading-tight truncate text-center"
                        title={recipe.title}
                      >
                        {recipe.title}
                      </p>
                      <p
                        class="font-mono text-[10px] text-stone-400 text-center uppercase tracking-wide mt-0.5"
                      >
                        {#if recipe.cuisineType}{recipe.cuisineType}{:else}{formatTime(
                            (recipe.prepTime || 0) + (recipe.cookTime || 0),
                          ) || ""}{/if}
                      </p>
                    </div>

                    <!-- Full title tooltip on hover -->
                    <div
                      class="absolute -bottom-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30"
                    >
                      <div
                        class="bg-stone-800 text-white text-xs px-3 py-1.5 rounded shadow-lg max-w-[220px] text-center whitespace-normal"
                      >
                        {recipe.title}
                      </div>
                    </div>
                  </div>
                </a>

              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if data.recipes.length === 0}
        <div class="flex flex-col items-center justify-center py-20">
          <!-- Empty photo frame -->
          <div
            class="relative bg-white p-1.5 pb-12 shadow-[0_2px_8px_rgba(0,0,0,0.1)] rotate-2 mb-8"
          >
            <div
              class="w-44 h-44 bg-stone-100 flex items-center justify-center"
            >
              <ChefHat class="h-12 w-12 text-stone-300" />
            </div>
            <p
              class="absolute bottom-2 left-0 right-0 font-display text-sm text-stone-400 text-center"
            >
              Your first recipe?
            </p>
          </div>
          <h2 class="font-display text-2xl text-ink mb-2">No recipes yet</h2>
          <p
            class="font-serif text-base text-stone-500 italic max-w-xs text-center mb-8"
          >
            "{randomQuote}"
          </p>
          <Button
            href="/recipes/generate"
            class="group relative h-12 overflow-hidden rounded-lg border border-sage-300 bg-white px-8 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sage-400 hover:bg-[#fafaf9] hover:shadow-md active:scale-95"
          >
            <div class="flex items-center gap-2">
              <Sparkles class="h-4 w-4 text-sage-600 transition-transform duration-500 group-hover:rotate-12 group-hover:text-sage-700" />
              <span class="font-display text-base font-medium text-ink">Create Your First Recipe</span>
            </div>
          </Button>
        </div>
      {/if}
    </div>
  </main>

  <AlertDialog.Root bind:open={deleteDialogOpen}>
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>Are you sure?</AlertDialog.Title>
        <AlertDialog.Description>
          This will permanently delete this recipe from your cookbook. This action cannot be undone.
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
        <form
            method="POST"
            action="?/delete"
            use:enhance={() => {
                deleteDialogOpen = false;
                if (recipeToDelete) deletingId = recipeToDelete;
                return async ({ update }) => {
                    deletingId = null;
                    await update();
                };
            }}
            class="inline-block"
        >
            <input type="hidden" name="recipeId" value={recipeToDelete} />
            <AlertDialog.Action type="submit" class="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialog.Action>
        </form>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
</div>
