<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import PinnedNote from "$lib/components/PinnedNote.svelte";
  import WashiTape from "$lib/components/WashiTape.svelte";
  import {
    Sparkles,
    ArrowRight,
    Receipt,
    ChefHat,
    ShoppingCart,
    ScanLine,
  } from "lucide-svelte";
</script>

<div class="flex flex-col min-h-[calc(100vh-4rem)]">
  <!-- Hero Section -->
  <section
    class="relative pt-16 pb-24 md:pt-32 md:pb-32 overflow-hidden bg-bg-paper"
  >
    <div class="container mx-auto px-4 relative z-10">
      <div class="max-w-4xl mx-auto text-center space-y-10">
        <!-- Badge -->
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-100 border border-secondary-200 text-secondary-800 text-xs font-bold uppercase tracking-wider mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
           <span class="w-2 h-2 rounded-full bg-secondary-500 animate-pulse"></span>
           Closed Beta
        </div>

        <!-- Headline -->
        <h1
          class="font-display text-5xl md:text-7xl lg:text-8xl text-text-primary leading-[0.95] tracking-tight animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100"
        >
          Turn grocery <span class="relative inline-block">
            <span class="relative z-10">receipts</span>
            <svg
              class="absolute -bottom-2 left-0 w-full h-3 text-secondary-300 -z-10"
              viewBox="0 0 100 10"
              preserveAspectRatio="none"
            >
              <path
                d="M0 5 Q 50 10 100 5"
                stroke="currentColor"
                stroke-width="8"
                fill="none"
                opacity="0.6"
              />
            </svg>
          </span>
          into <br class="hidden md:block" />
          an editorial cookbook.
        </h1>

        <!-- Subhead -->
        <p
          class="font-hand text-xl md:text-3xl text-text-secondary max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200"
        >
          Scan receipts, get AI-generated recipes that match your taste, and
          never wonder "what's for dinner" again.
        </p>

        <!-- CTA -->
        <div
          class="flex flex-col sm:flex-row items-center justify-center gap-6 pt-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300"
        >
          <Button
            href="/signup"
            size="lg"
            class="h-14 px-10 text-lg bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
          >
            Request Access
          </Button>
          <a
            href="#how-it-works"
            class="text-sm font-medium text-text-secondary hover:text-primary-700 transition-colors flex items-center gap-2 group border-b border-transparent hover:border-primary-700 pb-0.5"
          >
            See how it works
            <ArrowRight
              class="w-4 h-4 transition-transform group-hover:translate-x-1"
            />
          </a>
        </div>
      </div>
    </div>

    <!-- Background decorations (Pinned Notes) -->
    <div
      class="absolute top-1/2 left-4 md:left-20 -translate-y-1/2 hidden lg:block rotate-[-6deg] hover:rotate-[-3deg] transition-transform duration-500 cursor-help"
    >
      <PinnedNote color="red" rotate="-rotate-2">
        <div class="w-48 text-center p-2">
          <p class="font-hand text-xl text-ink leading-tight">
            "I’ve stopped buying ingredients I already own."
          </p>
          <div class="mt-3 flex justify-center">
            <div class="h-1 w-12 bg-border/50 rounded-full"></div>
          </div>
        </div>
      </PinnedNote>
    </div>

    <div
      class="absolute top-1/3 right-4 md:right-20 -translate-y-1/2 hidden lg:block rotate-[6deg] hover:rotate-[3deg] transition-transform duration-500 cursor-help"
    >
      <PinnedNote color="yellow" rotate="rotate-2">
        <div class="w-48 text-center p-2">
          <p class="font-hand text-xl text-ink leading-tight">
            "Turns my kitchen chaos into a dinner menu."
          </p>
          <div class="mt-3 flex justify-center">
            <div class="h-1 w-12 bg-border/50 rounded-full"></div>
          </div>
        </div>
      </PinnedNote>
    </div>
  </section>

  <!-- Feature Showcase (The Kitchen Counter) -->
  <section class="py-24 bg-[#FDFBF7] border-y border-[#EAE0D5] relative">
    <!-- Texture Overlay -->
    <div
      class="absolute inset-0 opacity-[0.4] pointer-events-none mix-blend-multiply"
      style="background-image: url('data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' /%3E%3C/g%3E%3C/svg%3E');"
    ></div>

    <div class="container mx-auto px-4 relative z-10">
      <div
        class="grid grid-cols-1 md:grid-cols-3 gap-12 items-start max-w-6xl mx-auto"
      >
        <!-- 1. The Receipt (Scanning) -->
        <div class="group relative flex flex-col items-center">
          <div
            class="relative w-full max-w-[280px] bg-white shadow-lg rotate-[-2deg] transition-all duration-300 group-hover:rotate-0 group-hover:scale-105 group-hover:shadow-xl"
          >
            <!-- Jagged Top -->
            <div
              class="h-4 bg-white"
              style="clip-path: polygon(0% 100%, 5% 0%, 10% 100%, 15% 0%, 20% 100%, 25% 0%, 30% 100%, 35% 0%, 40% 100%, 45% 0%, 50% 100%, 55% 0%, 60% 100%, 65% 0%, 70% 100%, 75% 0%, 80% 100%, 85% 0%, 90% 100%, 95% 0%, 100% 100%); margin-top: -16px;"
            ></div>

            <div
              class="p-6 pb-12 flex flex-col items-center text-center space-y-4"
            >
              <div
                class="w-12 h-12 border-2 border-text-primary rounded-full flex items-center justify-center"
              >
                <ScanLine class="w-6 h-6 text-text-primary" />
              </div>
              <h3
                class="font-display text-2xl border-b-2 border-text-primary pb-1"
              >
                RECEIPT
              </h3>
              <div
                class="w-full space-y-2 font-mono text-xs text-text-muted opacity-60"
              >
                <div class="flex justify-between">
                  <span>MILK</span><span>3.99</span>
                </div>
                <div class="flex justify-between">
                  <span>EGGS</span><span>4.50</span>
                </div>
                <div class="flex justify-between">
                  <span>FLOUR</span><span>2.20</span>
                </div>
              </div>
              <p
                class="font-hand text-lg text-text-secondary leading-tight pt-2"
              >
                "Just drop a photo. We extract every ingredient automatically."
              </p>
            </div>

            <!-- Jagged Bottom -->
            <div
              class="absolute bottom-[-16px] left-0 right-0 h-4 bg-white"
              style="clip-path: polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%);"
            ></div>
          </div>
        </div>

        <!-- 2. The Recipe Card (Generation) -->
        <div class="group relative flex flex-col items-center mt-8 md:mt-0">
          <div
            class="relative w-full max-w-[320px] aspect-[4/3] bg-[#fffcf5] border border-[#e5e0d0] shadow-md p-6 rotate-[1deg] transition-all duration-300 group-hover:rotate-0 group-hover:scale-105 group-hover:shadow-xl"
          >
            <!-- Washi Tape -->
            <div class="absolute -top-3 left-1/2 -translate-x-1/2">
              <WashiTape color="sage" />
            </div>

            <div
              class="h-full flex flex-col border border-dashed border-[#dcd0c0] p-4"
            >
              <div
                class="flex items-center gap-3 mb-3 border-b border-[#dcd0c0] pb-2"
              >
                <ChefHat class="w-5 h-5 text-text-muted" />
                <span class="font-display text-xl text-text-primary"
                  >Seasonal Pasta</span
                >
              </div>
              <div class="flex-1 space-y-2">
                <div class="h-2 w-3/4 bg-[#eeeadd] rounded-full"></div>
                <div class="h-2 w-full bg-[#eeeadd] rounded-full"></div>
                <div class="h-2 w-5/6 bg-[#eeeadd] rounded-full"></div>
                <div class="h-2 w-4/5 bg-[#eeeadd] rounded-full"></div>
              </div>
              <p class="font-hand text-lg text-text-secondary text-center mt-4">
                "Recipes tailored to what you actually have."
              </p>
            </div>
          </div>
        </div>

        <!-- 3. The Notepad (Shopping) -->
        <div class="group relative flex flex-col items-center mt-8 md:mt-0">
          <div
            class="relative w-full max-w-[260px] bg-[#fdf6e3] shadow-lg rotate-[-1deg] transition-all duration-300 group-hover:rotate-0 group-hover:scale-105 group-hover:shadow-xl"
          >
            <!-- Holes -->
            <div
              class="absolute top-0 left-0 w-full h-8 flex justify-evenly items-center border-b border-black/5"
            >
              <div class="w-3 h-3 rounded-full bg-[#333] opacity-10"></div>
              <div class="w-3 h-3 rounded-full bg-[#333] opacity-10"></div>
              <div class="w-3 h-3 rounded-full bg-[#333] opacity-10"></div>
            </div>

            <div class="pt-10 px-6 pb-8 min-h-[300px] flex flex-col relative">
              <!-- Lines -->
              <div
                class="absolute inset-0 top-10 pointer-events-none"
                style="background-image: linear-gradient(transparent 23px, #e5e7eb 24px); background-size: 100% 24px;"
              ></div>

              <div class="relative z-10">
                <div class="flex items-center gap-2 mb-4">
                  <ShoppingCart class="w-5 h-5 text-secondary-600" />
                  <h3 class="font-hand text-2xl text-secondary-800">
                    Shopping List
                  </h3>
                </div>

                <ul class="space-y-3 font-hand text-xl text-text-primary ml-1">
                  <li class="flex items-center gap-2">
                    <div
                      class="w-4 h-4 border border-text-muted rounded-sm"
                    ></div>
                    <span>Olive Oil</span>
                  </li>
                  <li class="flex items-center gap-2">
                    <div
                      class="w-4 h-4 border border-text-muted rounded-sm"
                    ></div>
                    <span>Basil</span>
                  </li>
                  <li class="flex items-center gap-2 opacity-50 line-through">
                    <div
                      class="w-4 h-4 border border-text-muted rounded-sm bg-text-muted/20"
                    ></div>
                    <span>Garlic</span>
                  </li>
                </ul>
                <p
                  class="font-sans text-sm text-text-secondary mt-8 italic leading-snug"
                >
                  "Auto-generated lists based on what's missing."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Workflow Section (Hand-drawn style) -->
  <section id="how-it-works" class="py-24 bg-white relative overflow-hidden">
    <div class="container mx-auto px-4 relative z-10">
      <div class="text-center max-w-3xl mx-auto mb-20">
        <h2 class="font-display text-4xl md:text-5xl text-text-primary mb-4">
          From Receipt to Table
        </h2>
        <div class="h-1 w-24 bg-secondary-200 mx-auto rounded-full"></div>
      </div>

      <div class="max-w-6xl mx-auto">
        <div
          class="relative flex flex-col md:flex-row justify-between items-center gap-12 md:gap-4"
        >
          <!-- Connector Line (Desktop SVG) -->
          <svg
            class="hidden md:block absolute top-1/2 left-0 w-full h-24 -translate-y-1/2 -z-10 text-border pointer-events-none"
            preserveAspectRatio="none"
          >
            <path
              d="M 100 50 C 250 100, 450 0, 600 50 C 750 100, 950 0, 1100 50"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-dasharray="8 8"
            />
          </svg>

          <!-- Steps -->
          {#each [{ icon: Receipt, label: "Scan", desc: "Snap a photo", color: "text-primary-600" }, { icon: Sparkles, label: "Organize", desc: "AI sorts ingredients", color: "text-secondary-500" }, { icon: ChefHat, label: "Cook", desc: "Get recipes", color: "text-primary-700" }, { icon: ShoppingCart, label: "Shop", desc: "Smart lists", color: "text-blue-600" }] as step, i}
            <div
              class="relative flex flex-col items-center text-center group w-48"
            >
              <!-- Hand-drawn circle background -->
              <div
                class="relative w-28 h-28 flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
              >
                <svg
                  class="absolute inset-0 w-full h-full text-[#f0ebe0] group-hover:text-[#e8e2d2] transition-colors"
                  viewBox="0 0 100 100"
                  fill="currentColor"
                >
                  <path
                    d="M46.5,96.5c-13.8,0-26.6-5.3-36.2-14.8C1.8,73.4-1.9,61.1,1.2,48.8c3.2-12.7,11.9-23.2,23.9-28.9 c11.5-5.4,24.9-5.4,36.9-0.9c12.3,4.6,22.2,14.2,27.1,26.4c5.1,12.8,4.1,27.4-2.8,39.2C81.4,79.5,71.2,87.9,59,92.5 C54.9,94,50.7,95.5,46.5,96.5z"
                  />
                </svg>
                <step.icon class={`w-10 h-10 ${step.color} relative z-10`} />
                <div
                  class="absolute -right-2 -top-2 w-8 h-8 bg-white rounded-full border border-border flex items-center justify-center font-hand text-lg text-text-muted shadow-sm"
                >
                  {i + 1}
                </div>
              </div>

              <h3 class="font-display text-2xl text-text-primary mb-1">
                {step.label}
              </h3>
              <p class="font-hand text-lg text-text-secondary">{step.desc}</p>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section
    class="py-32 bg-primary-50 border-t border-primary-100 relative overflow-hidden"
  >
    <!-- Abstract Shapes -->
    <div
      class="absolute top-0 left-0 w-64 h-64 bg-primary-100/50 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"
    ></div>
    <div
      class="absolute bottom-0 right-0 w-96 h-96 bg-secondary-100/50 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"
    ></div>

    <div class="container mx-auto px-4 text-center relative z-10">
      <div class="max-w-3xl mx-auto space-y-10">
        <h2
          class="font-display text-5xl md:text-6xl text-primary-900 leading-tight"
        >
          Ready to empty your <br /> fridge?
        </h2>
        <p class="font-hand text-2xl text-primary-800 max-w-xl mx-auto">
          Join the waiting list of home cooks who've simplified their meal planning
          with Receipt2Recipe.
        </p>
        <div class="pt-6">
          <Button
            href="/signup"
            size="lg"
            class="h-16 px-12 text-xl bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1"
          >
            Request Access
          </Button>
        </div>
        <p
          class="text-xs text-primary-600 uppercase tracking-widest pt-8 font-medium"
        >
          Limited spots available
        </p>
      </div>
    </div>
  </section>
</div>
