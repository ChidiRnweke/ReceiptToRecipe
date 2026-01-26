<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import {
    ChefHat,
    Trash2,
    Sparkles,
    ShoppingCart,
    Loader2,
  } from "lucide-svelte";
  import { getContext } from "svelte";
  import type { WorkflowState } from "$lib/state/workflow.svelte";
  import WashiTape from "$lib/components/WashiTape.svelte";

  let { data } = $props();
  const workflowState = getContext<WorkflowState>("workflowState");
  let deletingId = $state<string | null>(null);
  let addingToShoppingId = $state<string | null>(null);

  const suggestedRecipes = $derived(
    data.recipes.filter((r: any) => r.isSuggested),
  );
  const otherRecipes = $derived(
    data.recipes.filter((r: any) => !r.isSuggested),
  );

  function formatTime(minutes: number | null) {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
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
          <p
            class="mt-2 font-mono text-xs uppercase tracking-widest text-stone-400"
          >
            {data.recipes.length}
            {data.recipes.length === 1 ? "recipe" : "recipes"} saved
          </p>
        </div>

        <Button
          href="/recipes/generate"
          class="group relative overflow-hidden rounded-full border border-amber-300/40 bg-linear-to-br from-amber-50 to-amber-100/50 px-6 py-2.5 transition-all hover:border-amber-400/50 active:scale-[0.98]"
        >
          <Sparkles
            class="mr-2 h-4 w-4 text-amber-600/80 transition-transform group-hover:rotate-12"
          />
          <span class="font-display text-sm text-ink">New Recipe</span>
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

          <!-- Asymmetric scattered layout -->
          <div class="relative min-h-[420px]">
            {#each suggestedRecipes as recipe, i (recipe.id)}
              {@const positions = [
                "left-0 top-0",
                "left-[42%] top-6",
                "right-0 top-0",
                "left-[12%] top-[230px]",
                "left-[52%] top-[210px]",
                "right-[2%] top-[250px]",
              ]}
              {@const rotations = [
                "-rotate-3",
                "rotate-2",
                "-rotate-1",
                "rotate-3",
                "-rotate-2",
                "rotate-1",
              ]}
              <a
                href="/recipes/{recipe.id}"
                class="group absolute w-48 {positions[i % positions.length]}"
                style="z-index: {i + 1};"
              >
                <!-- Photo Frame -->
                <div
                  class="
                  relative bg-white p-1.5 pb-16
                  shadow-[0_2px_8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)]
                  transition-all duration-300 ease-out
                  {rotations[i % rotations.length]}
                  group-hover:rotate-0 group-hover:-translate-y-2 group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)] group-hover:z-50
                "
                >
                  <!-- Washi Tape -->
                  <WashiTape
                    color="sage"
                    class="absolute -top-2 left-1/2 -translate-x-1/2 w-14 z-10"
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
                        <ChefHat class="h-10 w-10 text-stone-300" />
                      </div>
                    {/if}
                    <!-- Match badge -->
                    <div
                      class="absolute bottom-1.5 right-1.5 bg-emerald-500 text-white px-1.5 py-0.5 text-[10px] font-bold rounded-full shadow-sm"
                    >
                      {Math.round(recipe.matchPercentage * 100)}%
                    </div>
                  </div>

                  <!-- Caption area - fixed height -->
                  <div
                    class="absolute bottom-0 left-0 right-0 h-14 px-2 py-1.5 flex flex-col justify-center"
                  >
                    <p
                      class="font-display text-sm text-ink leading-tight truncate text-center"
                    >
                      {recipe.title}
                    </p>
                    <p
                      class="font-mono text-[10px] text-stone-400 text-center mt-0.5 uppercase tracking-wide"
                    >
                      {formatTime(
                        (recipe.prepTime || 0) + (recipe.cookTime || 0),
                      ) || "?"} · {recipe.servings} serv
                    </p>
                  </div>

                  <!-- Shop button on hover -->
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
                    class="absolute -bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <input type="hidden" name="recipeId" value={recipe.id} />
                    <button
                      type="submit"
                      class="flex items-center gap-1 bg-amber-400 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-md transition-colors"
                      disabled={addingToShoppingId === recipe.id}
                    >
                      {#if addingToShoppingId === recipe.id}
                        <Loader2 class="h-3 w-3 animate-spin" />
                      {:else}
                        <ShoppingCart class="h-3 w-3" />
                      {/if}
                      Shop
                    </button>
                  </form>
                </div>
              </a>
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
            <h2 class="font-display text-2xl text-ink">All Recipes</h2>
            <span
              class="font-mono text-[10px] uppercase tracking-widest text-stone-400"
            >
              {otherRecipes.length} saved
            </span>
          </div>

          <!-- Asymmetric grid with varying sizes -->
          <div
            class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6"
          >
            {#each otherRecipes as recipe, i (recipe.id)}
              {@const rotations = [
                "rotate-1",
                "-rotate-2",
                "rotate-2",
                "-rotate-1",
                "rotate-3",
                "-rotate-2",
              ]}
              {@const marginTops = [
                "mt-0",
                "mt-6",
                "mt-2",
                "mt-8",
                "mt-4",
                "mt-10",
              ]}
              <a
                href="/recipes/{recipe.id}"
                class="group block {marginTops[i % marginTops.length]}"
              >
                <!-- Photo Frame -->
                <div
                  class="
                  relative bg-white p-1.5 pb-14
                  shadow-[0_1px_4px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)]
                  transition-all duration-300 ease-out
                  {rotations[i % rotations.length]}
                  group-hover:rotate-0 group-hover:-translate-y-2 group-hover:shadow-[0_8px_20px_rgba(0,0,0,0.15)]
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
                        <ChefHat class="h-8 w-8 text-stone-300" />
                      </div>
                    {/if}
                  </div>

                  <!-- Caption area - fixed height -->
                  <div
                    class="absolute bottom-0 left-0 right-0 h-12 px-1.5 py-1 flex flex-col justify-center"
                  >
                    <p
                      class="font-display text-xs text-ink leading-tight truncate text-center"
                    >
                      {recipe.title}
                    </p>
                    <p
                      class="font-mono text-[9px] text-stone-400 text-center uppercase tracking-wide"
                    >
                      {#if recipe.cuisineType}{recipe.cuisineType}{:else}{formatTime(
                          (recipe.prepTime || 0) + (recipe.cookTime || 0),
                        ) || ""}{/if}
                    </p>
                  </div>

                  <!-- Hover actions -->
                  <div
                    class="absolute -top-2 -right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  >
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
                        class="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-white shadow-md hover:bg-amber-500 transition-colors"
                        title="Add to shopping list"
                      >
                        {#if addingToShoppingId === recipe.id}
                          <Loader2 class="h-3.5 w-3.5 animate-spin" />
                        {:else}
                          <ShoppingCart class="h-3.5 w-3.5" />
                        {/if}
                      </button>
                    </form>

                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
                    <form
                      method="POST"
                      action="?/delete"
                      use:enhance={({ cancel }) => {
                        if (!confirm("Delete this recipe?")) cancel();
                        else deletingId = recipe.id;
                      }}
                      onclick={(e) => e.stopPropagation()}
                    >
                      <input type="hidden" name="recipeId" value={recipe.id} />
                      <button
                        type="submit"
                        disabled={deletingId === recipe.id}
                        class="flex h-7 w-7 items-center justify-center rounded-full bg-red-400 text-white shadow-md hover:bg-red-500 transition-colors"
                        title="Delete recipe"
                      >
                        <Trash2 class="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
              </a>
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
            class="group relative overflow-hidden rounded-full border border-amber-300/40 bg-linear-to-br from-amber-50 to-amber-100/50 px-6 py-2.5 transition-all hover:border-amber-400/50 active:scale-[0.98]"
          >
            <Sparkles
              class="mr-2 h-4 w-4 text-amber-600/80 transition-transform group-hover:rotate-12"
            />
            <span class="font-display text-sm text-ink"
              >Create Your First Recipe</span
            >
          </Button>
        </div>
      {/if}
    </div>
  </main>
</div>
