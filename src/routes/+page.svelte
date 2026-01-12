<script lang="ts">
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
  } from "lucide-svelte";

  let { data } = $props();
  type Ingredient = { name: string; note?: string };

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Friendly prompts based on time of day
  const mealSuggestion =
    hour < 11
      ? "Planning breakfast or prepping for dinner?"
      : hour < 15
        ? "Time to think about lunch or tonight's dinner!"
        : hour < 19
          ? "What's cooking for dinner tonight?"
          : "Late night snack ideas, anyone?";

  // Random cooking tips
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
  const ingredientList = $derived.by<Ingredient[]>(() => {
    if (
      featuredRecipe &&
      "ingredients" in featuredRecipe &&
      Array.isArray(featuredRecipe.ingredients)
    ) {
      return featuredRecipe.ingredients as Ingredient[];
    }
    return [
      { name: "2 cups baby spinach" },
      { name: "1 lb roasted chicken thighs" },
      { name: "1/2 cup torn basil leaves" },
      { name: "1 lemon, zested & juiced" },
      { name: "1 tbsp smoked olive oil", note: "for finishing" },
      { name: "Cracked pepper & flaky salt" },
    ];
  });

  let addedIngredients = $state<Set<string>>(new Set());
  let flashIngredient = $state<string | null>(null);
  let cartOpen = $state(false);

  const shoppingPreview = $derived(data.suggestions ?? []);
  const cartItems = $derived.by(() => {
    const names = new Set<string>();
    const collected: string[] = [];
    for (const suggestion of shoppingPreview) {
      if (suggestion?.itemName && !names.has(suggestion.itemName)) {
        names.add(suggestion.itemName);
        collected.push(suggestion.itemName);
      }
    }
    for (const name of addedIngredients) {
      if (!names.has(name)) {
        names.add(name);
        collected.push(name);
      }
    }
    return collected;
  });
  const cartCount = $derived(cartItems.length);

  function toggleIngredient(name: string) {
    const next = new Set(addedIngredients);
    const adding = !next.has(name);
    if (adding) {
      next.add(name);
      cartOpen = true;
      flashIngredient = name;
      setTimeout(() => {
        if (flashIngredient === name) {
          flashIngredient = null;
        }
      }, 450);
    } else {
      next.delete(name);
    }
    addedIngredients = next;
  }
</script>

<svelte:head>
  <title>Receipt2Recipe - Transform Groceries into Meals</title>
</svelte:head>

{#if data.user}
  <div
    class="relative flex min-h-screen gap-8 rounded-4xl border border-sand bg-[#FDFBF7] p-6 shadow-[0_30px_80px_-50px_rgba(45,55,72,0.6)]"
  >
    <div
      class="pointer-events-none absolute inset-0 rounded-4xl bg-[radial-gradient(circle_at_10%_20%,rgba(113,128,150,0.08),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(237,137,54,0.08),transparent_28%)]"
    ></div>
    <!-- Left: Kitchen Counter -->
    <aside
      class="sticky top-0 z-10 w-[34%] min-w-[320px] h-screen overflow-auto border-r border-sand bg-stone-50/80 px-8 py-8 backdrop-blur-sm scroll-hide"
    >
      <div class="space-y-6">
        <p class="text-xs uppercase tracking-[0.18em] text-ink-muted">
          {greeting}, {data.user.name?.split(" ")[0] || "chef"}
        </p>
        <h2 class="font-display text-3xl leading-tight text-ink">
          What are we <span class="marker-highlight">cooking</span> today?
        </h2>
        <p class="font-hand text-lg text-ink-light">
          {mealSuggestion}
        </p>

        <!-- Chef's Tip sticky note -->
        <div class="relative max-w-sm">
          <div
            class="absolute -left-3 -top-3 h-10 w-10 rotate-6 bg-amber-200/40 blur-xl"
          ></div>
          <div
            class="-rotate-1 rounded-2xl border border-amber-200 bg-linear-to-br from-amber-50 to-[#FFF4D6] p-4 shadow-md shadow-amber-200/50"
          >
            <div class="flex items-start gap-3 font-hand">
              <div
                class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200"
              >
                <Lightbulb class="h-4 w-4 text-amber-700" />
              </div>
              <div>
                <p class="text-xs uppercase tracking-wide text-amber-700">
                  Chef's tip
                </p>
                <p class="text-base text-ink">{randomTip}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Drop zone -->
        <div
          class="rounded-3xl border-2 border-dashed border-stone-300 bg-white/90 p-6 shadow-[0_22px_48px_-40px_rgba(45,55,72,0.6)] transition hover:-translate-y-0.5 hover:border-sage-500 hover:shadow-lg"
        >
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm uppercase tracking-[0.16em] text-ink-muted">
                Drop receipt
              </p>
              <h3 class="font-display text-2xl text-ink">Scan & Sort</h3>
              <p class="text-sm text-ink-light">
                Drag a photo or forward your email receipt. We'll handle the
                rest.
              </p>
            </div>
            <div
              class="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-100 text-sage-600"
            >
              <Upload class="h-6 w-6" />
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-3">
            <Button
              href="/receipts/upload"
              size="sm"
              class="bg-sage-600 text-white hover:bg-sage-500"
            >
              <Upload class="mr-2 h-4 w-4" /> Drop receipt here
            </Button>
            <Button
              href="/receipts"
              variant="outline"
              size="sm"
              class="border-sand text-ink"
            >
              View inbox
            </Button>
          </div>
        </div>

        <!-- Quick stats -->
        <div class="rounded-lg bg-stone-100/50 p-4">
          <p class="text-xs uppercase tracking-[0.16em] text-ink-muted">
            Kitchen stats
          </p>
          <div class="mt-3 grid grid-cols-3 gap-3">
            <div class="rounded-xl bg-white/80 p-3 shadow-sm">
              <p class="text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                Receipts
              </p>
              <p class="font-display text-3xl text-ink">
                {data.metrics?.receipts ?? 0}
              </p>
            </div>
            <div class="rounded-xl bg-white/80 p-3 shadow-sm">
              <p class="text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                Recipes
              </p>
              <p class="font-display text-3xl text-ink">
                {data.metrics?.recipes ?? 0}
              </p>
            </div>
            <div class="rounded-xl bg-white/80 p-3 shadow-sm">
              <p class="text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                List items
              </p>
              <p class="font-display text-3xl text-ink">
                {data.metrics?.activeListItems ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Live Shopping Cart -->
      <div
        class="mt-6 rounded-3xl border border-sand bg-white/90 p-4 shadow-md"
      >
        <button
          class="flex w-full items-center justify-between text-left"
          onclick={() => (cartOpen = !cartOpen)}
          aria-expanded={cartOpen}
        >
          <div>
            <p class="text-xs uppercase tracking-[0.16em] text-ink-muted">
              Shopping list
            </p>
            <p class="font-display text-2xl text-ink">
              {cartCount} item{cartCount === 1 ? "" : "s"} to buy
            </p>
          </div>
          <span
            class="flex h-10 w-10 items-center justify-center rounded-full bg-sage-100 text-sage-700"
          >
            <ShoppingCart class="h-5 w-5" />
          </span>
        </button>
        {#if cartOpen}
          <div class="mt-4 max-h-44 space-y-2 overflow-y-auto pr-1">
            {#if cartItems.length === 0}
              <p class="font-hand text-sm text-ink-muted">
                Add ingredients from the recipe to build your run.
              </p>
            {:else}
              {#each cartItems as item}
                <div
                  class="flex items-center justify-between rounded-xl border border-sand/70 bg-sage-50/60 px-3 py-2 text-sm text-ink"
                >
                  <span class="truncate">{item}</span>
                  <Check class="h-4 w-4 text-sage-600" />
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </aside>

    <!-- Right: Recipe Feed -->
    <main class="relative z-10 flex flex-1 flex-col bg-white">
      <div class="flex-1 space-y-10 px-6 py-8 sm:px-10 sm:py-12">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-[0.16em] text-ink-muted">
              Fresh pulls
            </p>
            <h1 class="font-display text-4xl leading-tight text-ink">
              Editorial <span class="marker-highlight">recipe</span> feed
            </h1>
          </div>
          <Button
            href="/recipes/generate"
            variant="outline"
            class="border-sand text-ink"
          >
            <Sparkles class="mr-2 h-4 w-4 text-amber-500" /> Generate new recipe
          </Button>
        </div>

        <!-- Feature + Ingredients -->
        <div class="grid gap-6 lg:grid-cols-2">
          <a
            href={featuredRecipe ? `/recipes/${featuredRecipe.id}` : "/recipes"}
            class="group relative block overflow-hidden rounded-[28px] border border-sand bg-white shadow-[0_28px_60px_-46px_rgba(45,55,72,0.55)]"
          >
            <div class="relative h-80 overflow-hidden">
              {#if featuredRecipe?.imageUrl}
                <img
                  src={featuredRecipe.imageUrl}
                  alt={featuredRecipe.title}
                  class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              {:else}
                <div
                  class="flex h-full w-full items-center justify-center bg-linear-to-br from-sage-50 to-sand"
                >
                  <ChefHat class="h-10 w-10 text-sage-500" />
                </div>
              {/if}
              <div
                class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
              ></div>
              <div class="absolute bottom-0 left-0 right-0 p-6">
                <p class="text-xs uppercase tracking-[0.18em] text-white/80">
                  Featured
                </p>
                <h3 class="font-display text-2xl text-white">
                  {featuredRecipe?.title || "Seasonal Supper"}
                </h3>
                <p class="text-sm text-white/80">
                  {featuredRecipe?.description ||
                    "Pull a receipt and we'll turn it into a warm, camera-ready dinner."}
                </p>
              </div>
            </div>
          </a>

          <Card.Root
            class="receipt-edge receipt-tear relative mx-auto w-80 max-w-xs overflow-hidden border border-stone-200 bg-white shadow-[0_24px_55px_-46px_rgba(45,55,72,0.55)]"
          >
            <div class="flex items-center justify-between border-b border-dashed border-stone-300 bg-stone-50/70 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-ink">
              <span class="flex items-center gap-2">
                <ChefHat class="h-4 w-4 text-sage-600" /> Receipt2Recipe
              </span>
              <span class="text-ink-muted">mise</span>
            </div>
            <Card.Header class="flex flex-col gap-2">
              <p class="text-xs uppercase tracking-[0.16em] text-ink-muted">
                Interactive receipt
              </p>
              <Card.Title class="font-display text-2xl text-ink"
                >Add ingredients to your run</Card.Title
              >
              <Card.Description class="text-ink-light">
                Tap to send items into the live cart on the left. Hover to see
                the highlight; click to confirm.
              </Card.Description>
            </Card.Header>
            <Card.Content class="space-y-2 pb-8">
              {#each ingredientList as ingredient}
                {@const isAdded = addedIngredients.has(ingredient.name)}
                <button
                  class={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${isAdded ? "border-emerald-200 bg-emerald-50/70" : "border-stone-200 bg-white/70 hover:border-sand hover:bg-stone-50"} ${flashIngredient === ingredient.name ? "flash-green" : ""}`}
                  onclick={() => toggleIngredient(ingredient.name)}
                >
                  <div class="font-mono text-sm">
                    <p class="font-medium text-ink">{ingredient.name}</p>
                    {#if ingredient.note}
                      <p class="text-[11px] text-ink-muted">{ingredient.note}</p>
                    {/if}
                  </div>
                  <span
                    class={`flex h-9 w-9 items-center justify-center rounded-full border transition ${isAdded ? "border-emerald-300 bg-emerald-100 text-emerald-700" : "border-sand bg-white text-ink hover:bg-green-100 hover:text-green-800"}`}
                  >
                    {#if isAdded}
                      <Check class="h-4 w-4" />
                    {:else}
                      <Plus class="h-4 w-4" />
                    {/if}
                  </span>
                </button>
              {/each}
            </Card.Content>
          </Card.Root>
        </div>

        <!-- Recipe Feed Masonry -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-xs uppercase tracking-[0.16em] text-ink-muted">
              The feed
            </p>
            <Button href="/recipes" variant="ghost" class="text-ink"
              >View all</Button
            >
          </div>
          <div
            class="columns-1 gap-6 md:columns-2 xl:columns-3 [column-fill:balance]"
          >
            {#if recipeFeed.length}
              {#each recipeFeed as recipe (recipe.id)}
                <a
                  href={`/recipes/${recipe.id}`}
                  class="mb-6 block break-inside-avoid overflow-hidden rounded-[28px] border border-sand bg-white shadow-[0_22px_60px_-48px_rgba(45,55,72,0.5)] transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <div class="relative aspect-4/5 overflow-hidden">
                    {#if recipe.imageUrl}
                      <img
                        src={recipe.imageUrl}
                        alt={recipe.title}
                        class="h-full w-full object-cover transition duration-500 hover:scale-105"
                      />
                    {:else}
                      <div
                        class="flex h-full w-full items-center justify-center bg-linear-to-br from-sage-50 to-sand"
                      >
                        <ChefHat class="h-8 w-8 text-sage-500" />
                      </div>
                    {/if}
                    <div
                      class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent"
                    ></div>
                    <div class="absolute bottom-0 left-0 right-0 p-5">
                      <h3 class="font-display text-xl text-white line-clamp-2">
                        {recipe.title}
                      </h3>
                      {#if recipe.description}
                        <p class="mt-1 text-sm text-white/80 line-clamp-2">
                          {recipe.description}
                        </p>
                      {/if}
                      <div
                        class="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/70"
                      >
                        <span class="rounded-full bg-white/20 px-2 py-1">
                          {recipe.servings} servings
                        </span>
                        {#if recipe.cuisineType}
                          <span class="rounded-full bg-white/20 px-2 py-1">
                            {recipe.cuisineType}
                          </span>
                        {/if}
                      </div>
                    </div>
                  </div>
                </a>
              {/each}
            {:else}
              <div
                class="mb-6 rounded-2xl border border-dashed border-sand bg-sage-50/60 p-6 text-center"
              >
                <p class="font-display text-xl text-ink">No recipes yet</p>
                <p class="font-hand text-sm text-ink-muted">
                  Upload a receipt to start your first spread.
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
