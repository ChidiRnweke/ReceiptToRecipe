<script lang="ts">
  import { enhance } from "$app/forms";
  import { formatCurrency } from "$lib/utils";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
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
    ChefHat,
    ShoppingCart,
    Filter,
    Search,
    FileText,
    Trash2,
    Archive,
    Check,
    Lightbulb,
  } from "lucide-svelte";
  import WashiTape from "$lib/components/WashiTape.svelte";
  import PinnedNote from "$lib/components/PinnedNote.svelte";
  import Notepad from "$lib/components/Notepad.svelte";

  let { data } = $props();
  let addingToShoppingId = $state<string | null>(null);

  // Dialog state
  let deleteDialogOpen = $state(false);
  let receiptToDelete = $state<string | null>(null);
  let isDeleting = $state(false);

  function confirmDelete(id: string) {
    receiptToDelete = id;
    deleteDialogOpen = true;
  }

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
    return formatDate(date);
  }

  const tips = [
    "Scan receipts to update your pantry instantly.",
    "Review scanned items to ensure accuracy before cooking.",
    "Recipes are generated based on available ingredients in your receipts.",
    "Track your spending habits over time with digital archives.",
    "Categorize your grocery hauls to optimize your shopping list.",
  ];
  const randomTip = tips[Math.floor(Math.random() * tips.length)];
</script>

<svelte:head>
  <title>Receipts - Ledger</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-4rem)] -mx-4 md:-mx-8">
  <!-- Ledger Main Content -->
  <main class="flex-1 bg-[#FDFBF7] p-6 md:p-10 relative overflow-y-auto">
    <!-- Desk Texture Overlay -->
    <div
      class="pointer-events-none absolute inset-0 opacity-[0.03]"
      style="background-image: url('https://www.transparenttextures.com/patterns/cardboard-flat.png')"
    ></div>

    <div class="mx-auto max-w-5xl space-y-8 relative z-10">
      <!-- Header Action -->
      <div
        class="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-sand pb-6"
      >
        <div>
          <h1
            class="font-display text-4xl leading-[1.1] text-ink drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]"
          >
            Track your <span class="marker-highlight">kitchen inventory</span>.
          </h1>
          <p class="text-ink-muted font-mono text-sm mt-2">
            Verify scans and manage your culinary assets.
          </p>
        </div>

        <div class="flex items-center gap-4 self-start md:self-end">
          <!-- Compact Tip -->
          <div class="hidden lg:block">
            <PinnedNote
              color="red"
              rotate="-rotate-2"
              class="max-w-[200px] text-xs"
            >
              <div class="flex flex-col gap-1 p-1">
                <span class="font-bold text-ink/80 flex items-center gap-2"
                  ><Lightbulb class="h-3 w-3 text-amber-600" /> Quick Tip</span
                >
                <p class="italic leading-snug text-ink/60">"{randomTip}"</p>
              </div>
            </PinnedNote>
          </div>

          <Button
            href="/receipts/upload"
            class="group relative h-11 overflow-hidden rounded-lg border border-sage-300 bg-white px-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sage-400 hover:bg-[#fafaf9] hover:shadow-md active:scale-95"
          >
            <div class="flex items-center gap-2">
              <Plus class="h-4 w-4 text-sage-600 transition-transform duration-500 group-hover:rotate-90 group-hover:text-sage-700" />
              <span class="font-display text-base font-medium text-ink">Archive New Entry</span>
            </div>
          </Button>
        </div>
      </div>

      {#if data.receipts.length === 0}
        <div
          class="flex flex-col items-center justify-center py-24 text-center"
        >
          <Receipt class="h-16 w-16 text-sage-200 mb-6" />
          <h3 class="font-serif text-2xl text-ink">Your ledger is empty</h3>
          <p class="text-ink-light mt-2 max-w-xs mx-auto font-medium">
            Start by adding your first receipt to track your kitchen inventory.
          </p>
        </div>
      {:else}
        <Notepad
          class="w-full bg-amber-50/50 border border-amber-100/50"
          showTape={false}
        >
          <div class="flex flex-col">
            {#each data.receipts as receipt}
              <!-- 
                    Row Structure
                -->
              <a
                href="/receipts/{receipt.id}"
                class="group relative block bg-white border-b border-dashed border-stone-200 hover:bg-[#fffdf5] transition-colors duration-200 last:border-0"
              >
                <div class="flex items-center gap-6 py-5 px-6">
                  <!-- Notebook Margin Line -->
                  <div
                    class="absolute left-6 top-0 bottom-0 w-px bg-red-300/40"
                  ></div>

                  <!-- 1. Merchant Block -->
                  <div class="w-1/3 min-w-[240px] pl-6">
                    <div class="flex items-center gap-3">
                      <div
                        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 border border-amber-200 group-hover:bg-amber-50 transition-colors"
                      >
                        <Store class="h-5 w-5 text-amber-700" />
                      </div>
                      <div>
                        <h3
                          class="font-serif text-xl font-bold text-ink truncate group-hover:text-amber-700 transition-colors"
                        >
                          {receipt.storeName || "Unknown Merchant"}
                        </h3>
                        <div class="flex items-center gap-2 mt-1">
                          <!-- Barcode lines -->
                          <div class="flex gap-px h-3 opacity-30">
                            {#each Array(8) as _}
                              <div class="w-px bg-black"></div>
                              <div class="w-0.5 bg-transparent"></div>
                            {/each}
                          </div>
                          <p class="text-xs text-ink-muted font-mono">
                            {(receipt as any).items?.length || 0} items scanned
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 2. Financials -->
                  <div class="w-32 shrink-0">
                    {#if receipt.totalAmount}
                      <div
                        class="font-mono text-lg font-bold text-ink-dark opacity-90 tracking-tight transform -rotate-1 bg-[#fffdf5] group-hover:bg-white group-hover:scale-105 transition-all px-2 py-1 rounded inline-block border border-stone-200/50 shadow-sm"
                      >
                        {formatCurrency(
                          receipt.totalAmount!,
                          receipt.currency || "EUR",
                        )}
                      </div>
                    {:else}
                      <span class="text-sm text-ink-muted italic"
                        >Processing...</span
                      >
                    {/if}
                  </div>

                  <!-- 3. The Launchpad (Focus) -->
                  <div class="flex-1 flex items-center justify-end gap-4">
                    {#if receipt.status === "DONE"}
                      <!-- Generate Button (Editorial Style) -->
                      <Button
                        href="/recipes/generate?receipt={receipt.id}"
                        class="group relative h-8 overflow-hidden rounded-md border border-sage-300 bg-white px-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sage-400 hover:bg-[#fafaf9] hover:shadow-md active:scale-95 relative z-10"
                        onclick={(e: MouseEvent) => e.stopPropagation()}
                      >
                        <div class="flex items-center gap-2">
                          <ChefHat class="h-3.5 w-3.5 text-sage-600 transition-transform duration-500 group-hover:scale-110 group-hover:text-sage-700" />
                          <span class="font-display text-xs font-medium text-ink">Generate Recipes</span>
                        </div>
                      </Button>

                      <!-- Verified Stamp (Green) -->
                      <div
                        class="hidden sm:flex items-center justify-center p-1 border-2 border-emerald-500/30 text-emerald-600/60 rounded-sm rotate-[-8deg] select-none pointer-events-none"
                      >
                        <span
                          class="text-[10px] font-bold uppercase tracking-widest leading-none"
                          >Verified</span
                        >
                      </div>
                    {:else}
                      <!-- Status Badge (Amber/Yellow for Processing) -->
                      <div
                        class="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-sm text-xs font-mono uppercase tracking-wider flex items-center gap-2"
                      >
                        {#if receipt.status === "PROCESSING"}
                          <Loader2 class="h-3 w-3 animate-spin" />
                        {/if}
                        {receipt.status}
                      </div>
                    {/if}
                  </div>

                  <!-- 4. Actions -->
                  <div class="flex items-center pl-2 border-l border-stone-100">
                    <button 
                        type="button"
                        class="h-8 w-8 flex items-center justify-center rounded-md text-stone-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                        onclick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            confirmDelete(receipt.id);
                        }}
                    >
                        {#if isDeleting && receiptToDelete === receipt.id}
                            <Loader2 class="h-4 w-4 animate-spin" />
                        {:else}
                            <Trash2 class="h-4 w-4" />
                        {/if}
                    </button>
                  </div>
                </div>
              </a>
            {/each}
          </div>
        </Notepad>
      {/if}
    </div>
  </main>

  <AlertDialog.Root bind:open={deleteDialogOpen}>
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>Delete Receipt?</AlertDialog.Title>
        <AlertDialog.Description>
          This will permanently delete this receipt and all its associated items from your ledger. This action cannot be undone.
        </AlertDialog.Description>
      </AlertDialog.Header>
      <AlertDialog.Footer>
        <AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
        <form
            method="POST"
            action="?/delete"
            use:enhance={() => {
                isDeleting = true;
                return async ({ update }) => {
                    isDeleting = false;
                    deleteDialogOpen = false;
                    await update();
                };
            }}
            class="inline-block"
        >
            <input type="hidden" name="id" value={receiptToDelete} />
            <AlertDialog.Action type="submit" class="bg-red-600 hover:bg-red-700 text-white" disabled={isDeleting}>
                {#if isDeleting}
                    <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                {:else}
                    Delete Receipt
                {/if}
            </AlertDialog.Action>
        </form>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
</div>
