<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Sparkles, Wand2, Loader2 } from "lucide-svelte";
  import { enhance } from "$app/forms";
  import { slide } from "svelte/transition";

  interface Props {
    recipeId: string;
    title: string;
    description: string | null;
    ingredients: Array<{
      name: string;
      quantity: string;
      unit: string;
      optional?: boolean | null;
    }>;
    instructions: string;
    isOwner: boolean;
    suggestions?: string[];
    onAdjust?: () => void;
  }

  let { 
    recipeId, 
    title, 
    description, 
    ingredients, 
    instructions, 
    isOwner,
    suggestions = [],
    onAdjust 
  }: Props = $props();

  let isOpen = $state(false);
  let isAdjusting = $state(false);
  let instruction = $state("");

  const defaultExamples = [
    "Make it spicier",
    "Replace chicken with tofu",
    "Double the garlic",
    "Make it vegetarian",
    "Add more vegetables",
    "Make it for 6 people instead of 4"
  ];

  let activeSuggestions = $derived(suggestions.length > 0 ? suggestions : defaultExamples);

  function toggleOpen() {
    isOpen = !isOpen;
    if (!isOpen) {
      instruction = "";
    }
  }

  function useExample(example: string) {
    instruction = example;
  }
</script>

{#if !isOwner}
  <!-- Non-owners don't see anything -->
{:else}
  <div class="relative">
    {#if !isOpen}
      <button
        class="w-full flex items-center gap-2 px-3 py-2 text-left font-hand text-base text-text-secondary hover:text-text-primary border border-dashed border-border hover:border-primary-300 rounded-lg hover:bg-primary-50/30 transition-colors"
        onclick={toggleOpen}
      >
        <Wand2 class="h-4 w-4 text-primary-600" />
        <span>Adjust this recipe...</span>
      </button>
    {:else}
      <div 
        class="bg-white border border-primary-200 rounded-lg shadow-lg overflow-hidden"
        transition:slide={{ duration: 200 }}
      >
        <div class="p-3 space-y-3">
          <div class="flex items-center justify-between">
            <span class="font-hand text-sm font-bold text-text-primary flex items-center gap-1.5">
              <Sparkles class="h-3.5 w-3.5 text-primary-600" />
              What would you like to change?
            </span>
            <button
              class="text-text-muted hover:text-text-primary text-xs"
              onclick={toggleOpen}
            >
              Cancel
            </button>
          </div>

          <form
            method="POST"
            action="?/adjustRecipe"
            use:enhance={({ formData }) => {
              isAdjusting = true;
              formData.set("recipeId", recipeId);
              formData.set("instruction", instruction);
              formData.set("currentRecipe", JSON.stringify({
                title,
                description,
                ingredients,
                instructions
              }));
              
              return async ({ result }) => {
                isAdjusting = false;
                if (result.type === "success") {
                  isOpen = false;
                  instruction = "";
                  onAdjust?.();
                }
              };
            }}
          >
            <Textarea
              bind:value={instruction}
              placeholder="e.g., Make it vegan, add more spice, use chicken instead of beef..."
              class="font-body text-sm bg-bg-paper/50 resize-none min-h-[60px]"
              rows={2}
            />

            <!-- Example chips -->
            <div class="flex flex-wrap gap-1.5 mt-2">
              {#each activeSuggestions as example}
                <button
                  type="button"
                  class="px-2 py-0.5 text-xs font-ui bg-bg-paper border border-border rounded-full hover:border-primary-300 hover:bg-primary-50/30 transition-colors"
                  onclick={() => useExample(example)}
                >
                  {example}
                </button>
              {/each}
            </div>

            <div class="flex justify-end mt-3">
              <Button
                type="submit"
                size="sm"
                class="bg-primary-600 hover:bg-primary-700"
                disabled={isAdjusting || !instruction.trim()}
              >
                {#if isAdjusting}
                  <Loader2 class="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Adjusting...
                {:else}
                  <Wand2 class="h-3.5 w-3.5 mr-1.5" />
                  Adjust Recipe
                {/if}
              </Button>
            </div>
          </form>
        </div>
      </div>
    {/if}
  </div>
{/if}
