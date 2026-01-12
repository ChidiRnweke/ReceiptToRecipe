<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import {
    Receipt,
    ChefHat,
    ShoppingCart,
    ArrowRight,
    Plus,
    Clock,
    TrendingUp,
  } from "lucide-svelte";

  let { data } = $props();

  const workflowSteps = [
    {
      icon: Receipt,
      label: "Receipts",
      description: "Upload grocery receipts",
      count: data.metrics?.receipts ?? 0,
      href: "/receipts",
      actionHref: "/receipts/upload",
      actionLabel: "Upload receipt",
      emptyText: "Start by uploading a receipt",
    },
    {
      icon: ChefHat,
      label: "Recipes",
      description: "Generate AI recipes",
      count: data.metrics?.recipes ?? 0,
      href: "/recipes",
      actionHref: "/recipes/generate",
      actionLabel: "Generate recipe",
      emptyText: "Create your first recipe",
    },
    {
      icon: ShoppingCart,
      label: "Shopping",
      description: "Track what you need",
      count: data.metrics?.activeListItems ?? 0,
      href: "/shopping",
      actionHref: "/shopping",
      actionLabel: "View list",
      emptyText: "Your list is empty",
    },
  ];

  // Landing page content for unauthenticated users
  const flowchart = [
    {
      title: "Drop a receipt photo",
      copy: "Any store, any format. We'll tidy the lines, totals, and dates.",
      tag: "Start",
    },
    {
      title: "We map your pantry",
      copy: "Ingredients and quantities are normalized so you don't have to guess.",
      tag: "Organize",
    },
    {
      title: "Pick dinner fast",
      copy: "Recipes are filtered by your diet, calories, and serving size.",
      tag: "Cook",
    },
    {
      title: "Shop what's missing",
      copy: "Auto lists plus restock suggestions from your history and favorite recipes.",
      tag: "Finish",
    },
  ];
</script>

<svelte:head>
  <title>Receipt2Recipe - Transform Groceries into Meals</title>
</svelte:head>

{#if data.user}
  <!-- Authenticated Dashboard View -->
  <div class="space-y-8">
    <!-- Welcome Header -->
    <div>
      <p class="text-sm uppercase tracking-wide text-ink-muted">Welcome back</p>
      <h1
        class="font-serif text-3xl font-medium tracking-tight text-ink md:text-4xl"
      >
        What would you like to do?
      </h1>
    </div>

    <!-- Workflow Steps -->
    <div class="grid gap-4 md:grid-cols-3">
      {#each workflowSteps as step, i}
        <Card.Root
          class="group relative overflow-hidden border-sand bg-paper transition-shadow hover:shadow-md"
        >
          <!-- Step number indicator -->
          <div
            class="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-paper-dark text-xs font-semibold text-ink-muted"
          >
            {i + 1}
          </div>

          <Card.Header class="pb-2">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-xl bg-sage-100"
            >
              <step.icon class="h-6 w-6 text-sage-700" />
            </div>
            <Card.Title class="font-serif text-xl">{step.label}</Card.Title>
            <Card.Description>{step.description}</Card.Description>
          </Card.Header>

          <Card.Content class="space-y-4">
            <div class="flex items-baseline gap-2">
              <span class="text-3xl font-semibold text-ink">{step.count}</span>
              <span class="text-sm text-ink-muted">
                {step.count === 1
                  ? step.label.slice(0, -1).toLowerCase()
                  : step.label.toLowerCase()}
              </span>
            </div>

            <div class="flex gap-2">
              <Button href={step.actionHref} size="sm" class="flex-1">
                <Plus class="mr-1 h-4 w-4" />
                {step.actionLabel}
              </Button>
              {#if step.count > 0}
                <Button href={step.href} size="sm" variant="outline">
                  View
                </Button>
              {/if}
            </div>
          </Card.Content>

          <!-- Arrow connector (hidden on last item) -->
          {#if i < workflowSteps.length - 1}
            <div
              class="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 md:block"
            >
              <div
                class="flex h-6 w-6 items-center justify-center rounded-full bg-paper-dark"
              >
                <ArrowRight class="h-3 w-3 text-ink-muted" />
              </div>
            </div>
          {/if}
        </Card.Root>
      {/each}
    </div>

    <!-- Recent Activity Section -->
    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Recent Receipts -->
      <Card.Root class="border-sand bg-paper">
        <Card.Header class="flex flex-row items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <Receipt class="h-4 w-4 text-ink-muted" />
              Recent Receipts
            </Card.Title>
          </div>
          {#if data.recentReceipts?.length}
            <Button href="/receipts" variant="ghost" size="sm">
              View all <ArrowRight class="ml-1 h-3 w-3" />
            </Button>
          {/if}
        </Card.Header>
        <Card.Content>
          {#if data.recentReceipts?.length}
            <div class="space-y-3">
              {#each data.recentReceipts as receipt}
                <a
                  href="/receipts/{receipt.id}"
                  class="flex items-center justify-between rounded-lg border border-sand p-3 transition-colors hover:bg-paper-dark"
                >
                  <div>
                    <p class="font-medium text-ink">
                      {receipt.storeName || "Receipt"}
                    </p>
                    <p class="text-xs text-ink-light">
                      {new Date(receipt.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <Badge variant="outline" class="text-xs"
                      >{receipt.status}</Badge
                    >
                    <ArrowRight class="h-4 w-4 text-ink-muted" />
                  </div>
                </a>
              {/each}
            </div>
          {:else}
            <div
              class="flex flex-col items-center justify-center py-8 text-center"
            >
              <Receipt class="h-10 w-10 text-ink-muted" />
              <p class="mt-3 text-sm text-ink-light">No receipts yet</p>
              <Button href="/receipts/upload" size="sm" class="mt-3">
                Upload your first receipt
              </Button>
            </div>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- Recent Recipes -->
      <Card.Root class="border-sand bg-paper">
        <Card.Header class="flex flex-row items-center justify-between">
          <div>
            <Card.Title class="flex items-center gap-2">
              <ChefHat class="h-4 w-4 text-ink-muted" />
              Recent Recipes
            </Card.Title>
          </div>
          {#if data.recentRecipes?.length}
            <Button href="/recipes" variant="ghost" size="sm">
              View all <ArrowRight class="ml-1 h-3 w-3" />
            </Button>
          {/if}
        </Card.Header>
        <Card.Content>
          {#if data.recentRecipes?.length}
            <div class="space-y-3">
              {#each data.recentRecipes as recipe}
                <a
                  href="/recipes/{recipe.id}"
                  class="flex items-center justify-between rounded-lg border border-sand p-3 transition-colors hover:bg-paper-dark"
                >
                  <div>
                    <p class="font-serif font-medium text-ink">
                      {recipe.title}
                    </p>
                    <p class="text-xs text-ink-light">
                      {#if recipe.cuisineType}
                        {recipe.cuisineType} ·
                      {/if}
                      {recipe.servings} servings
                    </p>
                  </div>
                  <ArrowRight class="h-4 w-4 text-ink-muted" />
                </a>
              {/each}
            </div>
          {:else}
            <div
              class="flex flex-col items-center justify-center py-8 text-center"
            >
              <ChefHat class="h-10 w-10 text-ink-muted" />
              <p class="mt-3 text-sm text-ink-light">No recipes yet</p>
              <Button href="/recipes/generate" size="sm" class="mt-3">
                Generate your first recipe
              </Button>
            </div>
          {/if}
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Smart Suggestions -->
    {#if data.suggestions?.length}
      <Card.Root class="border-sand bg-paper">
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <TrendingUp class="h-4 w-4 text-ink-muted" />
            Restock Suggestions
          </Card.Title>
          <Card.Description>Based on your purchase history</Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="flex flex-wrap gap-2">
            {#each data.suggestions as suggestion}
              <div
                class="flex items-center gap-2 rounded-full border border-sand bg-paper-dark px-3 py-1.5"
              >
                <span class="text-sm font-medium text-ink"
                  >{suggestion.itemName}</span
                >
                <span class="text-xs text-ink-muted">
                  every {suggestion.avgFrequencyDays ?? "—"}d
                </span>
              </div>
            {/each}
          </div>
          <Button href="/shopping" variant="outline" size="sm" class="mt-4">
            <ShoppingCart class="mr-2 h-4 w-4" />
            Add to shopping list
          </Button>
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
{:else}
  <!-- Unauthenticated Landing Page -->
  <div class="flex flex-col items-center gap-16">
    <!-- Hero Section -->
    <section class="w-full">
      <div class="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:items-center">
        <div class="space-y-6">
          <div
            class="inline-flex items-center gap-2 rounded-full border border-sand bg-paper px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-muted"
          >
            <span class="h-2 w-2 rounded-full bg-sage-600"></span>
            From receipt to dinner
          </div>
          <h1
            class="font-serif text-4xl font-medium tracking-tight text-ink sm:text-5xl"
          >
            Turn grocery receipts into meals people crave
          </h1>
          <p class="text-lg text-ink-light">
            Upload a receipt, set your preferences, and get recipes, images, and
            a ready-to-shop list. No guessing what to cook with what you bought.
          </p>
          <div class="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" href="/register" class="w-full sm:w-auto"
              >Start with a receipt</Button
            >
            <Button
              size="lg"
              variant="outline"
              href="/login"
              class="w-full sm:w-auto"
            >
              See it in action
            </Button>
          </div>
        </div>

        <!-- Hero Mockup -->
        <div class="relative">
          <div
            class="absolute -left-6 -top-6 h-16 w-16 rounded-full bg-sage-100 blur-3xl"
          ></div>
          <div
            class="absolute -right-4 bottom-10 h-20 w-20 rounded-full bg-sienna-50 blur-3xl"
          ></div>
          <div
            class="relative overflow-hidden rounded-3xl border border-sand bg-paper shadow-[0_18px_45px_-35px_rgba(32,26,22,0.4)]"
          >
            <div
              class="grid gap-0 border-b border-sand bg-paper-dark/70 px-6 py-4 md:grid-cols-2 md:items-center"
            >
              <div>
                <p class="text-xs uppercase tracking-wide text-ink-muted">
                  Receipt
                </p>
                <p class="mt-1 font-serif text-xl text-ink">Sprouts Market</p>
                <p class="text-sm text-ink-light">Total $64.20 · Today</p>
              </div>
              <div class="flex justify-end">
                <Badge
                  variant="secondary"
                  class="rounded-full bg-sage-100 text-sage-600"
                  >Ready to use</Badge
                >
              </div>
            </div>
            <div class="grid gap-0 md:grid-cols-2">
              <div class="space-y-3 border-r border-sand p-6">
                <p class="text-xs uppercase tracking-wide text-ink-muted">
                  Ingredients pulled
                </p>
                <ul class="space-y-2 text-sm text-ink">
                  <li class="flex items-center justify-between">
                    <span>2x chicken thighs</span>
                    <span class="text-ink-muted">$8.12</span>
                  </li>
                  <li class="flex items-center justify-between">
                    <span>1 lb asparagus</span>
                    <span class="text-ink-muted">$3.80</span>
                  </li>
                  <li class="flex items-center justify-between">
                    <span>Yukon potatoes 1kg</span>
                    <span class="text-ink-muted">$4.10</span>
                  </li>
                  <li class="flex items-center justify-between">
                    <span>Garlic, lemon, olive oil</span>
                    <span class="text-ink-muted">$5.22</span>
                  </li>
                </ul>
              </div>
              <div class="space-y-3 p-6">
                <p class="text-xs uppercase tracking-wide text-ink-muted">
                  Recipe you'll see
                </p>
                <div class="rounded-2xl border border-sand bg-paper-dark p-4">
                  <p class="font-serif text-lg text-ink">
                    Roasted Lemon Garlic Chicken
                  </p>
                  <p class="text-sm text-ink-light">
                    With asparagus & crispy potatoes · 4 servings
                  </p>
                  <div class="mt-3 flex gap-2">
                    <Badge variant="outline">Gluten-free</Badge>
                    <Badge variant="outline">Ready in ~35 min</Badge>
                  </div>
                  <div
                    class="mt-4 h-28 rounded-xl bg-[radial-gradient(circle_at_30%_30%,#f5e8d8,#e7dec8_60%)]"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Flowchart -->
    <section class="w-full">
      <div class="mx-auto max-w-6xl space-y-6">
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-full bg-sage-100 text-sm font-semibold text-sage-700"
          >
            <span>→</span>
          </div>
          <div>
            <h2 class="font-serif text-3xl font-medium text-ink">
              What happens after you drop a receipt
            </h2>
            <p class="text-ink-light">A simple path—no jargon, no mystery.</p>
          </div>
        </div>
        <div class="grid gap-4 md:grid-cols-4">
          {#each flowchart as step, i}
            <div class="relative rounded-2xl border border-sand bg-paper p-5">
              <div
                class="mb-3 inline-flex items-center gap-2 rounded-full bg-paper-dark px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-muted"
              >
                <span
                  class="flex h-6 w-6 items-center justify-center rounded-full bg-sage-100 text-sage-700"
                  >{i + 1}</span
                >
                {step.tag}
              </div>
              <h3 class="font-serif text-xl text-ink">{step.title}</h3>
              <p class="mt-2 text-sm text-ink-light">{step.copy}</p>
              {#if i < flowchart.length - 1}
                <div
                  class="absolute right-[-12px] top-1/2 hidden h-px w-6 bg-sand md:block"
                ></div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="w-full">
      <div
        class="mx-auto max-w-5xl rounded-3xl border border-sand bg-paper p-8 text-center"
      >
        <p class="text-sm uppercase tracking-wide text-ink-muted">
          Get started
        </p>
        <h3 class="mt-2 font-serif text-3xl text-ink">
          A clear path: scan → cook → shop
        </h3>
        <p class="mt-3 text-lg text-ink-light">
          Start with one receipt. We'll keep your tastes, surface the right
          meals, and prep a list that explains itself.
        </p>
        <div
          class="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button size="lg" href="/register">Create your account</Button>
          <Button size="lg" variant="outline" href="/login">Log in</Button>
        </div>
      </div>
    </section>
  </div>
{/if}
