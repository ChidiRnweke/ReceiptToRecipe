<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Play, Pause, Square, Volume2 } from "lucide-svelte";
  import { onMount, onDestroy } from "svelte";

  interface Props {
    title: string;
    ingredients: Array<{ name: string; quantity: string; unit: string; optional?: boolean | null }>;
    instructions: string;
    servings: number;
  }

  let { title, ingredients, instructions, servings }: Props = $props();

  let isPlaying = $state(false);
  let isPaused = $state(false);
  let currentStep = $state(0);
  let speechSynthesis: SpeechSynthesis | null = null;
  let voices: SpeechSynthesisVoice[] = $state([]);
  let selectedVoice = $state<SpeechSynthesisVoice | null>(null);
  let utterance: SpeechSynthesisUtterance | null = null;
  let steps: string[] = $derived(
    instructions
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  );

  onMount(() => {
    if (typeof window !== "undefined") {
      speechSynthesis = window.speechSynthesis;
      loadVoices();
      
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
      }
    }

    return () => {
      stop();
    };
  });

  onDestroy(() => {
    stop();
  });

  function loadVoices() {
    if (!speechSynthesis) return;
    voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith("en"));
    selectedVoice = voices.find(v => v.name.includes("Google") || v.name.includes("Samantha")) || voices[0] || null;
  }

  function buildRecipeText(): string {
    const ingredientList = ingredients
      .map((ing) => {
        const optionalText = ing.optional ? ", optional" : "";
        return `${ing.quantity} ${ing.unit} ${ing.name}${optionalText}`;
      })
      .join(". ");

    return `Recipe for ${title}. Serves ${servings} people. Ingredients: ${ingredientList}. Let's begin cooking. `;
  }

  function speakStep(index: number) {
    if (!speechSynthesis || !selectedVoice) return;

    if (index === 0) {
      utterance = new SpeechSynthesisUtterance(buildRecipeText());
    } else if (index <= steps.length) {
      utterance = new SpeechSynthesisUtterance(`Step ${index}: ${steps[index - 1]}`);
    } else {
      utterance = new SpeechSynthesisUtterance("Your dish is complete. Enjoy your meal!");
    }

    utterance.voice = selectedVoice;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onend = () => {
      if (index <= steps.length && isPlaying) {
        currentStep = index + 1;
        speakStep(currentStep);
      } else if (index > steps.length) {
        isPlaying = false;
        currentStep = 0;
      }
    };

    utterance.onerror = () => {
      isPlaying = false;
    };

    speechSynthesis.speak(utterance);
  }

  function togglePlay() {
    if (!speechSynthesis) return;

    if (isPlaying) {
      speechSynthesis.pause();
      isPaused = true;
      isPlaying = false;
    } else if (isPaused) {
      speechSynthesis.resume();
      isPaused = false;
      isPlaying = true;
    } else {
      isPlaying = true;
      currentStep = currentStep || 0;
      speakStep(currentStep);
    }
  }

  function stop() {
    if (!speechSynthesis) return;
    speechSynthesis.cancel();
    isPlaying = false;
    isPaused = false;
    currentStep = 0;
  }
</script>

<div class="flex items-center gap-2">
  <Button
    variant="ghost"
    size="icon"
    class="h-7 w-7 rounded-full hover:bg-primary-100"
    onclick={togglePlay}
    title={isPlaying ? "Pause" : isPaused ? "Resume" : "Listen"}
  >
    {#if isPlaying}
      <Pause class="h-3.5 w-3.5 text-primary-700" />
    {:else}
      <Play class="h-3.5 w-3.5 text-primary-700" />
    {/if}
  </Button>
  
  {#if isPlaying || isPaused}
    <Button
      variant="ghost"
      size="icon"
      class="h-7 w-7 rounded-full hover:bg-danger-50"
      onclick={stop}
      title="Stop"
    >
      <Square class="h-3 w-3 text-danger-600" fill="currentColor" />
    </Button>
  {/if}
  
  <span class="font-ui text-xs text-text-muted">
    {#if isPlaying || isPaused}
      {currentStep > 0 && currentStep <= steps.length ? `Step ${currentStep}` : isPlaying ? "Intro" : ""}
    {:else}
      Listen
    {/if}
  </span>
</div>
