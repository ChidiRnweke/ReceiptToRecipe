<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import {
    Plus,
    ChefHat,
    Clock,
    Users,
    Trash2,
    Sparkles,
    ShoppingCart,
    Loader2,
    BookOpen,
    Search
  } from "lucide-svelte";
  import { getContext } from "svelte";
  import type { WorkflowState } from "$lib/state/workflow.svelte";
  import WashiTape from "$lib/components/WashiTape.svelte";
  import PinnedNote from "$lib/components/PinnedNote.svelte";

  let { data } = $props();
  const workflowState = getContext<WorkflowState>('workflowState');
  let deletingId = $state<string | null>(null);
  let addingToShoppingId = $state<string | null>(null);

  const suggestedRecipes = $derived(data.recipes.filter((r: any) => r.isSuggested));
  const otherRecipes = $derived(data.recipes.filter((r: any) => !r.isSuggested));

  function formatTime(minutes: number | null) {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  const quotes = [
    "Cooking is like love. It should be entered into with abandon or not at all.",
    "The secret ingredient is always love.",
    "Good food is the foundation of genuine happiness.",
    "Life is too short for boring meals.",
  ];
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
</script>

<svelte:head>
  <title>Cookbook - Receipt2Recipe</title>
</svelte:head>

<div class="min-h-screen bg-[#FDFBF7] p-4 md:p-8 relative overflow-x-hidden">
  <!-- Desk Texture (Subtle Noise) -->
  <div class="pointer-events-none absolute inset-0 opacity-[0.03]" style="background-image: url('https://www.transparenttextures.com/patterns/cardboard-flat.png')"></div>

  <!-- Main "Binder" Container -->
  <div class="mx-auto max-w-7xl flex flex-col md:flex-row relative z-10 min-h-[90vh]">
      
      <!-- Left Spine/Binding (Desktop only) -->
      <div class="hidden md:block w-12 bg-stone-800 rounded-l-md relative shadow-xl z-20">
          <div class="absolute inset-y-8 left-4 w-1 bg-stone-700/50"></div>
          <!-- Binding Rings visual -->
          <div class="flex flex-col gap-12 mt-12 pl-2">
              {#each Array(6) as _}
                  <div class="w-16 h-4 bg-stone-300 rounded-full -ml-4 shadow-inner border border-stone-400"></div>
              {/each}
          </div>
      </div>

      <!-- The Page -->
      <div class="flex-1 bg-white shadow-2xl rounded-r-md md:rounded-l-none rounded-l-md relative overflow-hidden border-r border-stone-200">
           <!-- Paper Texture Overlay -->
           <div class="pointer-events-none absolute inset-0 bg-stone-50/20 mix-blend-multiply"></div>
           
           <!-- Content Padding -->
           <div class="p-8 md:p-12 lg:p-16">
               
               <!-- Header -->
               <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-2 border-stone-800 pb-6 mb-10">
                    <div>
                        <div class="flex items-center gap-2 text-stone-400 mb-1">
                            <BookOpen class="h-4 w-4" />
                            <span class="font-mono text-xs uppercase tracking-widest">Chapter 1</span>
                        </div>
                        <h1 class="font-display text-5xl text-ink leading-none">The Collection</h1>
                        <p class="mt-2 font-serif italic text-stone-500">
                            {data.recipes.length} recipes curated for you.
                        </p>
                    </div>
                    
                    <Button href="/recipes/generate" class="bg-stone-800 text-white font-serif shadow-md hover:bg-stone-700">
                        <Plus class="mr-2 h-4 w-4 text-amber-300" />
                        Add New Entry
                    </Button>
               </div>

               <!-- Suggested "Insert" -->
               {#if suggestedRecipes.length > 0}
                   <div class="mb-16 relative">
                       <!-- Section Label -->
                       <div class="absolute -left-12 top-0 -rotate-90 origin-top-right translate-x-full mt-12 hidden lg:block">
                           <span class="font-mono text-xs uppercase tracking-[0.3em] text-stone-400 whitespace-nowrap">Chef's Selection</span>
                       </div>

                       <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                           {#each suggestedRecipes as recipe}
                               <div class="group relative bg-[#fffdf5] border border-stone-200 p-3 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 duration-300 rotate-1 hover:rotate-0">
                                   <!-- Washi Tape -->
                                   <WashiTape color="sage" class="absolute -top-3 left-1/2 -translate-x-1/2 w-24 shadow-sm z-10" />
                                   
                                   <a href="/recipes/{recipe.id}" class="block relative aspect-square overflow-hidden mb-3 border border-stone-100 bg-stone-100 grayscale-[0.2] group-hover:grayscale-0 transition-all">
                                       {#if recipe.imageUrl}
                                            <img src={recipe.imageUrl} alt={recipe.title} class="h-full w-full object-cover" />
                                       {:else}
                                            <div class="absolute inset-0 flex items-center justify-center">
                                                <ChefHat class="h-8 w-8 text-stone-300" />
                                            </div>
                                       {/if}
                                       <div class="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 text-xs font-mono font-bold text-emerald-700 shadow-sm">
                                           {Math.round(recipe.matchPercentage * 100)}% Match
                                       </div>
                                   </a>

                                   <div class="px-1">
                                       <h3 class="font-display text-xl leading-tight mb-2 group-hover:text-amber-700 transition-colors">
                                           <a href="/recipes/{recipe.id}">{recipe.title}</a>
                                       </h3>
                                       <div class="flex items-center justify-between text-xs font-mono text-stone-500 border-t border-dashed border-stone-200 pt-2">
                                           <span>{formatTime((recipe.prepTime || 0) + (recipe.cookTime || 0))}</span>
                                           <span>{recipe.servings} Servings</span>
                                       </div>
                                       
                                       <div class="mt-3">
                                            <form
                                                method="POST"
                                                action="?/addToShopping"
                                                use:enhance={() => {
                                                    addingToShoppingId = recipe.id;
                                                    workflowState.incrementShopping();
                                                    return async ({ result }) => {
                                                        addingToShoppingId = null;
                                                        if (result.type === 'failure') workflowState.decrementShopping();
                                                        else await invalidateAll();
                                                    };
                                                }}
                                            >
                                                <input type="hidden" name="recipeId" value={recipe.id} />
                                                <Button type="submit" size="sm" variant="outline" class="w-full text-xs h-8" disabled={addingToShoppingId === recipe.id}>
                                                    {#if addingToShoppingId === recipe.id}
                                                        <Loader2 class="mr-2 h-3 w-3 animate-spin" />
                                                    {:else}
                                                        <ShoppingCart class="mr-2 h-3 w-3" />
                                                    {/if}
                                                    Shop Ingredients
                                                </Button>
                                            </form>
                                       </div>
                                   </div>
                               </div>
                           {/each}
                       </div>
                   </div>
               {/if}

               <!-- Archive List -->
               {#if otherRecipes.length > 0}
                    <div class="space-y-6">
                        <h2 class="font-hand text-2xl text-stone-600 border-b border-stone-200 pb-2">Archive</h2>
                        
                        <div class="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                            {#each otherRecipes as recipe}
                                <div class="flex gap-4 group">
                                    <a href="/recipes/{recipe.id}" class="w-20 h-20 shrink-0 bg-stone-100 border border-stone-200 overflow-hidden relative">
                                        {#if recipe.imageUrl}
                                            <img src={recipe.imageUrl} alt={recipe.title} class="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        {:else}
                                            <div class="absolute inset-0 flex items-center justify-center">
                                                <ChefHat class="h-6 w-6 text-stone-300" />
                                            </div>
                                        {/if}
                                    </a>
                                    
                                    <div class="flex-1 min-w-0">
                                        <h3 class="font-serif font-bold text-lg leading-tight truncate">
                                            <a href="/recipes/{recipe.id}" class="group-hover:text-amber-700 transition-colors">{recipe.title}</a>
                                        </h3>
                                        <div class="flex items-center gap-2 text-xs font-mono text-stone-400 mt-1 uppercase tracking-wide">
                                            {#if recipe.cuisineType}
                                                <span>{recipe.cuisineType}</span>
                                                <span>•</span>
                                            {/if}
                                            <span>{formatTime((recipe.prepTime || 0) + (recipe.cookTime || 0))}</span>
                                        </div>
                                        
                                        <div class="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <form method="POST" action="?/addToShopping" use:enhance={() => {
                                                addingToShoppingId = recipe.id;
                                                workflowState.incrementShopping();
                                                return async ({ result }) => {
                                                    addingToShoppingId = null;
                                                    if (result.type === 'failure') workflowState.decrementShopping();
                                                    else await invalidateAll();
                                                };
                                            }}>
                                                <input type="hidden" name="recipeId" value={recipe.id} />
                                                <button disabled={addingToShoppingId === recipe.id} class="text-stone-400 hover:text-amber-600 transition-colors" title="Add to list">
                                                    <ShoppingCart class="h-3.5 w-3.5" />
                                                </button>
                                            </form>
                                            
                                            <form method="POST" action="?/delete" use:enhance={({ cancel }) => {
                                                if (!confirm("Delete this recipe?")) cancel();
                                                else deletingId = recipe.id;
                                            }}>
                                                <input type="hidden" name="recipeId" value={recipe.id} />
                                                <button disabled={deletingId === recipe.id} class="text-stone-400 hover:text-red-600 transition-colors" title="Delete">
                                                    <Trash2 class="h-3.5 w-3.5" />
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
               {/if}

               {#if data.recipes.length === 0}
                    <div class="text-center py-20">
                        <ChefHat class="h-16 w-16 text-stone-200 mx-auto mb-4" />
                        <h3 class="font-hand text-3xl text-stone-400">Empty Pages</h3>
                        <p class="font-serif text-stone-400 mt-2 italic">"{randomQuote}"</p>
                    </div>
               {/if}

           </div>
      </div>
  </div>
</div>
