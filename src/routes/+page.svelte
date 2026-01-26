<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import {
    ChefHat,
    ShoppingCart,
    Plus,
    Check,
    Upload,
    Sparkles,
    Lightbulb,
    Clock,
    History,
    Receipt,
    CheckCircle,
    Loader2,
    XCircle,
    Store,
  } from "lucide-svelte";
  import PushPin from "$lib/components/PushPin.svelte";
  import WashiTape from "$lib/components/WashiTape.svelte";
  import PinnedNote from "$lib/components/PinnedNote.svelte";
  import Notepad from "$lib/components/Notepad.svelte";
  import StockBadge from "$lib/components/StockBadge.svelte";
  import OnboardingModal from "$lib/components/OnboardingModal.svelte";
  import { getContext } from "svelte";
  import type { WorkflowState } from "$lib/state/workflow.svelte";

  let { data, form } = $props();
  const workflowState = getContext<WorkflowState>("workflowState");

  type Ingredient = {
    name: string;
    quantity?: string;
    unit?: string;
    note?: string;
  };

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Friendly prompts
  const mealSuggestion =
    hour < 11
      ? "Planning breakfast or prepping for dinner?"
      : hour < 15
        ? "Time to think about lunch or tonight's dinner!"
        : hour < 19
          ? "What's cooking for dinner tonight?"
          : "Late night snack ideas, anyone?";

  const tips = [
    "Salt your pasta water until it tastes like the sea.",
    "Let meat rest after cooking for juicier results.",
    "Fresh herbs go in at the end, dried herbs at the start.",
    "A squeeze of lemon brightens almost any dish.",
    "Room temperature eggs blend better in baking.",
  ];
  const randomTip = tips[Math.floor(Math.random() * tips.length)];

  const featuredRecipe = $derived(data.recentRecipes?.[0]);
  const recipeFeed = $derived(data.recentRecipes ?? []);
  const recentReceipts = $derived(data.recentReceipts ?? []);

  // Use $derived for state but allow overrides
  let pantryItems = $derived(data.pantry ?? []);
  let shoppingListNames = $derived(
    new Set(data.activeList?.items?.map((i: any) => i.name) ?? []),
  );

  // Ingredients Logic - use actual recipe ingredients when available
  const ingredientList = $derived.by<any[]>(() => {
    if (
      featuredRecipe &&
      "ingredients" in featuredRecipe &&
      Array.isArray(featuredRecipe.ingredients) &&
      featuredRecipe.ingredients.length > 0
    ) {
      return featuredRecipe.ingredients.map((ing: any) => {
        // Simple fuzzy match for pantry status
        const pantryMatch = pantryItems.find(
          (p) =>
            p.itemName.toLowerCase().includes(ing.name.toLowerCase()) ||
            ing.name.toLowerCase().includes(p.itemName.toLowerCase()),
        );
        return {
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          note: ing.notes || (ing.optional ? "optional" : undefined),
          pantryMatch,
        };
      });
    }
    // Only show placeholder when there are no recipes
    return [
      {
        name: "Generate a recipe to see ingredients",
        note: "Ingredients will appear here",
      },
    ];
  });

  const pantryList = $derived(pantryItems);

  let flashIngredient = $state<string | null>(null);
  let cartOpen = $state(false);
  let showAllIngredients = $state(false);
  let addingIngredient = $state<string | null>(null);

  const shoppingPreview = $derived(data.suggestions ?? []);
  const cartCount = $derived(workflowState.shoppingItems);
  const visibleIngredients = $derived.by(() =>
    showAllIngredients ? ingredientList : ingredientList.slice(0, 6),
  );

  function formatIngredientDisplay(ing: any): string {
    const name = ing.name || ing.itemName;
    if (ing.quantity && ing.unit) {
      return `${ing.quantity} ${ing.unit} ${name}`;
    }
    if (ing.quantity) {
      return `${ing.quantity} ${name}`;
    }
    return name;
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "DONE":
        return CheckCircle;
      case "PROCESSING":
        return Loader2;
      case "QUEUED":
        return Clock;
      case "FAILED":
        return XCircle;
      default:
        return Clock;
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "DONE":
        return "Ready";
      case "PROCESSING":
        return "Processing";
      case "QUEUED":
        return "Queued";
      case "FAILED":
        return "Failed";
      default:
        return status;
    }
  }
</script>

<svelte:head>
  <title>Receipt2Recipe - Transform Groceries into Meals</title>
</svelte:head>

{#if data.user}
  <!-- Onboarding Modal for new users -->
  <OnboardingModal
    receiptCount={data.metrics?.receipts ?? 0}
    recipeCount={data.metrics?.recipes ?? 0}
  />

  <div
    class="paper-card relative flex min-h-screen gap-0 rounded-4xl border border-sand bg-[#FDFBF7] shadow-[0_30px_80px_-50px_rgba(45,55,72,0.6)]"
  >
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.08),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.08),transparent_28%)] rounded-4xl"
    ></div>

    <aside
      class="sticky top-24 z-20 hidden w-[320px] shrink-0 h-[calc(100vh-8rem)] overflow-y-auto border-r border-sand bg-stone-50/80 px-6 py-6 backdrop-blur-sm lg:block rounded-tl-4xl rounded-bl-4xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
    >
      <div class="flex h-full flex-col justify-between gap-6">
        <div class="space-y-6">
          <div
            class="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-ink-muted"
          >
            <span>{greeting}, {data.user.name?.split(" ")[0] || "chef"}</span>
          </div>

          <PinnedNote>
            <div class="flex items-start gap-3">
              <div class="mt-0.5 text-amber-600">
                <Lightbulb class="h-4 w-4" />
              </div>
              <div>
                <p class="font-hand text-sm leading-snug text-ink/80">
                  {randomTip}
                </p>
              </div>
            </div>
          </PinnedNote>

          <Notepad>
            <div class="border-b border-dashed border-stone-200 p-5">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                  <h3 class="font-display text-lg text-ink">Scan & Sort</h3>

                  <div
                    class="flex flex-col gap-px opacity-40 select-none mix-blend-multiply mt-1"
                    aria-hidden="true"
                  >
                    <div
                      class="h-3 w-8"
                      style="background: linear-gradient(to right, #000 1px, transparent 1px, transparent 3px, #000 3px, #000 4px, transparent 4px, transparent 6px, #000 6px, #000 9px, transparent 9px, transparent 10px, #000 10px, #000 12px, transparent 12px, transparent 14px, #000 14px, #000 15px, transparent 15px, transparent 18px, #000 18px);"
                    ></div>
                    <div
                      class="text-[5px] font-mono leading-none tracking-widest text-black/60 text-center"
                    >
                      8401
                    </div>
                  </div>
                </div>

                <div
                  class="flex h-8 w-8 items-center justify-center rounded-lg bg-sage-50 text-sage-600"
                >
                  <Upload class="h-4 w-4" />
                </div>
              </div>

              <div class="grid grid-cols-1 gap-2">
                <Button
                  href="/receipts/upload"
                  size="sm"
                  class="w-full bg-sage-600 text-white hover:bg-sage-500 shadow-sm"
                >
                  Drop receipt
                </Button>
              </div>
            </div>

            <div class="p-2">
              <a
                href="/shopping"
                class="flex w-full items-center justify-between rounded-lg p-3 text-left hover:bg-stone-50 transition-colors"
              >
                <div>
                  <p
                    class="text-[10px] uppercase tracking-wider text-ink-muted"
                  >
                    Shopping List
                  </p>
                  <p class="font-display text-xl text-ink">
                    {cartCount} items
                  </p>
                  {#if data.activeList?.stats}
                    <div class="flex items-center gap-2 mt-1">
                      <div class="h-1.5 w-16 rounded-full bg-stone-200">
                        <div
                          class="h-1.5 rounded-full bg-sage-500 transition-all"
                          style="width: {data.activeList.stats
                            .completionPercent}%"
                        ></div>
                      </div>
                      <span class="text-[10px] text-ink-muted">
                        {data.activeList.stats.completionPercent}%
                      </span>
                    </div>
                  {/if}
                </div>
                <ShoppingCart class="h-5 w-5 text-sage-600" />
              </a>

              {#if shoppingPreview.length > 0}
                <div
                  class="mt-2 max-h-32 overflow-y-auto px-3 pb-3 space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
                >
                  <p
                    class="text-[10px] uppercase tracking-wider text-ink-muted mb-1"
                  >
                    Suggested
                  </p>
                  {#each shoppingPreview.slice(0, 4) as suggestion}
                    <div class="flex items-center gap-2 text-xs text-ink">
                      <Sparkles class="h-3 w-3 text-sage-400" />
                      <span class="truncate">{suggestion.itemName}</span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </Notepad>
        </div>

        {#if pantryList.length > 0}
          <div
            class="mb-4 rounded-xl border border-sand/60 bg-[#fffdf5] p-4 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] rotate-1"
          >
            <div
              class="flex items-center gap-2 text-xs text-ink-muted uppercase tracking-wider mb-2 border-b border-sand/40 pb-2"
            >
              <Store class="h-3 w-3" /> Your Pantry
            </div>
            <ul
              class="space-y-2 max-h-40 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
            >
              {#each pantryList as item}
                <li
                  class="flex items-center justify-between text-sm text-ink/80"
                >
                  <span class="truncate">{item.itemName}</span>
                  {#if item.stockConfidence}
                    <StockBadge
                      confidence={item.stockConfidence}
                      className="scale-75 origin-right"
                    />
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        <div
          class="mb-4 rounded-xl border border-sand/60 bg-[#fffdf5] p-4 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] -rotate-1"
        >
          <div
            class="flex items-center gap-2 text-xs text-ink-muted uppercase tracking-wider mb-2 border-b border-sand/40 pb-2"
          >
            <History class="h-3 w-3" /> Recent Pulls
          </div>
          {#if recipeFeed.length > 0}
            <ul class="space-y-2 font-hand text-sm text-ink/70">
              {#each recipeFeed.slice(0, 3) as recipe}
                <li>
                  <a
                    href="/recipes/{recipe.id}"
                    class="block cursor-pointer hover:text-ink hover:underline decoration-wavy decoration-sage-300 truncate"
                  >
                    {recipe.title}
                  </a>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="text-sm text-ink-muted italic">No recipes yet</p>
          {/if}
        </div>

        <!-- Recent Receipts -->
        {#if recentReceipts.length > 0}
          <div
            class="rounded-xl border border-sand/60 bg-[#fffdf5] p-4 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] rotate-1"
          >
            <div
              class="flex items-center gap-2 text-xs text-ink-muted uppercase tracking-wider mb-2 border-b border-sand/40 pb-2"
            >
              <Receipt class="h-3 w-3" /> Recent Receipts
            </div>
            <ul class="space-y-2">
              {#each recentReceipts as receipt}
                {@const StatusIcon = getStatusIcon(receipt.status)}
                <li>
                  <a
                    href="/receipts/{receipt.id}"
                    class="flex items-center gap-2 text-sm text-ink/70 hover:text-ink transition-colors"
                  >
                    <Store class="h-3 w-3 text-ink-muted shrink-0" />
                    <span class="truncate flex-1"
                      >{receipt.storeName || "Receipt"}</span
                    >
                    {#if receipt.status === "PROCESSING"}
                      <StatusIcon
                        class="h-3 w-3 text-sage-500 animate-spin shrink-0"
                      />
                    {:else if receipt.status === "DONE"}
                      <StatusIcon class="h-3 w-3 text-sage-500 shrink-0" />
                    {:else if receipt.status === "FAILED"}
                      <StatusIcon class="h-3 w-3 text-sienna-500 shrink-0" />
                    {:else}
                      <StatusIcon class="h-3 w-3 text-ink-muted shrink-0" />
                    {/if}
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    </aside>

    <main
      class="relative z-10 flex flex-1 flex-col bg-white rounded-4xl lg:rounded-l-none lg:rounded-r-4xl"
    >
      <div class="mx-auto w-full max-w-5xl px-6 py-6 sm:px-10">
        <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="font-hand text-lg text-ink-light mb-1">
              {mealSuggestion}
            </p>
            {#if pantryItems.length === 0}
              <h1
                class="font-display text-4xl leading-[1.1] text-ink drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]"
              >
                Start by <span class="marker-highlight">dropping a receipt</span
                >.
              </h1>
            {:else}
              <h1
                class="font-display text-4xl leading-[1.1] text-ink drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]"
              >
                What are we <span class="marker-highlight">cooking</span> today?
              </h1>
            {/if}
            <div
              class="mt-4 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-stone-400"
            >
              <span
                class={pantryItems.length === 0
                  ? "text-sage-600 font-bold border-b-2 border-sage-200"
                  : ""}>1. Scan</span
              >
              <span class="text-stone-300">→</span>
              <span
                class={pantryItems.length > 0
                  ? "text-sage-600 font-bold border-b-2 border-sage-200"
                  : ""}>2. Stock</span
              >
              <span class="text-stone-300">→</span>
              <span>3. Cook</span>
              <span class="text-stone-300">→</span>
              <span>4. Shop</span>
            </div>
          </div>
          <Button
            href="/recipes/generate"
            class="group relative h-10 overflow-hidden rounded-lg border border-sage-300 bg-white px-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sage-400 hover:bg-[#fafaf9] hover:shadow-md active:scale-95"
          >
            <div class="flex items-center gap-2">
              <Sparkles class="h-4 w-4 text-sage-600 transition-transform duration-500 group-hover:rotate-12 group-hover:text-sage-700" />
              <span class="font-display text-base font-medium text-ink">Generate New Recipe</span>
            </div>
          </Button>
        </div>

        <div class="grid items-stretch gap-8 lg:grid-cols-12">
          <div class="lg:col-span-7">
            <a
              href={featuredRecipe
                ? `/recipes/${featuredRecipe.id}`
                : "/recipes"}
              class="group relative flex h-full flex-row overflow-hidden rounded-r-2xl rounded-l-md border border-stone-200 bg-[#fffefb] shadow-[2px_3px_10px_rgba(0,0,0,0.03)] transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                class="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-12 bg-linear-to-r from-stone-200/40 to-transparent"
              ></div>

              <div
                class="absolute -top-1 right-6 z-20 h-16 w-8 drop-shadow-sm transition-transform duration-300 group-hover:-translate-y-2"
              >
                <div
                  class="h-full w-full bg-red-700"
                  style="clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%);"
                ></div>
                <div
                  class="absolute inset-x-1 top-0 bottom-4 border-l border-r border-dashed border-white/20"
                ></div>
              </div>

              <div class="relative w-5/12 p-5 pr-2">
                <div
                  class="relative h-full w-full -rotate-1 transform transition-transform duration-500 group-hover:rotate-0"
                >
                  <div
                    class="absolute -top-2 left-1/2 z-20 h-6 w-16 -translate-x-1/2 -rotate-2 bg-amber-100/40 backdrop-blur-[1px]"
                    style="mask-image: url('data:image/svg+xml;utf8,<svg width=\'100%\' height=\'100%\' xmlns=\'http://www.w3.org/2000/svg\'><rect x=\'0\' y=\'0\' width=\'100%\' height=\'100%\' fill=\'black\'/></svg>'); box-shadow: 0 1px 2px rgba(0,0,0,0.1);"
                  ></div>
                  <div
                    class="absolute -top-2 left-1/2 z-20 h-6 w-16 -translate-x-1/2 -rotate-2 opacity-20 mix-blend-multiply shadow-sm bg-stone-300"
                  ></div>

                  <div
                    class="h-full w-full overflow-hidden rounded-[2px] border border-stone-100 bg-white p-1.5 shadow-sm"
                  >
                    {#if featuredRecipe?.imageUrl}
                      <img
                        src={featuredRecipe.imageUrl}
                        alt={featuredRecipe.title}
                        class="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      />
                    {:else}
                      <div
                        class="flex h-full w-full items-center justify-center bg-stone-100"
                      >
                        <ChefHat class="h-8 w-8 text-stone-300" />
                      </div>
                    {/if}
                    <div
                      class="pointer-events-none absolute inset-0 bg-linear-to-tr from-white/20 to-transparent opacity-50"
                    ></div>
                  </div>
                </div>
              </div>

              <div
                class="relative flex w-7/12 flex-col justify-center p-8 pl-6"
              >
                <div
                  class="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-stone-400"
                >
                  <span>Chapter 3: Fresh Pulls</span>
                </div>

                <h3
                  class="font-display text-3xl leading-tight text-ink decoration-stone-300 decoration-2 underline-offset-4 group-hover:underline"
                >
                  {featuredRecipe?.title || "Seasonal Supper"}
                </h3>

                <div
                  class="mt-4 flex items-center gap-4 text-xs font-medium text-stone-500"
                >
                  <span class="flex items-center gap-1.5"
                    ><Clock class="h-3.5 w-3.5 text-stone-400" /> 25 min</span
                  >
                  <span class="h-1 w-1 rounded-full bg-stone-300"></span>
                  <span>{featuredRecipe?.servings || 2} servings</span>
                </div>

                <p
                  class="mt-4 line-clamp-2 font-serif text-sm italic leading-relaxed text-stone-600"
                >
                  "{featuredRecipe?.description ||
                    "Pull a receipt and we'll turn it into a warm, camera-ready dinner."}"
                </p>

                <div
                  class="absolute bottom-4 right-6 font-mono text-[10px] text-stone-300"
                >
                  p. 14
                </div>
              </div>
            </a>
          </div>

          <div class="lg:col-span-5">
            <Card.Root
              class="relative mx-auto flex h-full w-full flex-col overflow-hidden rounded-lg border border-stone-200 bg-[#fffdf5] shadow-[2px_3px_5px_rgba(0,0,0,0.05)]"
              style="border-radius: 4px 16px 16px 4px;"
            >
              <div
                class="flex shrink-0 items-center justify-between border-b border-stone-200 bg-[#f7f5eb] px-6 py-4"
              >
                <span
                  class="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500"
                  >Mise en place</span
                >
                <div class="flex gap-1">
                  <div class="h-1.5 w-1.5 rounded-full bg-stone-300"></div>
                  <div class="h-1.5 w-1.5 rounded-full bg-stone-300"></div>
                  <div class="h-1.5 w-1.5 rounded-full bg-stone-300"></div>
                </div>
              </div>

              <Card.Content class="relative flex-1 p-0">
                <div
                  class="absolute bottom-0 left-8 top-0 z-0 h-full w-px border-r border-red-200/60"
                ></div>

                <div
                  class={`relative z-10 h-full max-h-80 overflow-y-auto space-y-0 pt-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']`}
                >
                  {#each visibleIngredients as ingredient}
                    {@const itemName = ingredient.name}
                    {@const ingredientDisplay =
                      formatIngredientDisplay(ingredient)}
                    {@const isAdded = shoppingListNames.has(ingredientDisplay)}
                    {@const isAdding = addingIngredient === ingredientDisplay}
                    {@const inPantry =
                      !!ingredient.pantryMatch &&
                      ingredient.pantryMatch.stockConfidence > 0.3}

                    <form
                      method="POST"
                      action="?/toggleIngredient"
                      use:enhance={() => {
                        addingIngredient = ingredientDisplay;
                        // Optimistic update
                        const newSet = new Set(shoppingListNames);
                        if (isAdded) {
                          newSet.delete(ingredientDisplay);
                          workflowState.decrementShopping();
                        } else {
                          newSet.add(ingredientDisplay);
                          workflowState.incrementShopping();
                        }
                        shoppingListNames = newSet;

                        return async ({ result }) => {
                          addingIngredient = null;
                          if (result.type !== "success") {
                            // Rollback on error
                            const revertSet = new Set(shoppingListNames);
                            if (isAdded) {
                              revertSet.add(ingredientDisplay);
                              workflowState.incrementShopping();
                            } else {
                              revertSet.delete(ingredientDisplay);
                              workflowState.decrementShopping();
                            }
                            shoppingListNames = revertSet;
                          }
                        };
                      }}
                      class={`group relative flex w-full items-start gap-4 px-4 py-3 text-left transition-colors duration-200 ${isAdded ? "bg-amber-50/40" : inPantry ? "bg-emerald-50/40" : "hover:bg-blue-50/30"}`}
                    >
                      <input
                        type="hidden"
                        name="ingredientName"
                        value={ingredientDisplay}
                      />
                      <div
                        class="absolute bottom-0 left-0 right-0 border-b border-blue-200/30"
                      ></div>

                      {#if inPantry}
                        <div
                          class="relative z-20 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 cursor-help"
                          title="In your pantry"
                        >
                          <Check class="h-3 w-3" />
                        </div>
                      {:else}
                        <button
                          type="submit"
                          disabled={isAdding}
                          class="relative z-20 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed
                            {isAdded
                            ? 'bg-amber-100 border-amber-200 text-amber-700 hover:bg-amber-200'
                            : 'border-stone-300 bg-white hover:border-stone-400'}"
                          title={isAdded
                            ? "Remove from list"
                            : "Add to shopping list"}
                        >
                          {#if isAdded}
                            <Check class="h-3 w-3" />
                          {:else if isAdding}
                            <Loader2
                              class="h-3 w-3 animate-spin text-sage-500"
                            />
                          {:else}
                            <Plus class="h-3 w-3 text-stone-400" />
                          {/if}
                        </button>
                      {/if}

                      <div class="flex-1 pl-2 font-mono text-sm leading-snug">
                        <div class="flex items-center justify-between">
                          <p
                            class={`transition-all ${isAdded ? "text-amber-800/70 line-through decoration-amber-300" : inPantry ? "text-emerald-800/70 line-through decoration-emerald-300" : "text-stone-700"}`}
                          >
                            {ingredientDisplay}
                          </p>
                          {#if inPantry && ingredient.pantryMatch?.stockConfidence}
                            <StockBadge
                              confidence={ingredient.pantryMatch
                                .stockConfidence}
                            />
                          {/if}
                        </div>
                        {#if ingredient.note}
                          <p class="mt-0.5 text-[10px] italic text-stone-400">
                            {ingredient.note}
                          </p>
                        {:else if inPantry && ingredient.pantryMatch?.lastPurchased}
                          <p class="mt-0.5 text-[10px] italic text-stone-400">
                            In pantry (bought {new Date(
                              ingredient.pantryMatch.lastPurchased,
                            ).toLocaleDateString()})
                          </p>
                        {/if}
                      </div>
                    </form>
                  {/each}

                  {#if visibleIngredients.length < 6}
                    {#each Array(6 - visibleIngredients.length) as _}
                      <div class="relative h-12 w-full">
                        <div
                          class="absolute bottom-0 left-0 right-0 border-b border-blue-200/30"
                        ></div>
                      </div>
                    {/each}
                  {/if}
                  <div class="h-12"></div>
                </div>

                <div
                  class="pointer-events-none absolute bottom-0 inset-x-0 z-20 h-16 bg-linear-to-t from-[#fffdf5] to-transparent"
                ></div>

                {#if ingredientList.length > 6}
                  <div
                    class="absolute bottom-4 left-0 right-0 z-30 flex justify-center"
                  >
                    <button
                      onclick={() => (showAllIngredients = !showAllIngredients)}
                      class="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500 shadow-sm hover:bg-stone-50 hover:text-stone-700"
                    >
                      {showAllIngredients ? "Fold Page" : "View Full List"}
                    </button>
                  </div>
                {/if}
              </Card.Content>
            </Card.Root>
          </div>
        </div>

        <div class="mt-16">
          <div
            class="mb-6 flex items-baseline justify-between border-b border-stone-300 pb-2"
          >
            <h2 class="font-display text-2xl text-ink">Recent Collections</h2>
            <a
              href="/recipes"
              class="text-xs font-medium uppercase tracking-wider text-sage-600 hover:text-sage-800 hover:underline"
              >To your cookbook</a
            >
          </div>

          <div
            class="columns-1 gap-6 md:columns-2 lg:columns-3 [column-fill:balance]"
          >
            {#if recipeFeed.length}
              {#each recipeFeed as recipe (recipe.id)}
                <a
                  href={`/recipes/${recipe.id}`}
                  class="break-inside-avoid mb-8 block group relative"
                >
                  <div
                    class="
                    relative overflow-hidden rounded-xl border border-stone-200
                    bg-[#fffefb] p-3
                    /* The Physical 'Hard' Shadow */
                    shadow-[2px_2px_0_rgba(0,0,0,0.05)]
                    transition-all duration-200 ease-out
                    group-hover:-translate-y-1 group-hover:shadow-[4px_4px_0_rgba(0,0,0,0.05)] group-hover:border-stone-300
                  "
                  >
                    <div
                      class="relative aspect-video overflow-hidden rounded-lg bg-stone-100 border border-black/5"
                    >
                      {#if recipe.imageUrl}
                        <img
                          src={recipe.imageUrl}
                          alt={recipe.title}
                          class="h-full w-full object-cover transition duration-500 group-hover:scale-105 group-hover:brightness-110"
                        />
                      {:else}
                        <div
                          class="flex h-full w-full items-center justify-center bg-stone-100"
                        >
                          <ChefHat class="h-6 w-6 text-stone-300" />
                        </div>
                      {/if}

                      <div
                        class="absolute inset-0 bg-linear-to-tr from-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity"
                      ></div>

                      <div
                        class="absolute top-2 right-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-mono tracking-widest text-stone-500 shadow-sm backdrop-blur-sm"
                      >
                        {new Date()
                          .toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                          .toUpperCase()}
                      </div>
                    </div>

                    <div class="pt-4 px-1 pb-2">
                      <h3
                        class="font-display text-xl leading-tight text-ink decoration-stone-300 underline-offset-4 group-hover:underline"
                      >
                        {recipe.title}
                      </h3>

                      <div class="mt-3 flex flex-wrap gap-2">
                        {#if recipe.cuisineType}
                          <span
                            class="
                                    inline-flex items-center rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5
                                    font-mono text-[10px] text-stone-500 uppercase tracking-wide
                                "
                          >
                            {recipe.cuisineType}
                          </span>
                        {/if}
                        <span
                          class="
                                inline-flex items-center rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5
                                font-mono text-[10px] text-stone-500 uppercase tracking-wide
                             "
                        >
                          {recipe.servings} SERV
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              {/each}
            {:else}
              <div
                class="col-span-full rounded-xl border border-dashed border-stone-300 bg-stone-50/50 py-12 text-center"
              >
                <p class="font-hand text-lg text-ink-muted">
                  Your cookbook is waiting for its first entry.
                </p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </main>
  </div>
{:else}
  <div
    class="flex min-h-screen items-center justify-center bg-[#FDFBF7] px-6 py-12 text-center"
  >
    <div class="max-w-2xl space-y-4">
      <p class="text-xs uppercase tracking-[0.16em] text-ink-muted">Welcome</p>
      <h1 class="font-display text-4xl text-ink">
        Turn grocery <span class="marker-highlight">receipts</span> into an editorial
        cookbook.
      </h1>
      <p class="font-hand text-lg text-ink-light">
        Sign in to drop a receipt and see your recipes bloom.
      </p>
      <div
        class="flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-center"
      >
        <Button href="/login" size="lg">Log in</Button>
        <Button
          href="/register"
          variant="outline"
          size="lg"
          class="border-sand text-ink">Create account</Button
        >
      </div>
    </div>
  </div>
{/if}
