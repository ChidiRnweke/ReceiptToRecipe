<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
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
  } from "lucide-svelte";
  import { getContext } from "svelte";
  import type { WorkflowState } from "$lib/state/workflow.svelte";

  // Pantry warning state
  let pantryWarning = $state<{
    show: boolean;
    message: string;
    matchedItem: string;
    confidence: number;
    pendingItem: { name: string; quantity: string; unit: string; listId: string } | null;
  }>({ show: false, message: '', matchedItem: '', confidence: 0, pendingItem: null });

  function getRecipeInfo(recipeId: string | null) {
    if (!recipeId || !data.recipeMap) return null;
    return data.recipeMap[recipeId] || null;
  }

  let { data, form } = $props();
  const workflowState = getContext<WorkflowState>('workflowState');
  
  // Use $derived for state but allow overrides for optimistic UI
  let lists = $derived(data.lists ?? []);

  let loading = $state(false);
  let newListName = $state("");
  let expandedLists = $derived<Set<string>>(
    new Set(lists.slice(0, 1).map((l: any) => l.id))
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

  // Check if an item has a pantry match (for display purposes)
  function getPantryMatch(itemName: string) {
    if (!data.pantryLookup) return null;
    const nameLC = itemName.toLowerCase();
    return data.pantryLookup[nameLC] || null;
  }

  // Force add item bypassing pantry check
  async function forceAddItem() {
    if (!pantryWarning.pendingItem) return;

    const listId = pantryWarning.pendingItem.listId;
    const formData = new FormData();
    formData.append('listId', listId);
    formData.append('name', pantryWarning.pendingItem.name);
    formData.append('quantity', pantryWarning.pendingItem.quantity);
    formData.append('unit', pantryWarning.pendingItem.unit);
    formData.append('skipPantryCheck', 'true');

    pantryWarning = { show: false, message: '', matchedItem: '', confidence: 0, pendingItem: null };

    // Clear the input for this list
    newItemInputs = {
      ...newItemInputs,
      [listId]: { name: "", quantity: "1", unit: "" },
    };

    workflowState.incrementShopping();

    const response = await fetch('?/addItem', {
      method: 'POST',
      body: formData
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
    pantryWarning = { show: false, message: '', matchedItem: '', confidence: 0, pendingItem: null };
  }

  function groupItemsBySource(items: any[]) {
    const groups: Record<string, any[]> = {
        'Other': []
    };
    
    for (const item of items) {
        if (item.fromRecipeId) {
            const recipe = getRecipeInfo(item.fromRecipeId);
            const groupName = recipe ? `For: ${recipe.title}` : 'Recipe Items';
            if (!groups[groupName]) groups[groupName] = [];
            groups[groupName].push(item);
        } else {
            groups['Other'].push(item);
        }
    }
    
    // Move Other to end
    const other = groups['Other'];
    delete groups['Other'];
    
    return { ...groups, ...(other.length > 0 ? { 'Manual & Suggestions': other } : {}) };
  }
</script>

<svelte:head>
  <title>Shopping Lists - Receipt2Recipe</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6">
  <div class="flex items-center justify-between">
    <div class="relative">
      <div
        class="absolute -left-4 -top-2 h-20 w-20 rounded-full bg-sage-100/50 blur-2xl"
      ></div>
      <p class="text-sm uppercase tracking-wide text-ink-muted">Step 3</p>
      <h1 class="font-serif text-3xl font-medium text-ink">Shopping Lists</h1>
      <p class="mt-1 text-ink-light">
        {#if data.lists.length === 0}
          Ready to plan your next grocery run?
        {:else}
          {data.lists.length} list{data.lists.length === 1 ? "" : "s"} to keep you
          organized
        {/if}
      </p>
    </div>
  </div>

  {#if form?.error}
    <div class="rounded-lg bg-sienna-50 p-3 text-sm text-sienna-700">
      {form.error}
    </div>
  {/if}

  <div class="grid gap-6 lg:grid-cols-3">
    <!-- Main Content -->
    <div class="lg:col-span-2 space-y-4">
      <!-- Restock CTA -->
      <Card.Root class="overflow-hidden bg-linear-to-br from-sage-50 to-paper">
        <Card.Content
          class="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between"
        >
          <div class="flex items-start gap-4">
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sage-100"
            >
              <Sparkles class="h-6 w-6 text-sage-600" />
            </div>
            <div>
              <h3 class="font-serif text-xl text-ink">Smart Restock</h3>
              <p class="text-sm text-ink-light">
                We'll suggest items based on your purchase patterns. Never
                forget the essentials!
              </p>
            </div>
          </div>
          <form method="POST" action="?/generateRestock" use:enhance={() => {}}>
            <Button type="submit">
              <Sparkles class="mr-2 h-4 w-4" />
              Generate list
            </Button>
          </form>
        </Card.Content>
      </Card.Root>

      <!-- Create New List -->
      <Card.Root>
        <Card.Content class="pt-6">
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
            class="flex gap-2"
          >
            <Input
              type="text"
              name="name"
              placeholder="New shopping list name..."
              bind:value={newListName}
            />
            <Button type="submit" disabled={loading || !newListName.trim()}>
              <ListPlus class="mr-2 h-4 w-4" />
              Create
            </Button>
          </form>
        </Card.Content>
      </Card.Root>

      <!-- Shopping Lists -->
      {#if data.lists.length === 0}
        <Card.Root class="border-dashed">
          <Card.Content class="py-12 text-center">
            <div class="relative mx-auto w-fit">
              <div
                class="flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-50"
              >
                <ShoppingCart class="h-8 w-8 text-sage-600" />
              </div>
              <Sparkles
                class="absolute -right-2 -top-2 h-5 w-5 text-sage-500"
              />
            </div>
            <h3 class="mt-6 font-serif text-xl font-medium text-ink">
              Your cart is empty
            </h3>
            {#if data.recipeCount > 0}
              <p class="mx-auto mt-2 max-w-sm text-sm text-ink-light">
                You have <strong>{data.recipeCount} recipe{data.recipeCount === 1 ? "" : "s"}</strong> ready.
                Add recipe ingredients to your shopping list with one click!
              </p>
              <div class="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                <Button href="/recipes" variant="outline">
                  <ChefHat class="mr-2 h-4 w-4" />
                  Browse Recipes
                </Button>
              </div>
            {:else}
              <p class="mx-auto mt-2 max-w-sm text-sm text-ink-light">
                Create a shopping list above, upload a receipt, or generate a recipe to get started.
              </p>
              <div class="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                <Button href="/receipts/upload" variant="outline">
                  Upload Receipt
                </Button>
                <Button href="/recipes/generate" variant="outline">
                  <Sparkles class="mr-2 h-4 w-4" />
                  Generate Recipe
                </Button>
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      {:else}
        {#each lists as list}
          {@const completion = getCompletionPercentage(list.items || [])}
          {@const isExpanded = expandedLists.has(list.id)}
          <Card.Root>
            <Card.Header
              class="cursor-pointer"
              onclick={() => toggleList(list.id)}
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  {#if isExpanded}
                    <ChevronUp class="h-5 w-5 text-ink-muted" />
                  {:else}
                    <ChevronDown class="h-5 w-5 text-ink-muted" />
                  {/if}
                  <div>
                    <Card.Title>{list.name}</Card.Title>
                    <Card.Description>
                      {list.items?.length || 0} items
                      {#if completion === 100 && list.items?.length > 0}
                        <Badge variant="secondary" class="ml-2">
                          <Check class="mr-1 h-3 w-3" />
                          Complete
                        </Badge>
                      {/if}
                    </Card.Description>
                  </div>
                </div>
                <div class="flex items-center gap-4">
                  {#if list.items?.length > 0}
                    <div class="flex items-center gap-2">
                      <div class="h-2 w-24 rounded-full bg-sand">
                        <div
                          class="h-2 rounded-full bg-sage-500 transition-all"
                          style="width: {completion}%"
                        ></div>
                      </div>
                      <span class="text-sm text-ink-muted">{completion}%</span>
                    </div>
                  {/if}
                  <form
                    method="POST"
                    action="?/deleteList"
                    use:enhance={() => {
                      return async () => {
                        await invalidateAll();
                      };
                    }}
                  >
                    <input type="hidden" name="listId" value={list.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      class="text-ink-muted hover:text-sienna-600"
                      onclick={(e) => e.stopPropagation()}
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </div>
            </Card.Header>

            {#if isExpanded}
              <Card.Content class="space-y-4">
                <!-- Add Item Form -->
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
                      // Optimistic increment
                      workflowState.incrementShopping();

                      return async ({ result, update }) => {
                        if (result.type === "success") {
                          const data = result.data as any;
                          // Check for pantry warning
                          if (data?.pantryWarning) {
                            workflowState.decrementShopping(); // Revert optimistic update
                            pantryWarning = {
                              show: true,
                              message: data.warningMessage,
                              matchedItem: data.matchedItem,
                              confidence: data.confidence,
                              pendingItem: data.pendingItem
                            };
                            return;
                          }
                          newItemInputs = {
                            ...newItemInputs,
                            [list.id]: { name: "", quantity: "1", unit: "" },
                          };
                          await invalidateAll();
                        } else {
                            workflowState.decrementShopping();
                        }
                      };
                    }}
                    class="flex gap-2"
                  >
                    <input type="hidden" name="listId" value={list.id} />
                    <Input
                      type="text"
                      name="name"
                      placeholder="Add item..."
                      bind:value={input.name}
                      class="flex-1"
                    />
                    <Input
                      type="text"
                      name="quantity"
                      placeholder="Qty"
                      bind:value={input.quantity}
                      class="w-16"
                    />
                    <Input
                      type="text"
                      name="unit"
                      placeholder="Unit"
                      bind:value={input.unit}
                      class="w-20"
                    />
                    <Button type="submit" variant="outline" size="icon">
                      <Plus class="h-4 w-4" />
                    </Button>
                  </form>
                {/key}

                <!-- Items List -->
                {#if list.items && list.items.length > 0}
                  {@const groups = groupItemsBySource(list.items)}
                  <div class="space-y-4">
                  {#each Object.entries(groups) as [groupName, items]}
                    <div class="space-y-2">
                        <h4 class="text-xs font-bold uppercase tracking-wider text-ink-muted pl-1">{groupName}</h4>
                        <ul class="space-y-2">
                            {#each items as item}
                            <li
                                class="flex items-center gap-3 rounded-lg border border-sand p-3 transition-colors {item.checked ? 'bg-stone-50' : 'bg-white'}"
                            >
                                <form
                                method="POST"
                                action="?/toggleItem"
                                use:enhance={({ formData }) => {
                                    const checked = formData.get('checked') === 'true';
                                    
                                    // Optimistic update using state override
                                    lists = lists.map(l => 
                                      l.id === list.id 
                                        ? { ...l, items: l.items.map((i: any) => i.id === item.id ? { ...i, checked } : i) }
                                        : l
                                    );
                                    
                                    return async ({ result }) => {
                                        if (result.type !== 'success') {
                                            // Revert on error
                                            lists = lists.map(l => 
                                              l.id === list.id 
                                                ? { ...l, items: l.items.map((i: any) => i.id === item.id ? { ...i, checked: !checked } : i) }
                                                : l
                                            );
                                        } else {
                                            await invalidateAll();
                                        }
                                    };
                                }}
                                >
                                <input type="hidden" name="itemId" value={item.id} />
                                <input
                                    type="hidden"
                                    name="checked"
                                    value={!item.checked}
                                />
                                <button type="submit">
                                    <Checkbox checked={!!item.checked} />
                                </button>
                                </form>
                                <div class="flex-1 min-w-0">
                                <span
                                    class="{item.checked
                                    ? 'text-ink-muted line-through'
                                    : 'text-ink'}"
                                >
                                    <span class="font-medium">
                                    {item.quantity}
                                    {item.unit}
                                    </span>
                                    {item.name}
                                </span>
                                {#if item.notes}
                                    <p class="text-xs text-ink-muted italic">{item.notes}</p>
                                {/if}
                                </div>
                                <form
                                method="POST"
                                action="?/deleteItem"
                                use:enhance={() => {
                                    // Optimistic update
                                    lists = lists.map(l => 
                                      l.id === list.id 
                                        ? { ...l, items: l.items.filter((i: any) => i.id !== item.id) }
                                        : l
                                    );
                                    workflowState.decrementShopping();
                                    
                                    return async ({ result }) => {
                                        if (result.type === 'failure') {
                                            // Revert (reload data essentially)
                                            workflowState.incrementShopping();
                                            await invalidateAll();
                                        } else {
                                            await invalidateAll();
                                        }
                                    };
                                }}
                                >
                                <input type="hidden" name="itemId" value={item.id} />
                                <Button
                                    type="submit"
                                    variant="ghost"
                                    size="icon"
                                    class="h-8 w-8 text-ink-muted hover:text-sienna-600"
                                >
                                    <Trash2 class="h-4 w-4" />
                                </Button>
                                </form>
                            </li>
                            {/each}
                        </ul>
                    </div>
                  {/each}
                  </div>

                  {#if completion > 0}
                    <div class="mt-6 border-t border-sand pt-4 flex justify-end">
                        <form 
                            method="POST" 
                            action="?/completeShopping"
                            use:enhance={() => {
                                loading = true;
                                // We don't know exact count to decrement easily here without loop
                                // Let's rely on server sync for completion as it's a big change
                                return async ({ result }) => {
                                    loading = false;
                                    if (result.type === 'success') {
                                        await invalidateAll();
                                    }
                                }
                            }}
                        >
                            <input type="hidden" name="listId" value={list.id} />
                            <Button type="submit" variant="default" class="bg-sage-600 hover:bg-sage-700 text-white">
                                <Check class="mr-2 h-4 w-4" />
                                Done Shopping
                            </Button>
                        </form>
                    </div>
                  {/if}
                {:else}
                  <p class="py-4 text-center text-sm text-ink-muted">
                    No items in this list yet
                  </p>
                {/if}
              </Card.Content>
            {/if}
          </Card.Root>
        {/each}
      {/if}
    </div>

    <!-- Sidebar -->
    <div class="space-y-6">
      <!-- Smart Suggestions -->
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2">
            <Sparkles class="h-5 w-5 text-sage-600" />
            Smart Suggestions
          </Card.Title>
          <Card.Description>Based on your purchase history</Card.Description>
        </Card.Header>
        <Card.Content>
          {#if data.suggestions && data.suggestions.length > 0}
            <ul class="space-y-3">
              {#each data.suggestions as suggestion}
                <li class="flex items-center justify-between gap-3">
                  <div>
                    <p class="font-medium text-ink">{suggestion.itemName}</p>
                    <p class="text-xs text-ink-muted">
                      Usually buy every {suggestion.avgFrequencyDays ?? "—"} days
                    </p>
                  </div>
                  <form
                    method="POST"
                    action="?/addSuggestion"
                    use:enhance={() => {
                        workflowState.incrementShopping();
                        return async ({ result }) => {
                            if (result.type === 'failure') {
                                workflowState.decrementShopping();
                            } else {
                                await invalidateAll();
                            }
                        };
                    }}
                    class="flex items-center gap-2"
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
                    <Button type="submit" size="sm" variant="outline">
                      Add
                    </Button>
                  </form>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="py-4 text-center text-sm text-ink-muted">
              Upload receipts to get personalized suggestions
            </p>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- Quick Actions -->
      <Card.Root>
        <Card.Header>
          <Card.Title>Quick Actions</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-2">
          <Button variant="outline" class="w-full" href="/recipes">
            <ShoppingCart class="mr-2 h-4 w-4" />
            Generate from Recipes
          </Button>
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</div>

<!-- Pantry Warning Dialog -->
<AlertDialog.Root bind:open={pantryWarning.show}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title class="flex items-center gap-2">
        <AlertTriangle class="h-5 w-5 text-amber-500" />
        You might already have this
      </AlertDialog.Title>
      <AlertDialog.Description>
        <p class="mb-3">{pantryWarning.message}</p>
        <p class="text-sm text-ink-muted">
          Stock confidence: <Badge variant="secondary" class="ml-1">{pantryWarning.confidence}%</Badge>
        </p>
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={dismissPantryWarning}>Skip</AlertDialog.Cancel>
      <AlertDialog.Action onclick={forceAddItem}>Add Anyway</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
