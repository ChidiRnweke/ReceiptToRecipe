<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import {
    Plus,
    Receipt,
    Clock,
    CheckCircle,
    XCircle,
    Loader2,
    Store,
    ShoppingBag,
    Sparkles,
    ArrowRight,
  } from "lucide-svelte";

  let { data } = $props();

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getRelativeTime(date: Date | string) {
    const now = new Date();
    const then = new Date(date);
    const diffDays = Math.floor(
      (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return formatDate(date);
  }

  function getStatusBadge(status: string) {
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
          label: "Processing",
        };
      case "QUEUED":
        return { variant: "outline" as const, icon: Clock, label: "Queued" };
      case "FAILED":
        return {
          variant: "destructive" as const,
          icon: XCircle,
          label: "Failed",
        };
      default:
        return { variant: "outline" as const, icon: Receipt, label: status };
    }
  }
</script>

<svelte:head>
  <title>Receipts - Receipt2Recipe</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div class="relative">
      <div
        class="absolute -left-4 -top-2 h-20 w-20 rounded-full bg-sage-100/50 blur-2xl"
      ></div>
      <p class="text-sm uppercase tracking-wide text-ink-muted">Step 1</p>
      <h1 class="font-serif text-3xl font-medium text-ink">Your Receipts</h1>
      <p class="mt-1 text-ink-light">
        {data.receipts.length === 0
          ? "Start your cooking journey here"
          : `${data.receipts.length} receipt${data.receipts.length === 1 ? "" : "s"} scanned and organized`}
      </p>
    </div>
    <Button href="/receipts/upload">
      <Plus class="mr-2 h-4 w-4" />
      Upload Receipt
    </Button>
  </div>

  {#if data.receipts.length === 0}
    <Card.Root class="relative overflow-hidden border-dashed py-16 text-center">
      <div
        class="absolute right-0 top-0 h-32 w-32 rounded-full bg-sage-50 blur-3xl"
      ></div>
      <Card.Content class="relative">
        <div class="relative mx-auto w-fit">
          <div
            class="flex h-20 w-20 items-center justify-center rounded-2xl bg-sage-50"
          >
            <Receipt class="h-10 w-10 text-sage-600" />
          </div>
          <Sparkles class="absolute -right-2 -top-2 h-6 w-6 text-sage-500" />
        </div>
        <h3 class="mt-6 font-serif text-2xl font-medium text-ink">
          Your pantry starts here
        </h3>
        <p class="mx-auto mt-2 max-w-md text-ink-light">
          Snap a photo of any grocery receipt. We'll extract the items, organize
          them, and unlock recipe ideas based on what you bought.
        </p>
        <div
          class="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <Button href="/receipts/upload" size="lg">
            <Plus class="mr-2 h-4 w-4" />
            Upload your first receipt
          </Button>
        </div>
        <p class="mt-4 text-xs text-ink-muted">
          Works with any store, any format
        </p>
      </Card.Content>
    </Card.Root>
  {:else}
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each data.receipts as receipt}
        {@const status = getStatusBadge(receipt.status)}
        <a href="/receipts/{receipt.id}" class="group">
          <Card.Root
            class="relative overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <!-- Subtle gradient accent -->
            <div
              class="absolute left-0 top-0 h-1 w-full bg-linear-to-r from-sage-400 to-sage-200 opacity-0 transition-opacity group-hover:opacity-100"
            ></div>

            <Card.Header
              class="flex-row items-start justify-between space-y-0 pb-2"
            >
              <div class="flex items-start gap-3">
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-paper-dark"
                >
                  <Store class="h-5 w-5 text-ink-muted" />
                </div>
                <div>
                  <Card.Title class="font-serif text-lg">
                    {receipt.storeName || "Unknown Store"}
                  </Card.Title>
                  <Card.Description class="text-xs">
                    {getRelativeTime(receipt.createdAt)}
                  </Card.Description>
                </div>
              </div>
              <Badge variant={status.variant}>
                {#if status.icon === Loader2}
                  <status.icon class="mr-1 h-3 w-3 animate-spin" />
                {:else}
                  <status.icon class="mr-1 h-3 w-3" />
                {/if}
                {status.label}
              </Badge>
            </Card.Header>
            <Card.Content class="pt-2">
              <div class="flex items-end justify-between">
                {#if receipt.totalAmount}
                  <div>
                    <p class="text-xs uppercase tracking-wide text-ink-muted">
                      Total
                    </p>
                    <p class="text-2xl font-semibold text-ink">
                      ${parseFloat(receipt.totalAmount).toFixed(2)}
                    </p>
                  </div>
                {:else}
                  <div>
                    <p class="text-sm text-ink-muted italic">Amount pending</p>
                  </div>
                {/if}
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-full bg-paper-dark opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <ArrowRight class="h-4 w-4 text-ink-muted" />
                </div>
              </div>
            </Card.Content>
          </Card.Root>
        </a>
      {/each}
    </div>
  {/if}
</div>
