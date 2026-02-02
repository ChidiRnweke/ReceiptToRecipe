<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { Badge } from "$lib/components/ui/badge";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import {
    ShoppingCart,
    Plus,
    Trash2,
    Sparkles,
    ListPlus,
    ChevronDown,
    ChevronUp,
    Check,
    ChefHat,
    AlertTriangle,
    Lightbulb,
    X,
  } from "lucide-svelte";
  import { getContext } from "svelte";
  import type { WorkflowState } from "$lib/state/workflow.svelte";
  import Notepad from "$lib/components/Notepad.svelte";
  import PinnedNote from "$lib/components/PinnedNote.svelte";
  import WashiTape from "$lib/components/WashiTape.svelte";
  import PushPin from "$lib/components/PushPin.svelte";

  // Pantry warning state
  let pantryWarning = $state<{
    show: boolean;
    message: string;
    matchedItem: string;
    confidence: number;
    pendingItem: {
      name: string;
      quantity: string;
      unit: string;
      listId: string;
    } | null;
  }>({
    show: false,
    message: "",
    matchedItem: "",
    confidence: 0,
    pendingItem: null,
  });

  function getRecipeInfo(recipeId: string | null) {
    if (!recipeId || !data.recipeMap) return null;
    return data.recipeMap[recipeId] || null;
  }

  let { data, form } = $props();
  const workflowState = getContext<WorkflowState>("workflowState");

  // Use $derived for state but allow overrides for optimistic UI
  let lists = $derived(data.lists ?? []);

  let loading = $state(false);
  let newListName = $state("");
  let expandedLists = $derived<Set<string>>(
    new Set(lists.slice(0, 1).map((l: any) => l.id)),
  );

  // New item inputs per list
  type NewItemInput = { name: string; quantity: string; unit: string };
  let newItemInputs = $state<Record<string, NewItemInput>>({});

  // Ensure each list has an input state without mutating inside the template.
  $effect(() => {
    const next: Record<string, NewItemInput> = {};
    let changed = false;

    for (const list of lists) {
      const existing = newItemInputs[list.id];
      next[list.id] = existing ?? { name: "", quantity: "1", unit: "" };
      if (!existing) changed = true;
    }

    if (
      Object.keys(newItemInputs).length !== Object.keys(next).length ||
      changed
    ) {
      newItemInputs = next;
    }
  });

  function toggleList(listId: string) {
    if (expandedLists.has(listId)) {
      expandedLists.delete(listId);
    } else {
      expandedLists.add(listId);
    }
    expandedLists = new Set(expandedLists);
  }

  function getCompletionPercentage(items: any[]) {
    if (items.length === 0) return 0;
    const checked = items.filter((i) => i.checked).length;
    return Math.round((checked / items.length) * 100);
  }

  // Force add item bypassing pantry check
  async function forceAddItem() {
    if (!pantryWarning.pendingItem) return;

    const listId = pantryWarning.pendingItem.listId;
    const formData = new FormData();
    formData.append("listId", listId);
    formData.append("name", pantryWarning.pendingItem.name);
    formData.append("quantity", pantryWarning.pendingItem.quantity);
    formData.append("unit", pantryWarning.pendingItem.unit);
    formData.append("skipPantryCheck", "true");

    pantryWarning = {
      show: false,
      message: "",
      matchedItem: "",
      confidence: 0,
      pendingItem: null,
    };

    // Clear the input for this list
    newItemInputs = {
      ...newItemInputs,
      [listId]: { name: "", quantity: "1", unit: "" },
    };

    workflowState.incrementShopping();

    const response = await fetch("?/addItem", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      await invalidateAll();
    } else {
      workflowState.decrementShopping();
    }
  }

  function dismissPantryWarning() {
    if (pantryWarning.pendingItem) {
      const listId = pantryWarning.pendingItem.listId;
      // Clear the input for this list
      newItemInputs = {
        ...newItemInputs,
        [listId]: { name: "", quantity: "1", unit: "" },
      };
    }
    pantryWarning = {
      show: false,
      message: "",
      matchedItem: "",
      confidence: 0,
      pendingItem: null,
    };
  }

  function groupItemsBySource(items: any[]) {
    const groups: Record<string, any[]> = {
      Other: [],
    };

    for (const item of items) {
      if (item.fromRecipeId) {
        const recipe = getRecipeInfo(item.fromRecipeId);
        const groupName = recipe ? `For: ${recipe.title}` : "Recipe Items";
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(item);
      } else {
        groups["Other"].push(item);
      }
    }

    // Move Other to end
    const other = groups["Other"];
    delete groups["Other"];

    return {
      ...groups,
      ...(other.length > 0 ? { "Manual & Suggestions": other } : {}),
    };
  }
</script>

<svelte:head>
  <title>Shopping Lists - Receipt2Recipe</title>
</svelte:head>

<div
  class="min-h-screen bg-bg-paper p-4 font-sans md:p-8 relative overflow-x-hidden"
>
  <!-- Desk Texture -->
  <div class="pointer-events-none absolute inset-0"></div>

  <div class="mx-auto max-w-6xl relative z-10">
    <!-- Header Area -->
    <div class="mb-10 flex flex-col items-center text-center">
      <h1
        class="font-display text-5xl text-ink drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]"
      >
        The Market <span class="marker-highlight">List</span>
      </h1>
      <div
        class="mt-2 flex items-center gap-2 text-[10px] font-ui uppercase tracking-widest text-fg-muted"
      >
        <span>Prepared for</span>
        <span class="text-accent-600 font-bold border-b border-accent-200">you</span
        >
      </div>
    </div>

    {#if form?.error}
      <div
        class="mx-auto max-w-lg mb-6 rounded-lg bg-sienna-50 border border-sienna-100 p-3 text-sm text-sienna-700 text-center shadow-sm"
      >
        {form.error}
      </div>
    {/if}

    <div class="grid gap-12 lg:grid-cols-12 items-start">
      <!-- LEFT SIDEBAR: Suggestions & Quick Actions -->
      <div class="lg:col-span-4 space-y-8 order-2 lg:order-1">
        <!-- Smart Suggestions Note -->
        <PinnedNote color="yellow" rotate="-rotate-1">
          <div
            class="flex items-center gap-2 mb-3 pb-2 border-b border-yellow-200/50"
          >
            <Sparkles class="h-4 w-4 text-amber-600" />
            <h3 class="font-hand text-xl font-bold text-ink/80">
              Pantry Gaps?
            </h3>
          </div>

          <p class="text-sm text-ink/70 leading-relaxed mb-4 font-hand">
            Based on what you usually buy, you might be running low on these
            essentials:
          </p>

          {#if data.suggestions && data.suggestions.length > 0}
            <ul class="space-y-1 mb-4">
              {#each data.suggestions.slice(0, 5) as suggestion}
                <li class="flex items-center justify-between group">
                  <span class="font-hand text-lg text-ink/90"
                    >{suggestion.itemName}</span
                  >
                  <form
                    method="POST"
                    action="?/addSuggestion"
                    use:enhance={() => {
                      workflowState.incrementShopping();
                      return async ({ result }) => {
                        if (result.type === "failure") {
                          workflowState.decrementShopping();
                        } else {
                          await invalidateAll();
                        }
                      };
                    }}
                  >
                    <input
                      type="hidden"
                      name="listId"
                      value={data.activeList?.id}
                    />
                    <input
                      type="hidden"
                      name="itemName"
                      value={suggestion.itemName}
                    />
                    <input
                      type="hidden"
                      name="suggestedQuantity"
                      value={suggestion.suggestedQuantity || ""}
                    />
                    <input
                      type="hidden"
                      name="avgFrequencyDays"
                      value={suggestion.avgFrequencyDays || ""}
                    />
                    <input
                      type="hidden"
                      name="lastPurchased"
                      value={suggestion.lastPurchased}
                    />
                    <input
                      type="hidden"
                      name="daysSinceLastPurchase"
                      value={suggestion.daysSinceLastPurchase}
                    />

                    <button
                      type="submit"
                      class="opacity-40 group-hover:opacity-100 text-amber-700 hover:scale-110 transition-all"
                      title="Add to list"
                    >
                      <Plus class="h-4 w-4" />
                    </button>
                  </form>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="text-sm italic text-ink/40 mb-4 font-hand">
              No suggestions yet. Keep scanning receipts!
            </p>
          {/if}

          <div class="pt-2 border-t border-yellow-200/50">
            <form
              method="POST"
              action="?/generateRestock"
              use:enhance={() => {}}
            >
              <button
                type="submit"
                class="w-full text-left flex items-center gap-2 group"
              >
                <div
                  class="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors"
                >
                  <Sparkles class="h-3 w-3 text-amber-700" />
                </div>
                <span
                  class="font-hand text-lg text-ink/80 group-hover:underline decoration-wavy decoration-amber-300"
                  >Generate full restock list</span
                >
              </button>
            </form>
          </div>
        </PinnedNote>

        <!-- Quick Actions Card (Small) -->
        <div
          class="relative bg-white p-6 rounded-sm shadow-[2px_3px_5px_rgba(0,0,0,0.05)] border border-surface-secondary rotate-2 max-w-xs mx-auto lg:mx-0"
        >
          <div class="absolute -top-3 left-1/2 -translate-x-1/2">
            <WashiTape color="sage" width="w-24" />
          </div>

          <h3
            class="font-ui text-xs uppercase tracking-widest text-fg-muted mb-4 text-center mt-2"
          >
            Quick Actions
          </h3>

          <div class="space-y-3">
            <Button
              variant="outline"
              class="w-full justify-start font-serif"
              href="/recipes"
            >
              <ChefHat class="mr-2 h-4 w-4 text-fg-muted" />
              Browse Recipes
            </Button>

            <form
              method="POST"
              action="?/createList"
              use:enhance={() => {
                loading = true;
                return async ({ result }) => {
                  loading = false;
                  if (result.type === "success") {
                    newListName = "";
                    await invalidateAll();
                  }
                };
              }}
              class="flex flex-col gap-2 pt-2 border-t border-dashed border-border"
            >
              <span class="text-xs font-medium text-fg-muted"
                >Start a new list:</span
              >
              <div class="flex gap-2">
                <Input
                  type="text"
                  name="name"
                  placeholder="e.g. Sunday Dinner..."
                  bind:value={newListName}
                  class="h-8 text-xs"
                />
                <Button
                  type="submit"
                  size="sm"
                  class="h-8"
                  disabled={loading || !newListName.trim()}
                >
                  <ListPlus class="h-3.5 w-3.5" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- CENTER: The Main Notepad -->
      <div class="lg:col-span-8 order-1 lg:order-2">
        <Notepad
          class="w-full min-h-[600px] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)]"
        >
          <div class="px-2 sm:px-4 py-2">
            {#if lists.length === 0}
              <div
                class="flex flex-col items-center justify-center py-20 text-center opacity-60"
              >
                <ShoppingCart class="h-16 w-16 text-fg-muted mb-4" />
                <h3 class="font-hand text-3xl text-ink">Your list is empty</h3>
                <p class="font-serif text-ink-light max-w-xs mx-auto mt-2">
                  Create a list or generate one from your recipes to get
                  started.
                </p>
              </div>
            {:else}
              {#each lists as list}
                {@const completion = getCompletionPercentage(list.items || [])}
                {@const isExpanded = expandedLists.has(list.id)}

                <div class="mb-8 last:mb-0">
                  <!-- List Header (Handwritten Style) -->
                  <div
                    role="button"
                    tabindex="0"
                    class="group flex items-center justify-between border-b-2 border-border pb-2 mb-4 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-accent-400 rounded-sm"
                    onclick={() => toggleList(list.id)}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleList(list.id);
                      }
                    }}
                  >
                    <div class="flex items-end gap-3">
                      <h2
                        class="font-hand text-3xl font-bold text-ink leading-none pt-2"
                      >
                        {list.name}
                      </h2>
                      <span class="font-ui text-xs text-fg-muted mb-1">
                        {list.items?.length || 0} items
                      </span>
                    </div>

                    <div class="flex items-center gap-3">
                      {#if list.items?.length > 0}
                        <div class="hidden sm:flex items-center gap-2">
                          <div class="h-1.5 w-16 rounded-full bg-muted/50">
                            <div
                              class="h-1.5 rounded-full bg-accent-500 transition-all"
                              style="width: {completion}%"
                            ></div>
                          </div>
                        </div>
                      {/if}

                      <div
                        class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                        <form
                          method="POST"
                          action="?/deleteList"
                          use:enhance={() => async () => invalidateAll()}
                          onclick={(e) => e.stopPropagation()}
                        >
                          <input type="hidden" name="listId" value={list.id} />
                          <button
                            type="submit"
                            class="p-1 text-fg-muted hover:text-red-500 transition-colors"
                            aria-label="Delete list"
                          >
                            <Trash2 class="h-4 w-4" />
                          </button>
                        </form>
                      </div>

                      {#if isExpanded}
                        <ChevronUp class="h-5 w-5 text-fg-muted" />
                      {:else}
                        <ChevronDown class="h-5 w-5 text-fg-muted" />
                      {/if}
                    </div>
                  </div>

                  {#if isExpanded}
                    <div class="pl-1 pr-1 sm:pl-4 space-y-6">
                      <!-- Add Item Input (Underlined style) -->
                      {#key list.id}
                        {@const input = newItemInputs[list.id] ?? {
                          name: "",
                          quantity: "1",
                          unit: "",
                        }}
                        <form
                          method="POST"
                          action="?/addItem"
                          use:enhance={() => {
                            workflowState.incrementShopping();
                            return async ({ result }) => {
                              if (result.type === "success") {
                                const data = result.data as any;
                                if (data?.pantryWarning) {
                                  workflowState.decrementShopping();
                                  pantryWarning = {
                                    show: true,
                                    message: data.warningMessage,
                                    matchedItem: data.matchedItem,
                                    confidence: data.confidence,
                                    pendingItem: data.pendingItem,
                                  };
                                  return;
                                }
                                newItemInputs = {
                                  ...newItemInputs,
                                  [list.id]: {
                                    name: "",
                                    quantity: "1",
                                    unit: "",
                                  },
                                };
                                await invalidateAll();
                              } else {
                                workflowState.decrementShopping();
                              }
                            };
                          }}
                          class="flex items-baseline gap-2 mb-6"
                        >
                          <input type="hidden" name="listId" value={list.id} />

                          <div class="flex-1 relative">
                            <input
                              type="text"
                              name="name"
                              placeholder="Add an item..."
                              bind:value={input.name}
                              class="w-full bg-transparent border-none border-b border-border-muted px-0 py-1 font-serif text-lg text-ink focus:ring-0 focus:border-accent-500 placeholder:text-fg-muted placeholder:font-hand placeholder:text-xl"
                            />
                          </div>

                          <div class="w-12 relative">
                            <input
                              type="text"
                              name="quantity"
                              placeholder="#"
                              bind:value={input.quantity}
                              class="w-full bg-transparent border-none border-b border-border-muted px-0 py-1 font-ui text-sm text-right focus:ring-0 focus:border-accent-500 placeholder:text-fg-muted"
                            />
                          </div>

                          <div class="w-16 relative">
                            <input
                              type="text"
                              name="unit"
                              placeholder="Unit"
                              bind:value={input.unit}
                              class="w-full bg-transparent border-none border-b border-border-muted px-0 py-1 font-ui text-sm focus:ring-0 focus:border-accent-500 placeholder:text-fg-muted"
                            />
                          </div>

                          <button
                            type="submit"
                            class="p-2 text-fg-muted hover:text-accent-600 transition-colors"
                          >
                            <Plus class="h-5 w-5" />
                          </button>
                        </form>
                      {/key}

                      <!-- Items List -->
                      {#if list.items && list.items.length > 0}
                        {@const groups = groupItemsBySource(list.items)}

                        {#each Object.entries(groups) as [groupName, items]}
                          <div class="relative">
                            <!-- Group Header (Sticky Note Style if Recipe) -->
                            {#if groupName !== "Manual & Suggestions"}
                              <div class="flex items-center gap-2 mb-2 mt-4">
                                <span
                                  class="inline-block px-2 py-0.5 bg-accent-100 text-accent-800 text-[10px] font-ui uppercase tracking-widest rounded-sm"
                                >
                                  {groupName}
                                </span>
                                <div class="h-px bg-border flex-1"></div>
                              </div>
                            {/if}

                            <ul class="space-y-0">
                              {#each items as item}
                                <li
                                  class="group relative flex items-start py-3 border-b border-dashed border-blue-200/50 hover:bg-amber-50/30 transition-colors"
                                >
                                  <!-- Checkbox Area -->
                                  <div class="pt-1 pr-3">
                                    <form
                                      method="POST"
                                      action="?/toggleItem"
                                      use:enhance={({ formData }) => {
                                        const checked =
                                          formData.get("checked") === "true";
                                        lists = lists.map((l) =>
                                          l.id === list.id
                                            ? {
                                                ...l,
                                                items: l.items.map((i: any) =>
                                                  i.id === item.id
                                                    ? { ...i, checked }
                                                    : i,
                                                ),
                                              }
                                            : l,
                                        );
                                        return async ({ result }) => {
                                          if (result.type !== "success") {
                                            lists = lists.map((l) =>
                                              l.id === list.id
                                                ? {
                                                    ...l,
                                                    items: l.items.map(
                                                      (i: any) =>
                                                        i.id === item.id
                                                          ? {
                                                              ...i,
                                                              checked: !checked,
                                                            }
                                                          : i,
                                                    ),
                                                  }
                                                : l,
                                            );
                                          } else {
                                            await invalidateAll();
                                          }
                                        };
                                      }}
                                    >
                                      <input
                                        type="hidden"
                                        name="itemId"
                                        value={item.id}
                                      />
                                      <input
                                        type="hidden"
                                        name="checked"
                                        value={!item.checked}
                                      />
                                      <button
                                        type="submit"
                                        class="relative flex items-center justify-center w-5 h-5"
                                      >
                                        {#if item.checked}
                                          <!-- Hand-drawn checkmark feel -->
                                          <div
                                            class="absolute inset-0 border-2 border-border rounded-sm bg-fg/5"
                                          ></div>
                                          <Check
                                            class="h-4 w-4 text-fg"
                                          />
                                        {:else}
                                          <div
                                            class="absolute inset-0 border-2 border-fg-muted rounded-sm hover:border-border transition-colors"
                                          ></div>
                                        {/if}
                                      </button>
                                    </form>
                                  </div>

                                  <!-- Item Text -->
                                  <div
                                    class="flex-1 min-w-0 flex flex-col justify-center min-h-[1.75rem]"
                                  >
                                    <div class="flex items-baseline gap-2">
                                      <span
                                        class="font-ui text-sm font-bold text-fg w-12 text-right shrink-0"
                                      >
                                        {item.quantity}
                                        {item.unit}
                                      </span>
                                      <span
                                        class="font-serif text-lg leading-none transition-all duration-300
                                                                        {item.checked
                                          ? 'text-fg-muted line-through decoration-border-muted decoration-2'
                                          : 'text-ink'}"
                                      >
                                        {item.name}
                                      </span>
                                    </div>
                                    {#if item.notes}
                                      <p
                                        class="text-xs text-ink-muted italic pl-14 font-hand"
                                      >
                                        {item.notes}
                                      </p>
                                    {/if}
                                  </div>

                                  <!-- Delete Action (Hover) -->
                                  <div
                                    class="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity px-2 bg-white/50 backdrop-blur-[1px]"
                                  >
                                    <form
                                      method="POST"
                                      action="?/deleteItem"
                                      use:enhance={() => {
                                        lists = lists.map((l) =>
                                          l.id === list.id
                                            ? {
                                                ...l,
                                                items: l.items.filter(
                                                  (i: any) => i.id !== item.id,
                                                ),
                                              }
                                            : l,
                                        );
                                        workflowState.decrementShopping();
                                        return async ({ result }) => {
                                          if (result.type === "failure") {
                                            workflowState.incrementShopping();
                                            await invalidateAll();
                                          } else {
                                            await invalidateAll();
                                          }
                                        };
                                      }}
                                    >
                                      <input
                                        type="hidden"
                                        name="itemId"
                                        value={item.id}
                                      />
                                      <button
                                        type="submit"
                                        class="text-fg-muted hover:text-red-600 transition-colors"
                                      >
                                        <X class="h-4 w-4" />
                                      </button>
                                    </form>
                                  </div>
                                </li>
                              {/each}
                            </ul>
                          </div>
                        {/each}
                      {:else}
                        <div
                          class="py-6 text-center text-fg-muted italic font-hand text-lg"
                        >
                          The list is waiting...
                        </div>
                      {/if}

                      <!-- Done Shopping Button -->
                      {#if list.items?.length > 0 && completion > 0}
                        <div class="pt-8 flex justify-end">
                          <form
                            method="POST"
                            action="?/completeShopping"
                            use:enhance={() => {
                              loading = true;
                              return async ({ result }) => {
                                loading = false;
                                if (result.type === "success") {
                                  await invalidateAll();
                                }
                              };
                            }}
                          >
                            <input
                              type="hidden"
                              name="listId"
                              value={list.id}
                            />
                            <button
                              type="submit"
                              class="btn-accent"
                            >
                              <Check class="mr-2 h-4 w-4" />
                              Checkout
                            </button>
                          </form>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>

          <!-- Bottom decorative spacing -->
          <div class="h-16"></div>
        </Notepad>
      </div>
    </div>
  </div>
</div>

<!-- Pantry Warning Dialog -->
<AlertDialog.Root bind:open={pantryWarning.show}>
  <AlertDialog.Content class="font-serif border-sand bg-[#fffdf5]">
    <AlertDialog.Header>
      <AlertDialog.Title
        class="flex items-center gap-2 font-display text-2xl text-amber-700"
      >
        <AlertTriangle class="h-6 w-6" />
        Check the Pantry!
      </AlertDialog.Title>
      <AlertDialog.Description class="text-ink">
        <p class="mb-4 text-base leading-relaxed">{pantryWarning.message}</p>
        <div
          class="flex items-center gap-2 p-3 bg-white border border-border rounded-sm"
        >
          <span class="text-xs uppercase tracking-widest text-fg-muted"
            >Confidence:</span
          >
          <div class="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              class="h-full bg-amber-500"
              style="width: {pantryWarning.confidence}%"
            ></div>
          </div>
          <span class="font-ui font-bold text-amber-600"
            >{pantryWarning.confidence}%</span
          >
        </div>
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer class="gap-2">
      <AlertDialog.Cancel
        onclick={dismissPantryWarning}
        class="btn-ghost"
      >
        Skip Item
      </AlertDialog.Cancel>
      <AlertDialog.Action
        onclick={forceAddItem}
        class="btn-accent-filled"
      >
        Add Anyway
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
