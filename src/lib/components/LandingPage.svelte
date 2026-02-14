<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import PinnedNote from '$lib/components/PinnedNote.svelte';
	import WashiTape from '$lib/components/WashiTape.svelte';
	import { Sparkles, ArrowRight, Receipt, ChefHat, ShoppingCart, ScanLine } from 'lucide-svelte';
</script>

<div class="flex min-h-[calc(100vh-4rem)] flex-col">
	<!-- Hero Section -->
	<section class="relative overflow-hidden bg-bg-paper pt-16 pb-24 md:pt-32 md:pb-32">
		<div class="relative z-10 container mx-auto px-4">
			<div class="mx-auto max-w-4xl space-y-10 text-center">
				<!-- Badge -->
				<div
					class="mb-4 inline-flex animate-in items-center gap-2 rounded-full border border-secondary-200 bg-secondary-100 px-3 py-1 text-xs font-bold tracking-wider text-secondary-800 uppercase duration-700 fade-in slide-in-from-bottom-4"
				>
					<span class="h-2 w-2 animate-pulse rounded-full bg-secondary-500"></span>
					Closed Beta
				</div>

				<!-- Headline -->
				<h1
					class="font-display animate-in text-5xl leading-[0.95] tracking-tight text-text-primary delay-100 duration-1000 fade-in slide-in-from-bottom-8 md:text-7xl lg:text-8xl"
				>
					Turn grocery <span class="relative inline-block">
						<span class="relative z-10">receipts</span>
						<svg
							class="absolute -bottom-2 left-0 -z-10 h-3 w-full text-secondary-300"
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
					class="font-hand mx-auto max-w-2xl animate-in text-xl leading-relaxed text-text-secondary delay-200 duration-1000 fade-in slide-in-from-bottom-8 md:text-3xl"
				>
					Scan receipts, get AI-generated recipes that match your taste, and never wonder "what's
					for dinner" again.
				</p>

				<!-- CTA -->
				<div
					class="flex animate-in flex-col items-center justify-center gap-6 pt-6 delay-300 duration-1000 fade-in slide-in-from-bottom-8 sm:flex-row"
				>
					<Button
						href="/signup"
						size="lg"
						class="h-14 rounded-full bg-primary-600 px-10 text-lg text-white shadow-lg transition-all hover:-translate-y-1 hover:bg-primary-700 hover:shadow-xl"
					>
						Request Access
					</Button>
					<a
						href="#how-it-works"
						class="group flex items-center gap-2 border-b border-transparent pb-0.5 text-sm font-medium text-text-secondary transition-colors hover:border-primary-700 hover:text-primary-700"
					>
						See how it works
						<ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-1" />
					</a>
				</div>
			</div>
		</div>

		<!-- Background decorations (Pinned Notes) -->
		<div
			class="absolute top-1/2 left-4 hidden -translate-y-1/2 -rotate-6 cursor-help transition-transform duration-500 hover:-rotate-3 md:left-20 lg:block"
		>
			<PinnedNote color="red" rotate="-rotate-2">
				<div class="w-48 p-2 text-center">
					<p class="font-hand text-xl leading-tight text-ink">
						"I've stopped buying ingredients I already own."
					</p>
					<div class="mt-3 flex justify-center">
						<div class="h-1 w-12 rounded-full bg-border/50"></div>
					</div>
				</div>
			</PinnedNote>
		</div>

		<div
			class="absolute top-1/3 right-4 hidden -translate-y-1/2 rotate-6 cursor-help transition-transform duration-500 hover:rotate-3 md:right-20 lg:block"
		>
			<PinnedNote color="yellow" rotate="rotate-2">
				<div class="w-48 p-2 text-center">
					<p class="font-hand text-xl leading-tight text-ink">
						"Turns my kitchen chaos into a dinner menu."
					</p>
					<div class="mt-3 flex justify-center">
						<div class="h-1 w-12 rounded-full bg-border/50"></div>
					</div>
				</div>
			</PinnedNote>
		</div>
	</section>

	<!-- Feature Showcase (The Kitchen Counter) -->
	<section class="relative border-y border-[#EAE0D5] bg-[#FDFBF7] py-24">
		<!-- Texture Overlay -->
		<div
			class="pointer-events-none absolute inset-0 opacity-[0.4] mix-blend-multiply"
			style="background-image: url('data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' /%3E%3C/g%3E%3C/svg%3E');"
		></div>

		<div class="relative z-10 container mx-auto px-4">
			<div class="mx-auto grid max-w-6xl grid-cols-1 items-start gap-12 md:grid-cols-3">
				<!-- 1. The Receipt (Scanning) -->
				<div class="group relative flex flex-col items-center">
					<div
						class="relative w-full max-w-70 -rotate-2 bg-white shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:rotate-0 group-hover:shadow-xl"
					>
						<!-- Jagged Top -->
						<div
							class="h-4 bg-white"
							style="clip-path: polygon(0% 100%, 5% 0%, 10% 100%, 15% 0%, 20% 100%, 25% 0%, 30% 100%, 35% 0%, 40% 100%, 45% 0%, 50% 100%, 55% 0%, 60% 100%, 65% 0%, 70% 100%, 75% 0%, 80% 100%, 85% 0%, 90% 100%, 95% 0%, 100% 100%); margin-top: -16px;"
						></div>

						<div class="flex flex-col items-center space-y-4 p-6 pb-12 text-center">
							<div
								class="flex h-12 w-12 items-center justify-center rounded-full border-2 border-text-primary"
							>
								<ScanLine class="h-6 w-6 text-text-primary" />
							</div>
							<h3 class="font-display border-b-2 border-text-primary pb-1 text-2xl">RECEIPT</h3>
							<div class="w-full space-y-2 font-mono text-xs text-text-muted opacity-60">
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
							<p class="font-hand pt-2 text-lg leading-tight text-text-secondary">
								"Just drop a photo. We extract every ingredient automatically."
							</p>
						</div>

						<!-- Jagged Bottom -->
						<div
							class="absolute right-0 -bottom-4 left-0 h-4 bg-white"
							style="clip-path: polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%);"
						></div>
					</div>
				</div>

				<!-- 2. The Recipe Card (Generation) -->
				<div class="group relative mt-8 flex flex-col items-center md:mt-0">
					<div
						class="relative aspect-4/3 w-full max-w-[320px] rotate-1 border border-[#e5e0d0] bg-[#fffcf5] p-6 shadow-md transition-all duration-300 group-hover:scale-105 group-hover:rotate-0 group-hover:shadow-xl"
					>
						<!-- Washi Tape -->
						<div class="absolute -top-3 left-1/2 -translate-x-1/2">
							<WashiTape color="sage" />
						</div>

						<div class="flex h-full flex-col border border-dashed border-[#dcd0c0] p-4">
							<div class="mb-3 flex items-center gap-3 border-b border-[#dcd0c0] pb-2">
								<ChefHat class="h-5 w-5 text-text-muted" />
								<span class="font-display text-xl text-text-primary">Seasonal Pasta</span>
							</div>
							<div class="flex-1 space-y-2">
								<div class="h-2 w-3/4 rounded-full bg-[#eeeadd]"></div>
								<div class="h-2 w-full rounded-full bg-[#eeeadd]"></div>
								<div class="h-2 w-5/6 rounded-full bg-[#eeeadd]"></div>
								<div class="h-2 w-4/5 rounded-full bg-[#eeeadd]"></div>
							</div>
							<p class="font-hand mt-4 text-center text-lg text-text-secondary">
								"Recipes tailored to what you actually have."
							</p>
						</div>
					</div>
				</div>

				<!-- 3. The Notepad (Shopping) -->
				<div class="group relative mt-8 flex flex-col items-center md:mt-0">
					<div
						class="relative w-full max-w-65 -rotate-1 bg-[#fdf6e3] shadow-lg transition-all duration-300 group-hover:scale-105 group-hover:rotate-0 group-hover:shadow-xl"
					>
						<!-- Holes -->
						<div
							class="absolute top-0 left-0 flex h-8 w-full items-center justify-evenly border-b border-black/5"
						>
							<div class="h-3 w-3 rounded-full bg-[#333] opacity-10"></div>
							<div class="h-3 w-3 rounded-full bg-[#333] opacity-10"></div>
							<div class="h-3 w-3 rounded-full bg-[#333] opacity-10"></div>
						</div>

						<div class="relative flex min-h-75 flex-col px-6 pt-10 pb-8">
							<!-- Lines -->
							<div
								class="pointer-events-none absolute inset-0 top-10"
								style="background-image: linear-gradient(transparent 23px, #e5e7eb 24px); background-size: 100% 24px;"
							></div>

							<div class="relative z-10">
								<div class="mb-4 flex items-center gap-2">
									<ShoppingCart class="h-5 w-5 text-secondary-600" />
									<h3 class="font-hand text-2xl text-secondary-800">Shopping List</h3>
								</div>

								<ul class="font-hand ml-1 space-y-3 text-xl text-text-primary">
									<li class="flex items-center gap-2">
										<div class="h-4 w-4 rounded-sm border border-text-muted"></div>
										<span>Olive Oil</span>
									</li>
									<li class="flex items-center gap-2">
										<div class="h-4 w-4 rounded-sm border border-text-muted"></div>
										<span>Basil</span>
									</li>
									<li class="flex items-center gap-2 line-through opacity-50">
										<div class="h-4 w-4 rounded-sm border border-text-muted bg-text-muted/20"></div>
										<span>Garlic</span>
									</li>
								</ul>
								<p class="mt-8 font-sans text-sm leading-snug text-text-secondary italic">
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
	<section id="how-it-works" class="relative overflow-hidden bg-white py-24">
		<div class="relative z-10 container mx-auto px-4">
			<div class="mx-auto mb-20 max-w-3xl text-center">
				<h2 class="font-display mb-4 text-4xl text-text-primary md:text-5xl">
					From Receipt to Table
				</h2>
				<div class="mx-auto h-1 w-24 rounded-full bg-secondary-200"></div>
			</div>

			<div class="mx-auto max-w-6xl">
				<div
					class="relative flex flex-col items-center justify-between gap-12 md:flex-row md:gap-4"
				>
					<!-- Connector Line (Desktop SVG) -->
					<svg
						class="pointer-events-none absolute top-1/2 left-0 -z-10 hidden h-24 w-full -translate-y-1/2 text-border md:block"
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
					{#each [{ icon: Receipt, label: 'Scan', desc: 'Snap a photo', color: 'text-primary-600' }, { icon: Sparkles, label: 'Organize', desc: 'AI sorts ingredients', color: 'text-secondary-500' }, { icon: ChefHat, label: 'Cook', desc: 'Get recipes', color: 'text-primary-700' }, { icon: ShoppingCart, label: 'Shop', desc: 'Smart lists', color: 'text-blue-600' }] as step, i}
						<div class="group relative flex w-48 flex-col items-center text-center">
							<!-- Hand-drawn circle background -->
							<div
								class="relative mb-6 flex h-28 w-28 items-center justify-center transition-transform duration-300 group-hover:scale-110"
							>
								<svg
									class="absolute inset-0 h-full w-full text-[#f0ebe0] transition-colors group-hover:text-[#e8e2d2]"
									viewBox="0 0 100 100"
									fill="currentColor"
								>
									<path
										d="M46.5,96.5c-13.8,0-26.6-5.3-36.2-14.8C1.8,73.4-1.9,61.1,1.2,48.8c3.2-12.7,11.9-23.2,23.9-28.9 c11.5-5.4,24.9-5.4,36.9-0.9c12.3,4.6,22.2,14.2,27.1,26.4c5.1,12.8,4.1,27.4-2.8,39.2C81.4,79.5,71.2,87.9,59,92.5 C54.9,94,50.7,95.5,46.5,96.5z"
									/>
								</svg>
								<step.icon class={`h-10 w-10 ${step.color} relative z-10`} />
								<div
									class="font-hand absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-lg text-text-muted shadow-sm"
								>
									{i + 1}
								</div>
							</div>

							<h3 class="font-display mb-1 text-2xl text-text-primary">
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
	<section class="relative overflow-hidden border-t border-primary-100 bg-primary-50 py-32">
		<!-- Abstract Shapes -->
		<div
			class="absolute top-0 left-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-100/50 blur-3xl"
		></div>
		<div
			class="absolute right-0 bottom-0 h-96 w-96 translate-x-1/2 translate-y-1/2 rounded-full bg-secondary-100/50 blur-3xl"
		></div>

		<div class="relative z-10 container mx-auto px-4 text-center">
			<div class="mx-auto max-w-3xl space-y-10">
				<h2 class="font-display text-5xl leading-tight text-primary-900 md:text-6xl">
					Ready to empty your <br /> fridge?
				</h2>
				<p class="font-hand mx-auto max-w-xl text-2xl text-primary-800">
					Join the waiting list of home cooks who've simplified their meal planning with
					Receipt2Recipe.
				</p>
				<div class="pt-6">
					<Button
						href="/signup"
						size="lg"
						class="h-16 rounded-full bg-primary-600 px-12 text-xl text-white shadow-xl transition-all hover:-translate-y-1 hover:bg-primary-700 hover:shadow-2xl"
					>
						Request Access
					</Button>
				</div>
				<p class="pt-8 text-xs font-medium tracking-widest text-primary-600 uppercase">
					Limited spots available
				</p>
			</div>
		</div>
	</section>
</div>
