<script lang="ts">
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import {
    Upload,
    Image,
    X,
    Sun,
    Camera,
    ScanLine,
    Layers,
    Sparkles,
    ArrowLeft,
    ChefHat,
    Paperclip,
  } from "lucide-svelte";
  import WashiTape from "$lib/components/WashiTape.svelte";

  let { form } = $props();
  let loading = $state(false);
  let dragover = $state(false);
  let preview = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);

  function handleFile(file: File | null) {
    if (!file) {
      preview = null;
      return;
    }

    if (!file.type.startsWith("image/")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      preview = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragover = false;
    const file = e.dataTransfer?.files[0];
    if (file && fileInput) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      handleFile(file);
    }
  }

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    handleFile(input.files?.[0] ?? null);
  }

  function clearPreview() {
    preview = null;
    if (fileInput) {
      fileInput.value = "";
    }
  }
</script>

<svelte:head>
  <title>Upload Receipt - Receipt2Recipe</title>
</svelte:head>

<div class="min-h-screen bg-[#FDFBF7] p-6 md:p-10 relative overflow-x-hidden">
  <!-- Desk Texture (Subtle Noise) -->
  <div class="pointer-events-none absolute inset-0 opacity-[0.03]" style="background-image: url('https://www.transparenttextures.com/patterns/cardboard-flat.png')"></div>

  <div class="mx-auto max-w-3xl relative z-10">
    <div class="mb-8 flex items-center justify-between">
       <Button href="/receipts" variant="ghost" class="font-serif text-stone-500 hover:text-ink pl-0 hover:bg-transparent">
            <ArrowLeft class="mr-2 h-4 w-4" />
            Back to Ledger
       </Button>
    </div>

    <div class="text-center mb-10">
        <h1 class="font-display text-4xl text-ink mb-2">The Inbox</h1>
        <p class="font-serif text-ink-light italic">Drop your receipts here for processing.</p>
    </div>

    <!-- Main Drop Zone Container -->
    <div class="relative bg-white p-2 rounded-sm shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] border border-stone-200 rotate-1 transition-transform duration-300 hover:rotate-0">
        <!-- Washi Tape Decor -->
        <WashiTape color="sage" class="absolute -top-3 left-1/2 -translate-x-1/2 w-32 shadow-sm z-20" />

        <div class="border-2 border-dashed border-stone-300 bg-[#fffdf5] rounded-sm p-8 min-h-[400px] flex flex-col items-center justify-center relative transition-colors duration-300 {dragover ? 'bg-sage-50 border-sage-400' : ''}">
            
            <form
                method="POST"
                enctype="multipart/form-data"
                use:enhance={() => {
                loading = true;
                return async ({ result }) => {
                    loading = false;
                    if (result.type === "redirect") {
                    goto(result.location);
                    }
                };
                }}
                class="w-full h-full flex flex-col items-center justify-center"
            >
                {#if form?.error}
                    <div class="absolute top-4 left-4 right-4 bg-sienna-50 border border-sienna-200 text-sienna-800 p-3 text-center font-serif text-sm rotate-1 shadow-sm">
                        <Paperclip class="h-4 w-4 inline mr-2" />
                        {form.error}
                    </div>
                {/if}

                <input
                    bind:this={fileInput}
                    id="receipt-upload"
                    type="file"
                    name="receipt"
                    accept="image/*"
                    class="hidden"
                    onchange={handleFileChange}
                    required
                />

                <div
                    role="button"
                    tabindex="0"
                    class="w-full h-full flex flex-col items-center justify-center outline-none"
                    ondragover={(e) => {
                        e.preventDefault();
                        dragover = true;
                    }}
                    ondragleave={() => (dragover = false)}
                    ondrop={handleDrop}
                    onkeydown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            fileInput?.click();
                        }
                    }}
                    onclick={() => !preview && fileInput?.click()}
                >
                    {#if preview}
                        <div class="relative w-full max-w-sm mx-auto transform -rotate-2 transition-transform hover:rotate-0 duration-500">
                             <div class="bg-white p-3 shadow-lg border border-stone-100 pb-12">
                                <img
                                    src={preview}
                                    alt="Receipt preview"
                                    class="w-full h-auto filter contrast-125 grayscale-[0.1]"
                                />
                                <div class="absolute bottom-4 right-4 font-hand text-stone-400 text-xl">
                                    Receipt #{Math.floor(Math.random() * 1000)}
                                </div>
                             </div>
                             
                             <button
                                type="button"
                                onclick={(e) => {
                                    e.stopPropagation();
                                    clearPreview();
                                }}
                                class="absolute -top-3 -right-3 bg-white rounded-full p-2 shadow-md hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors z-30"
                             >
                                <X class="h-4 w-4" />
                             </button>
                        </div>

                        <div class="mt-8 flex flex-col items-center gap-3">
                             <Button type="submit" disabled={loading} size="lg" class="font-display text-lg px-8 bg-ink text-white hover:bg-stone-800 shadow-md">
                                {#if loading}
                                    <ScanLine class="mr-2 h-4 w-4 animate-pulse" />
                                    Scanning...
                                {:else}
                                    Process Receipt
                                {/if}
                            </Button>
                            <p class="font-serif text-xs text-stone-400 italic">
                                We'll extract ingredients and add them to your pantry.
                            </p>
                        </div>
                    {:else}
                        <div class="flex flex-col items-center gap-6 pointer-events-none">
                            <div class="h-24 w-24 rounded-full bg-stone-100 flex items-center justify-center border border-stone-200 shadow-inner">
                                <Upload class="h-10 w-10 text-stone-400" />
                            </div>
                            <div class="text-center space-y-2">
                                <h3 class="font-hand text-3xl text-ink">
                                    {dragover ? "Drop it here!" : "Place receipt here"}
                                </h3>
                                <p class="font-serif text-stone-400 text-sm">
                                    Click to browse or drag & drop
                                </p>
                            </div>
                        </div>
                    {/if}
                </div>
            </form>
        </div>
    </div>

    <!-- Tips Note (Sticky Note Style) -->
    <div class="mt-12 mx-auto max-w-2xl transform rotate-1">
        <div class="bg-yellow-50 border border-yellow-200 p-6 shadow-sm relative">
            <div class="absolute -top-3 left-1/2 -translate-x-1/2">
                <WashiTape color="yellow" width="w-24" />
            </div>
            
            <h3 class="font-mono text-xs uppercase tracking-widest text-stone-500 text-center mb-6 mt-2">
                Scanning Guidelines
            </h3>

            <div class="grid grid-cols-2 gap-6">
                <div class="flex items-start gap-3">
                    <Sun class="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                        <p class="font-bold text-ink text-sm font-serif">Lighting</p>
                        <p class="text-xs text-ink-light font-serif">Ensure scanned items are well-lit.</p>
                    </div>
                </div>
                <div class="flex items-start gap-3">
                    <Layers class="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                        <p class="font-bold text-ink text-sm font-serif">Flat</p>
                        <p class="text-xs text-ink-light font-serif">Flatten wrinkles for better OCR.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
  </div>
</div>