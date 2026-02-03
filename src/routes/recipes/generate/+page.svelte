<script lang="ts">
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import Notepad from "$lib/components/Notepad.svelte";
  import PinnedNote from "$lib/components/PinnedNote.svelte";
  import StockBadge from "$lib/components/StockBadge.svelte";
  import WashiTape from "$lib/components/WashiTape.svelte";
  import {
    ChefHat,
    Plus,
    X,
    Sparkles,
    ArrowLeft,
    Receipt,
    Users,
    Globe,
    Utensils,
  } from "lucide-svelte";

  let { data, form } = $props();
  let loading = $state(false);
  let customIngredients = $state<string[]>([]);
  let newIngredient = $state("");
  let selectedIngredientIds = $state<Set<string>>(new Set());

  // Initialize servings from preferences
  let servings = $derived(data.preferences?.defaultServings ?? 2);
  let cuisineHint = $state("");

  // Group pantry items by category
  const pantryByCategory = $derived.by(() => {
    const groups: Record<string, any[]> = {};
    for (const item of data.pantry || []) {
      const category = item.category || "Kitchen Staples";
      const displayCategory =
        category.charAt(0).toUpperCase() + category.slice(1);

      if (!groups[displayCategory]) {
        groups[displayCategory] = [];
      }
      groups[displayCategory].push(item);
    }
    return groups;
  });

  // Pre-select high confidence items
  $effect(() => {
    if (data.pantry) {
      const highConfidence = data.pantry.filter(
        (i: any) => i.stockConfidence > 0.6,
      );
      const newSet = new Set<string>();
      highConfidence.forEach((i: any) => {
        if (i.id) newSet.add(i.id);
      });
      selectedIngredientIds = newSet;
    }
  });

  function addIngredient() {
    if (newIngredient.trim()) {
      customIngredients = [...customIngredients, newIngredient.trim()];
      newIngredient = "";
    }
  }

  function removeIngredient(index: number) {
    customIngredients = customIngredients.filter((_, i) => i !== index);
  }

  function togglePantryItem(itemId: string) {
    if (selectedIngredientIds.has(itemId)) {
      selectedIngredientIds.delete(itemId);
    } else {
      selectedIngredientIds.add(itemId);
    }
    selectedIngredientIds = new Set(selectedIngredientIds);
  }
</script>

<svelte:head>
  <title>Generate Recipe - Receipt2Recipe</title>
</svelte:head>

<div
  class="min-h-screen bg-bg-paper pb-20 font-serif text-ink selection:bg-sage-200"
>
  <!-- Texture Overlay -->
  <div
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[20px_20px] opacity-30"
  ></div>
  <div
    class="pointer-events-none absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] opacity-20 mix-blend-multiply"
  ></div>

  <div class="relative mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <Button
      href="/recipes"
      variant="ghost"
      size="sm"
      class="mb-4 text-ink-muted hover:bg-transparent hover:text-ink"
    >
      <ArrowLeft class="mr-1 h-4 w-4" />
      Back to Cookbook
    </Button>
    <div class="mb-10 text-center">
      <div class="relative inline-block">
        <h1
          class="font-display text-4xl font-medium tracking-tight text-ink md:text-5xl"
        >
          The <span class="marker-highlight">Chef's</span> Canvas
        </h1>
      </div>
      <p class="mt-3 font-hand text-2xl text-ink-light -rotate-1">
        Let's create something new today.
      </p>
    </div>

    <form
      method="POST"
      use:enhance={() => {
        loading = true;
        return async ({ result }) => {
          loading = false;
          if (result.type === "redirect") {
            goto(result.location);
          }
        };
      }}
      class="grid gap-8 lg:grid-cols-12 items-start"
    >
      {#if form?.error}
        <div
          class="col-span-full rounded-lg bg-sienna-50 p-4 text-center text-sm text-sienna-700 shadow-sm border border-sienna-100"
        >
          {form.error}
        </div>
      {/if}

      <!-- LEFT COLUMN: The Pantry Inventory (Notepad) -->
      <div class="lg:col-span-7 xl:col-span-8">
        <Notepad class="h-full" tapeWidth="w-32" tapeRotate="-rotate-2">
          <div class="bg-lines p-6 md:p-8 min-h-125">
            <div
              class="mb-6 flex items-baseline justify-between border-b-2 border-dashed border-border pb-4"
            >
              <h2 class="font-display text-2xl text-ink">Kitchen Inventory</h2>
              <span
                class="font-ui text-xs uppercase tracking-widest text-text-muted"
              >
                {selectedIngredientIds.size} Selected
              </span>
            </div>

            {#if data.pantry && data.pantry.length > 0}
              <div class="space-y-8">
                {#each Object.entries(pantryByCategory) as [category, items]}
                  <div class="relative">
                    <h3 class="mb-3 font-serif text-lg italic text-ink-light">
                      {category}
                    </h3>
                    <div class="flex flex-wrap gap-2">
                      {#each items as item}
                        {#if item.id}
                          <button
                            type="button"
                            onclick={() => togglePantryItem(item.id)}
                            class="group relative flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-200
                            {selectedIngredientIds.has(item.id)
                              ? 'bg-sage-50 border-sage-400 text-sage-900 shadow-sm'
                              : 'bg-white border-border text-text-secondary hover:border-primary-300 hover:shadow-sm'}"
                          >
                            <div
                              class="flex h-4 w-4 items-center justify-center rounded-full border transition-colors
                              {selectedIngredientIds.has(item.id)
                                ? 'border-sage-500 bg-sage-500 text-white'
                                : 'border-border group-hover:border-primary-400'}"
                            >
                              {#if selectedIngredientIds.has(item.id)}
                                <span class="text-[10px]">✓</span>
                              {/if}
                            </div>
                            <span
                              class={selectedIngredientIds.has(item.id)
                                ? "font-medium"
                                : ""}>{item.itemName}</span
                            >
                            {#if item.stockConfidence}
                              <StockBadge
                                confidence={item.stockConfidence}
                                className="scale-75 opacity-70"
                              />
                            {/if}
                          </button>
                        {/if}
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
              <input
                type="hidden"
                name="ingredientIds"
                value={Array.from(selectedIngredientIds).join(",")}
              />
            {:else}
              <div
                class="flex flex-col items-center justify-center py-12 text-center"
              >
                <Receipt class="mb-4 h-12 w-12 text-text-muted" />
                <p class="font-serif text-lg text-ink-light">
                  The kitchen is looking a bit bare.
                </p>
                <Button
                  href="/receipts/upload"
                  variant="link"
                  class="font-hand text-xl text-sage-600"
                >
                  Upload a receipt to stock up ->
                </Button>
              </div>
            {/if}
          </div>
        </Notepad>
      </div>

      <!-- RIGHT COLUMN: The Request Slip & Controls -->
      <div class="space-y-6 lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8">
        <!-- Recipe Settings (Pinned Note) -->
        <PinnedNote color="yellow" rotate="rotate-1">
          <div class="space-y-4">
            <h3
              class="font-hand text-2xl text-ink font-bold border-b border-amber-200 pb-2"
            >
              Kitchen Rules
            </h3>

            <div class="space-y-3">
              <div class="space-y-1">
                <Label
                  for="servings"
                  class="flex items-center gap-2 font-serif text-ink"
                >
                  <Users class="h-4 w-4 text-amber-700" />
                  Servings
                </Label>
                <div class="relative">
                  <Input
                    id="servings"
                    name="servings"
                    type="number"
                    min="1"
                    max="20"
                    bind:value={servings}
                    class="border-0 border-b-2 border-amber-300 bg-transparent px-0 text-lg font-medium focus-visible:ring-0 focus-visible:border-amber-500 rounded-none h-auto py-1"
                  />
                  <span class="absolute right-0 top-2 text-xs text-ink-muted"
                    >people</span
                  >
                </div>
              </div>

              <div class="space-y-1 pt-2">
                <Label
                  for="cuisineHint"
                  class="flex items-center gap-2 font-serif text-ink"
                >
                  <Globe class="h-4 w-4 text-amber-700" />
                  Vibe / Cuisine
                </Label>
                <Input
                  id="cuisineHint"
                  name="cuisineHint"
                  type="text"
                  placeholder="e.g. Italian, Spicy, Comfort..."
                  bind:value={cuisineHint}
                  class="border-0 border-b-2 border-amber-300 bg-transparent px-0 text-base focus-visible:ring-0 focus-visible:border-amber-500 rounded-none h-auto py-1 placeholder:text-amber-700/40"
                />
              </div>
            </div>
          </div>
        </PinnedNote>

        <!-- Custom Ingredients (Paper Card) -->
        <div
          class="relative rounded-xl bg-white p-1 shadow-[2px_3px_10px_rgba(0,0,0,0.05)]"
        >
          <WashiTape
            class="absolute -top-3 left-1/2 -translate-x-1/2"
            width="w-24"
            color="white"
            rotate="rotate-0"
          />
          <div class="rounded-lg border border-border p-5">
            <div class="mb-4 flex items-center gap-2">
              <Utensils class="h-4 w-4 text-ink-muted" />
              <h3 class="font-serif font-medium text-ink">Extras & Add-ins</h3>
            </div>

            <div class="flex gap-2 mb-4">
              <Input
                type="text"
                placeholder="Add garlic, oil..."
                bind:value={newIngredient}
                onkeydown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addIngredient())}
                class="bg-bg-paper-dark border-border focus-visible:ring-primary-400"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onclick={addIngredient}
                disabled={!newIngredient.trim()}
                class="shrink-0 border-border hover:bg-primary-50 hover:text-primary-600"
              >
                <Plus class="h-4 w-4" />
              </Button>
            </div>

            {#if customIngredients.length > 0}
              <div class="flex flex-wrap gap-2">
                {#each customIngredients as ingredient, i}
                  <span
                    class="inline-flex items-center gap-1 rounded-md bg-yellow-50 px-2 py-1 text-sm font-hand text-ink border border-yellow-200 -rotate-1 shadow-sm"
                  >
                    {ingredient}
                    <button
                      type="button"
                      onclick={() => removeIngredient(i)}
                      class="text-ink-light hover:text-sienna-600"
                    >
                      <X class="h-3 w-3" />
                    </button>
                  </span>
                {/each}
              </div>
            {/if}
            <input
              type="hidden"
              name="customIngredients"
              value={customIngredients.join(",")}
            />
          </div>
        </div>

        <!-- Submit Action -->
        <div class="pt-4">
          <Button
            type="submit"
            disabled={loading ||
              (selectedIngredientIds.size === 0 &&
                customIngredients.length === 0)}
            class="w-full h-14 text-lg font-serif bg-text-primary text-bg-paper hover:bg-primary-800 shadow-xl transition-all hover:-translate-y-0.5"
          >
            {#if loading}
              <Sparkles class="mr-2 h-5 w-5 animate-pulse" />
              Consulting Chef...
            {:else}
              <ChefHat class="mr-2 h-5 w-5" />
              Invent Recipe
            {/if}
          </Button>
          <p class="mt-3 text-center font-hand text-ink-muted text-sm">
            {#if selectedIngredientIds.size > 0 || customIngredients.length > 0}
              Using {selectedIngredientIds.size + customIngredients.length} ingredients
            {:else}
              Pick something to start...
            {/if}
          </p>
        </div>
      </div>
    </form>
  </div>
</div>

<style>
  .bg-lines {
    background-image: linear-gradient(#e5e7eb 1px, transparent 1px);
    background-size: 100% 2rem;
    background-attachment: local;
  }
</style>
