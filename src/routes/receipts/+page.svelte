<script lang="ts">
  import { enhance } from "$app/forms";
  import { formatCurrency } from "$lib/utils";
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
            size="lg"
            class="bg-ink text-white font-mono shadow-[4px_4px_0px_rgba(0,0,0,0.2)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,0,0,0.2)] transition-all active:translate-y-[4px] active:shadow-none border-2 border-ink rounded-sm"
          >
            <Plus class="mr-2 h-4 w-4" />
            Archive New Entry
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
                  <div class="flex-1 flex items-center justify-end gap-6">
                    {#if receipt.status === "DONE"}
                      <!-- Generate Button (Ink/Black) -->
                      <Button
                        href="/recipes/generate?receipt={receipt.id}"
                        variant="default"
                        size="sm"
                        class="bg-ink text-white font-mono text-xs shadow-[3px_3px_0px_rgba(0,0,0,0.2)] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_rgba(0,0,0,0.2)] active:translate-y-[3px] active:shadow-none border border-ink rounded-sm relative z-10"
                        onclick={(e: MouseEvent) => e.stopPropagation()}
                      >
                        <ChefHat class="mr-2 h-3.5 w-3.5" />
                        Generate Recipes
                      </Button>

                      <!-- Verified Stamp (Green) -->
                      <div
                        class="flex items-center justify-center p-1 border-2 border-emerald-500/30 text-emerald-600/60 rounded-sm rotate-[-8deg] select-none pointer-events-none"
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

                  <!-- Delete/Archive Actions -->
                  <div
                    class="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity pl-4 bg-gradient-to-l from-white to-transparent z-20"
                  >
                    <form method="POST" action="?/delete" class="inline-block">
                      <input type="hidden" name="id" value={receipt.id} />
                      <Button
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8 text-stone-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 class="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </div>
              </a>
            {/each}
          </div>
        </Notepad>
      {/if}
    </div>
  </main>
</div>
