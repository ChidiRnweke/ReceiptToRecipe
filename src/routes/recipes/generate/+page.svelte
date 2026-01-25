<script lang="ts">
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import {
    ChefHat,
    Plus,
    X,
    Sparkles,
    ArrowLeft,
    Receipt,
    UtensilsCrossed,
    Users,
    Globe,
  } from "lucide-svelte";

  let { data, form } = $props();
  let loading = $state(false);
  let customIngredients = $state<string[]>([]);
  let newIngredient = $state("");
  let selectedReceiptItems = $state<Set<string>>(new Set());
  // Track which receipt each item comes from to determine primary source
  let itemToReceiptMap = $state<Map<string, string>>(new Map());
  // Initialize servings from preferences - this intentionally captures the initial value
  // as the user can modify it independently via the input field
  let servings = $derived(data.preferences?.defaultServings ?? 2);
  let cuisineHint = $state("");

  // Determine the primary source receipt (the one with most selected items)
  const sourceReceiptId = $derived.by(() => {
    if (selectedReceiptItems.size === 0) return null;
    const receiptCounts = new Map<string, number>();
    for (const itemId of selectedReceiptItems) {
      const receiptId = itemToReceiptMap.get(itemId);
      if (receiptId) {
        receiptCounts.set(receiptId, (receiptCounts.get(receiptId) || 0) + 1);
      }
    }
    let maxReceiptId: string | null = null;
    let maxCount = 0;
    for (const [receiptId, count] of receiptCounts) {
      if (count > maxCount) {
        maxCount = count;
        maxReceiptId = receiptId;
      }
    }
    return maxReceiptId;
  });

  // Build the item-to-receipt map on mount
  $effect(() => {
    const newMap = new Map<string, string>();
    for (const receipt of data.recentReceipts || []) {
      for (const item of receipt.items || []) {
        newMap.set(item.id, receipt.id);
      }
    }
    itemToReceiptMap = newMap;
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

  function toggleReceiptItem(itemId: string) {
    if (selectedReceiptItems.has(itemId)) {
      selectedReceiptItems.delete(itemId);
    } else {
      selectedReceiptItems.add(itemId);
    }
    selectedReceiptItems = new Set(selectedReceiptItems);
  }
</script>

<svelte:head>
  <title>Generate Recipe - Receipt2Recipe</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
  <div>
    <Button href="/recipes" variant="ghost" size="sm" class="-ml-2 mb-2">
      <ArrowLeft class="mr-1 h-4 w-4" />
      Back to recipes
    </Button>
    <div class="relative">
      <div
        class="absolute -left-4 -top-2 h-20 w-20 rounded-full bg-sage-100/50 blur-2xl"
      ></div>
      <div class="flex items-center gap-3">
        <div
          class="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-100"
        >
          <Sparkles class="h-7 w-7 text-sage-600" />
        </div>
        <div>
          <h1 class="font-serif text-3xl font-medium text-ink">
            Generate Recipe
          </h1>
          <p class="text-ink-light">
            Tell us what you have, we'll tell you what to make
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Selection Summary -->
  {#if selectedReceiptItems.size > 0 || customIngredients.length > 0}
    <div
      class="flex items-center gap-3 rounded-xl border border-sage-200 bg-sage-50 p-4"
    >
      <ChefHat class="h-5 w-5 text-sage-600" />
      <p class="text-sm text-ink">
        <span class="font-medium"
          >{selectedReceiptItems.size + customIngredients.length} ingredients</span
        > selected for your recipe
      </p>
    </div>
  {/if}

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
    class="space-y-6"
  >
    {#if form?.error}
      <div class="rounded-lg bg-sienna-50 p-3 text-sm text-sienna-700">
        {form.error}
      </div>
    {/if}

    <!-- Receipt Items Selection -->
    {#if data.recentReceipts && data.recentReceipts.length > 0}
      <Card.Root>
        <Card.Header>
          <div class="flex items-center gap-2">
            <Receipt class="h-5 w-5 text-ink-muted" />
            <Card.Title>From Your Receipts</Card.Title>
          </div>
          <Card.Description>Tap ingredients you want to use</Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="space-y-6">
            {#each data.recentReceipts as receipt}
              {#if receipt.items && receipt.items.length > 0}
                <div>
                  <div class="mb-3 flex items-center gap-2">
                    <div class="h-px flex-1 bg-sand"></div>
                    <p
                      class="text-xs font-medium uppercase tracking-wide text-ink-muted"
                    >
                      {receipt.storeName || "Unknown Store"}
                    </p>
                    <div class="h-px flex-1 bg-sand"></div>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    {#each receipt.items as item}
                      <button
                        type="button"
                        onclick={() => toggleReceiptItem(item.id)}
                        class="rounded-full border px-3 py-1.5 text-sm transition-all {selectedReceiptItems.has(
                          item.id,
                        )
                          ? 'border-sage-500 bg-sage-100 text-sage-700 shadow-sm'
                          : 'border-sand bg-paper hover:border-sage-400 hover:bg-sage-50'}"
                      >
                        {#if selectedReceiptItems.has(item.id)}
                          <span class="mr-1">+</span>
                        {/if}
                        {item.normalizedName}
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
          <input
            type="hidden"
            name="ingredientIds"
            value={Array.from(selectedReceiptItems).join(",")}
          />
          {#if sourceReceiptId}
            <input
              type="hidden"
              name="sourceReceiptId"
              value={sourceReceiptId}
            />
          {/if}
        </Card.Content>
      </Card.Root>
    {:else}
      <Card.Root class="border-dashed">
        <Card.Content class="py-8 text-center">
          <Receipt class="mx-auto h-10 w-10 text-ink-muted" />
          <p class="mt-3 font-serif text-lg text-ink">No receipts found</p>
          <p class="mt-1 text-sm text-ink-light">
            Upload a receipt first, or add custom ingredients below
          </p>
          <Button
            href="/receipts/upload"
            variant="outline"
            size="sm"
            class="mt-4"
          >
            Upload a receipt
          </Button>
        </Card.Content>
      </Card.Root>
    {/if}

    <!-- Custom Ingredients -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center gap-2">
          <UtensilsCrossed class="h-5 w-5 text-ink-muted" />
          <Card.Title>Add Custom Ingredients</Card.Title>
        </div>
        <Card.Description
          >Got more in the pantry? Add them here</Card.Description
        >
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="flex gap-2">
          <Input
            type="text"
            placeholder="e.g., garlic, olive oil, onion..."
            bind:value={newIngredient}
            onkeydown={(e) =>
              e.key === "Enter" && (e.preventDefault(), addIngredient())}
            class="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onclick={addIngredient}
            disabled={!newIngredient.trim()}
          >
            <Plus class="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>

        {#if customIngredients.length > 0}
          <div class="flex flex-wrap gap-2">
            {#each customIngredients as ingredient, i}
              <span
                class="group flex items-center gap-1.5 rounded-full border border-sage-500 bg-sage-100 px-3 py-1.5 text-sm text-sage-700"
              >
                {ingredient}
                <button
                  type="button"
                  onclick={() => removeIngredient(i)}
                  class="rounded-full p-0.5 hover:bg-sage-200"
                >
                  <X class="h-3 w-3" />
                </button>
              </span>
            {/each}
          </div>
        {:else}
          <p class="text-center text-sm text-ink-muted">
            Press Enter or click Add to include an ingredient
          </p>
        {/if}
        <input
          type="hidden"
          name="customIngredients"
          value={customIngredients.join(",")}
        />
      </Card.Content>
    </Card.Root>

    <!-- Options -->
    <Card.Root>
      <Card.Header>
        <Card.Title>Recipe Options</Card.Title>
        <Card.Description>Customize your recipe preferences</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="grid gap-6 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="servings" class="flex items-center gap-2">
              <Users class="h-4 w-4 text-ink-muted" />
              Servings
            </Label>
            <Input
              id="servings"
              name="servings"
              type="number"
              min="1"
              max="20"
              bind:value={servings}
            />
            <p class="text-xs text-ink-muted">How many people are eating?</p>
          </div>
          <div class="space-y-2">
            <Label for="cuisineHint" class="flex items-center gap-2">
              <Globe class="h-4 w-4 text-ink-muted" />
              Cuisine Style
            </Label>
            <Input
              id="cuisineHint"
              name="cuisineHint"
              type="text"
              placeholder="e.g., Italian, Mexican, Asian..."
              bind:value={cuisineHint}
            />
            <p class="text-xs text-ink-muted">
              Optional: guide the flavor profile
            </p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Submit -->
    <Card.Root class="bg-linear-to-r from-sage-50 to-paper">
      <Card.Content class="py-6">
        <div
          class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p class="font-serif text-lg font-medium text-ink">
              Ready to cook?
            </p>
            <p class="text-sm text-ink-light">
              {#if selectedReceiptItems.size === 0 && customIngredients.length === 0}
                Select at least one ingredient to get started
              {:else}
                We'll create a custom recipe just for you
              {/if}
            </p>
          </div>
          <div class="flex gap-3">
            <Button type="button" variant="outline" href="/recipes"
              >Cancel</Button
            >
            <Button
              type="submit"
              disabled={loading ||
                (selectedReceiptItems.size === 0 &&
                  customIngredients.length === 0)}
              size="lg"
            >
              {#if loading}
                <Sparkles class="mr-2 h-4 w-4 animate-pulse" />
                Creating magic...
              {:else}
                <Sparkles class="mr-2 h-4 w-4" />
                Generate Recipe
              {/if}
            </Button>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  </form>
</div>
