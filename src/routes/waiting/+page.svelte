<script lang="ts">
  import { Clock } from "lucide-svelte";
  import PinnedNote from "$lib/components/PinnedNote.svelte";
  import WashiTape from "$lib/components/WashiTape.svelte";
  import { Button } from "$lib/components/ui/button";
</script>

<div class="min-h-screen flex items-center justify-center bg-sand-50 p-4">
    <div class="relative w-full max-w-md">
        <!-- Backing card visual -->
        <div class="absolute inset-0 bg-white rounded-lg shadow-xl transform rotate-1"></div>
        
        <div class="relative bg-bg-paper border border-sand rounded-lg shadow-sm p-10 flex flex-col items-center text-center">
             <WashiTape class="absolute -top-3 left-1/2 -translate-x-1/2 w-32" />
             
             <div class="mb-6 bg-sage-50 p-4 rounded-full border border-sage-100">
                <Clock class="w-10 h-10 text-sage-600" />
             </div>

             <h1 class="font-display text-4xl text-ink mb-3">You're on the list</h1>
             
             <p class="font-body text-ink-muted mb-8 leading-relaxed max-w-xs mx-auto">
                We're currently rolling out access to new chefs gradually. 
                Sit tight—we'll email you as soon as your kitchen is ready.
             </p>

             <div class="w-full border-t border-dashed border-border/60 mb-8"></div>

             <PinnedNote class="-rotate-1 mb-8 max-w-[280px]">
                <p class="font-hand text-lg text-ink/80 leading-snug text-center">
                   "Good things come to those who wait... and marinate."
                </p>
             </PinnedNote>

             <Button href="/logout" variant="outline" class="w-full border-border text-ink-muted hover:text-ink hover:bg-bg-hover">
                Sign Out
             </Button>
        </div>
    </div>
</div>