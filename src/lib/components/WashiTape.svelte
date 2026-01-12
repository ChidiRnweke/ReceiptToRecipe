<script lang="ts">
  let {
    width = "w-32",
    color = "white",
    rotate = "-rotate-1",
    class: className = "",
  } = $props();

  // Made colors more opaque and "milky" so they stand out against white paper
  const colors = {
    white: "bg-[#f5f5f0]/90 border-white/40",
    yellow: "bg-[#fefce8]/90 border-amber-100/50",
    teal: "bg-[#f0fdfa]/90 border-teal-100/50",
  };

  const selectedColor = colors[color as keyof typeof colors] || colors.white;
</script>

<div
  aria-hidden="true"
  class={`
    relative h-8 shadow-sm select-none overflow-hidden z-20
    ${width} ${rotate} ${className}
  `}
  style="
    /* Sharper tear pattern */
    clip-path: polygon(
      0% 10%, 2% 0%, 5% 5%, 8% 0%, 12% 5%, 15% 2%, 20% 8%, 25% 2%, 30% 6%, 35% 0%, 42% 5%, 50% 2%, 58% 6%, 65% 0%, 72% 5%, 80% 2%, 85% 6%, 92% 0%, 96% 5%, 100% 0%, 
      100% 90%, 98% 100%, 95% 95%, 92% 100%, 88% 95%, 85% 98%, 80% 92%, 75% 98%, 70% 94%, 65% 100%, 58% 95%, 50% 98%, 42% 94%, 35% 100%, 28% 95%, 20% 98%, 15% 94%, 10% 100%, 5% 95%, 0% 100%
    );
    box-shadow: 0 2px 4px rgba(0,0,0,0.1); /* Explicit shadow for lift */
  "
>
  <div class={`absolute inset-0 ${selectedColor}`}></div>

  <div
    class="absolute inset-0 opacity-20"
    style="background-image: url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%221%22/%3E%3C/svg%3E'); filter: contrast(120%);"
  ></div>

  <div
    class="absolute top-0 bottom-0 left-[25%] w-px bg-black/5 blur-[0.5px]"
  ></div>
  <div
    class="absolute top-0 bottom-0 right-[25%] w-0.5 bg-white/40 blur-[1px]"
  ></div>

  <div class="absolute inset-x-0 top-0 h-px bg-white/50"></div>
</div>
