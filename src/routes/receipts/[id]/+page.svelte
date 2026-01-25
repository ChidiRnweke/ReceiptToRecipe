<script lang="ts">
  import { onMount } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Input } from "$lib/components/ui/input";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import {
    ArrowLeft,
    ChefHat,
    ShoppingCart,
    CheckCircle,
    XCircle,
    Loader2,
    Clock,
    X,
    Sparkles,
    Receipt,
    ImageIcon,
    Store,
    Package,
    AlertCircle,
    ArrowRight,
  } from "lucide-svelte";

  let { data } = $props();

  const generatedRecipes = $derived(data.generatedRecipes ?? []);

  let pollingInterval: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    // Poll for status updates if processing
    if (
      data.receipt.status === "QUEUED" ||
      data.receipt.status === "PROCESSING"
    ) {
      pollingInterval = setInterval(async () => {
        await invalidateAll();
        if (
          data.receipt.status === "DONE" ||
          data.receipt.status === "FAILED"
        ) {
          if (pollingInterval) clearInterval(pollingInterval);
        }
      }, 2000);
    }

    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  });

  function formatDate(date: Date | string | null) {
    if (!date) return "Unknown";
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function getStatusInfo(status: string) {
    switch (status) {
      case "DONE":
        return {
          variant: "secondary" as const,
          icon: CheckCircle,
          label: "Processed",
        };
      case "PROCESSING":
        return {
          variant: "secondary" as const,
          icon: Loader2,
          label: "Processing...",
        };
      case "QUEUED":
        return { variant: "outline" as const, icon: Clock, label: "In Queue" };
      case "FAILED":
        return {
          variant: "destructive" as const,
          icon: XCircle,
          label: "Failed",
        };
      default:
        return { variant: "outline" as const, icon: Clock, label: status };
    }
  }

  const status = $derived(getStatusInfo(data.receipt.status));
</script>

<svelte:head>
  <title>{data.receipt.storeName || "Receipt"} - Receipt2Recipe</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center gap-4">
    <Button variant="ghost" size="icon" href="/receipts">
      <ArrowLeft class="h-5 w-5" />
    </Button>
    <div class="flex-1">
      <div class="flex items-center gap-3">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-xl bg-sage-100"
        >
          <Store class="h-6 w-6 text-sage-600" />
        </div>
        <div>
          <h1 class="font-serif text-2xl font-medium text-ink md:text-3xl">
            {data.receipt.storeName || "Receipt Details"}
          </h1>
          <p class="text-sm text-ink-light">
            {formatDate(data.receipt.purchaseDate)}
          </p>
        </div>
      </div>
    </div>
    <Badge variant={status.variant} class="hidden sm:flex">
      {#if status.icon === Loader2}
        <status.icon class="mr-1 h-3 w-3 animate-spin" />
      {:else}
        <status.icon class="mr-1 h-3 w-3" />
      {/if}
      {status.label}
    </Badge>
  </div>

  {#if data.receipt.status === "PROCESSING" || data.receipt.status === "QUEUED"}
    <Card.Root class="overflow-hidden">
      <div class="h-1 w-full bg-sage-100">
        <div
          class="h-full w-1/2 animate-pulse bg-linear-to-r from-sage-400 to-sage-500"
        ></div>
      </div>
      <Card.Content class="py-16 text-center">
        <div class="relative mx-auto w-fit">
          <div
            class="flex h-20 w-20 items-center justify-center rounded-2xl bg-sage-100"
          >
            <Receipt class="h-10 w-10 text-sage-600" />
          </div>
          <div
            class="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-paper shadow-md"
          >
            <Loader2 class="h-4 w-4 animate-spin text-sage-600" />
          </div>
        </div>
        <h3 class="mt-6 font-serif text-2xl font-medium text-ink">
          {data.receipt.status === "QUEUED"
            ? "In the queue..."
            : "Reading your receipt..."}
        </h3>
        <p class="mt-2 text-ink-light">
          {data.receipt.status === "QUEUED"
            ? "Your receipt will be processed shortly"
            : "Extracting items and prices. This takes 10-30 seconds."}
        </p>
        <div
          class="mx-auto mt-6 flex max-w-xs justify-center gap-8 text-center"
        >
          <div>
            <div
              class="flex h-8 w-8 items-center justify-center rounded-full bg-sage-500 text-paper mx-auto"
            >
              <CheckCircle class="h-4 w-4" />
            </div>
            <p class="mt-2 text-xs text-ink-muted">Uploaded</p>
          </div>
          <div class="h-8 w-px bg-sand self-start mt-4"></div>
          <div>
            <div
              class="flex h-8 w-8 items-center justify-center rounded-full bg-sage-100 mx-auto"
            >
              <Sparkles class="h-4 w-4 animate-pulse text-sage-600" />
            </div>
            <p class="mt-2 text-xs text-sage-600 font-medium">Scanning</p>
          </div>
          <div class="h-8 w-px bg-sand self-start mt-4"></div>
          <div>
            <div
              class="flex h-8 w-8 items-center justify-center rounded-full bg-paper-dark mx-auto"
            >
              <ChefHat class="h-4 w-4 text-ink-muted" />
            </div>
            <p class="mt-2 text-xs text-ink-muted">Ready</p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  {:else if data.receipt.status === "FAILED"}
    <Card.Root
      class="border-sienna-200 bg-linear-to-br from-sienna-50 to-paper"
    >
      <Card.Content class="py-12 text-center">
        <div class="relative mx-auto w-fit">
          <div
            class="flex h-16 w-16 items-center justify-center rounded-2xl bg-sienna-100"
          >
            <Receipt class="h-8 w-8 text-sienna-600" />
          </div>
          <div
            class="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-sienna-500 text-paper"
          >
            <AlertCircle class="h-3 w-3" />
          </div>
        </div>
        <h3 class="mt-6 font-serif text-2xl font-medium text-ink">
          Oops, something went wrong
        </h3>
        <p class="mx-auto mt-2 max-w-md text-ink-light">
          {data.receipt.errorMessage ||
            "We couldn't read this receipt. The image might be blurry or the format unsupported."}
        </p>
        <div
          class="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <Button href="/receipts/upload">
            <Receipt class="mr-2 h-4 w-4" />
            Try another receipt
          </Button>
          <Button variant="outline" href="/receipts">Back to receipts</Button>
        </div>
      </Card.Content>
    </Card.Root>
  {:else}
    <div class="grid gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2 space-y-6">
        <!-- Items List -->
        <Card.Root>
          <Card.Header class="flex items-center justify-between">
            <div>
              <Card.Title>Items ({data.receipt.items?.length || 0})</Card.Title>
              <p class="text-sm text-ink-light">
                Tap to edit or add missing lines
              </p>
            </div>
            <form
              method="POST"
              action="?/addItem"
              use:enhance={() => {}}
              class="flex gap-2"
            >
              <input type="hidden" name="name" value="New item" />
              <input type="hidden" name="quantity" value="1" />
              <Button type="submit" variant="outline" size="sm"
                >Quick add</Button
              >
            </form>
          </Card.Header>
          <Card.Content>
            {#if data.receipt.items && data.receipt.items.length > 0}
              <div class="divide-y divide-sand">
                {#each data.receipt.items as item}
                  <div class="space-y-2 py-3">
                    <form
                      method="POST"
                      action="?/updateItem"
                      use:enhance={() => {}}
                      class="grid gap-3 md:grid-cols-5 md:items-center"
                    >
                      <input type="hidden" name="itemId" value={item.id} />
                      <div class="md:col-span-2 space-y-1">
                        <label
                          for={`name-${item.id}`}
                          class="text-xs uppercase tracking-wide text-ink-muted"
                          >Name</label
                        >
                        <Input
                          id={`name-${item.id}`}
                          name="name"
                          value={item.rawName}
                        />
                      </div>
                      <div class="space-y-1">
                        <label
                          for={`qty-${item.id}`}
                          class="text-xs uppercase tracking-wide text-ink-muted"
                          >Qty</label
                        >
                        <Input
                          id={`qty-${item.id}`}
                          name="quantity"
                          value={item.quantity}
                        />
                      </div>
                      <div class="space-y-1">
                        <label
                          for={`unit-${item.id}`}
                          class="text-xs uppercase tracking-wide text-ink-muted"
                          >Unit</label
                        >
                        <Input
                          id={`unit-${item.id}`}
                          name="unit"
                          value={item.unit}
                        />
                      </div>
                      <div class="space-y-1">
                        <label
                          for={`price-${item.id}`}
                          class="text-xs uppercase tracking-wide text-ink-muted"
                          >Price</label
                        >
                        <Input
                          id={`price-${item.id}`}
                          name="price"
                          value={item.price ?? ""}
                        />
                      </div>
                      <div class="space-y-1 md:col-span-4">
                        <label
                          for={`category-${item.id}`}
                          class="text-xs uppercase tracking-wide text-ink-muted"
                          >Category</label
                        >
                        <Input
                          id={`category-${item.id}`}
                          name="category"
                          value={item.category ?? ""}
                        />
                      </div>
                      <div class="flex items-center gap-2 md:col-span-1">
                        <Button type="submit" size="sm" variant="outline"
                          >Save</Button
                        >
                      </div>
                    </form>
                    <form
                      method="POST"
                      action="?/deleteItem"
                      use:enhance={() => {}}
                      class="flex justify-end"
                    >
                      <input type="hidden" name="itemId" value={item.id} />
                      <Button
                        type="submit"
                        size="icon"
                        variant="ghost"
                        class="text-ink-muted hover:text-sienna-600"
                      >
                        <X class="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="py-8 text-center">
                <Package class="mx-auto h-10 w-10 text-ink-muted" />
                <p class="mt-3 font-serif text-lg text-ink">
                  No items extracted yet
                </p>
                <p class="mt-1 text-sm text-ink-light">
                  Use "Quick add" above to manually add items
                </p>
              </div>
            {/if}
          </Card.Content>
        </Card.Root>

        <!-- Actions -->
        <div class="flex gap-3">
          <Button
            href="/recipes/generate?receipt={data.receipt.id}"
            class="flex-1"
          >
            <ChefHat class="mr-2 h-4 w-4" />
            Generate Recipe
          </Button>
          {#if data.receipt.status === "DONE"}
            <form
              method="POST"
              action="?/addToShopping"
              use:enhance={() => {}}
              class="flex-1"
            >
              <Button type="submit" variant="outline" class="w-full">
                <ShoppingCart class="mr-2 h-4 w-4" />
                Add to Shopping List
              </Button>
            </form>
          {/if}
        </div>

        <!-- Recipes from this receipt -->
        <Card.Root class="mt-6">
          <Card.Header>
            <div class="flex items-center justify-between">
              <div>
                <Card.Title class="flex items-center gap-2">
                  <Sparkles class="h-5 w-5 text-sage-500" />
                  Recipes from this Receipt
                </Card.Title>
                <Card.Description>
                  {generatedRecipes.length === 0
                    ? "No recipes generated yet"
                    : `${generatedRecipes.length} recipe${generatedRecipes.length === 1 ? "" : "s"} created`}
                </Card.Description>
              </div>
            </div>
          </Card.Header>
          <Card.Content>
            {#if generatedRecipes.length > 0}
              <div class="space-y-3">
                {#each generatedRecipes as recipe}
                  <a
                    href="/recipes/{recipe.id}"
                    class="group flex items-center gap-4 rounded-lg border border-sand p-3 transition-all hover:border-sage-300 hover:bg-sage-50/50"
                  >
                    {#if recipe.imageUrl}
                      <img
                        src={recipe.imageUrl}
                        alt={recipe.title}
                        class="h-16 w-16 rounded-lg object-cover"
                      />
                    {:else}
                      <div class="flex h-16 w-16 items-center justify-center rounded-lg bg-sage-100">
                        <ChefHat class="h-6 w-6 text-sage-400" />
                      </div>
                    {/if}
                    <div class="flex-1 min-w-0">
                      <h4 class="font-serif text-lg font-medium text-ink truncate group-hover:text-sage-700">
                        {recipe.title}
                      </h4>
                      <div class="flex items-center gap-3 text-xs text-ink-muted mt-1">
                        <span>{recipe.servings} servings</span>
                        {#if recipe.cuisineType}
                          <Badge variant="outline" class="text-xs">{recipe.cuisineType}</Badge>
                        {/if}
                      </div>
                    </div>
                    <ArrowRight class="h-4 w-4 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  </a>
                {/each}
              </div>
            {:else}
              <div class="py-6 text-center">
                <ChefHat class="mx-auto h-10 w-10 text-ink-muted" />
                <p class="mt-3 font-serif text-lg text-ink">Ready to cook?</p>
                <p class="mt-1 text-sm text-ink-light">
                  Generate a recipe using ingredients from this receipt
                </p>
                <Button
                  href="/recipes/generate?receipt={data.receipt.id}"
                  class="mt-4"
                >
                  <Sparkles class="mr-2 h-4 w-4" />
                  Generate Recipe
                </Button>
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Receipt Image -->
      <div class="space-y-4">
        {#if data.receipt.totalAmount}
          <Card.Root class="bg-linear-to-br from-sage-50 to-paper">
            <Card.Content class="pt-6">
              <div class="text-center">
                <p class="text-xs uppercase tracking-wide text-ink-muted">
                  Receipt Total
                </p>
                <p class="mt-1 font-serif text-4xl font-semibold text-ink">
                  ${parseFloat(data.receipt.totalAmount).toFixed(2)}
                </p>
                {#if data.receipt.items?.length}
                  <p class="mt-2 text-sm text-ink-light">
                    {data.receipt.items.length} item{data.receipt.items
                      .length === 1
                      ? ""
                      : "s"} found
                  </p>
                {/if}
              </div>
            </Card.Content>
          </Card.Root>
        {/if}

        <Card.Root class="overflow-hidden">
          <Card.Header class="pb-2">
            <Card.Title class="flex items-center gap-2 text-sm">
              <ImageIcon class="h-4 w-4 text-ink-muted" />
              Original Receipt
            </Card.Title>
          </Card.Header>
          <Card.Content class="p-0">
            <div class="relative">
              <div
                class="absolute inset-0 bg-linear-to-t from-ink/5 to-transparent pointer-events-none"
              ></div>
              <img
                src={data.receipt.imageUrl}
                alt="Receipt from {data.receipt.storeName || 'store'}"
                class="w-full"
              />
            </div>
          </Card.Content>
        </Card.Root>
      </div>
    </div>
  {/if}
</div>
