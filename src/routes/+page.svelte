<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Receipt, ChefHat, ShoppingCart, Sparkles } from 'lucide-svelte';

	let { data } = $props();

	const features = [
		{
			icon: Receipt,
			title: 'Scan Receipts',
			description:
				'Upload your grocery receipts and let AI extract all the items automatically.'
		},
		{
			icon: ChefHat,
			title: 'Generate Recipes',
			description:
				'Get personalized recipe suggestions based on your purchased ingredients.'
		},
		{
			icon: ShoppingCart,
			title: 'Smart Shopping',
			description:
				'Never forget an item with intelligent shopping lists based on your habits.'
		},
		{
			icon: Sparkles,
			title: 'Dietary Preferences',
			description:
				'Customize recipes to match your allergies, restrictions, and calorie goals.'
		}
	];
</script>

<svelte:head>
	<title>Receipt2Recipe - Transform Groceries into Meals</title>
</svelte:head>

<div class="flex flex-col items-center">
	<!-- Hero Section -->
	<section class="py-12 text-center md:py-20">
		<h1 class="font-serif text-4xl font-medium tracking-tight text-ink md:text-5xl lg:text-6xl">
			Your Kitchen,<br />
			<span class="text-sage-600">Reimagined</span>
		</h1>
		<p class="mx-auto mt-6 max-w-2xl text-lg text-ink-light">
			Transform your grocery receipts into delicious recipes. Powered by AI, designed for home cooks
			who want to make the most of their ingredients.
		</p>

		{#if !data.user}
			<div class="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
				<Button size="lg" href="/register" class="w-full sm:w-auto">Get Started Free</Button>
				<Button size="lg" variant="outline" href="/login" class="w-full sm:w-auto">
					Sign In
				</Button>
			</div>
		{:else}
			<div class="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
				<Button size="lg" href="/receipts/upload" class="w-full sm:w-auto">
					<Receipt class="mr-2 h-5 w-5" />
					Upload Receipt
				</Button>
				<Button size="lg" variant="outline" href="/recipes" class="w-full sm:w-auto">
					<ChefHat class="mr-2 h-5 w-5" />
					View Recipes
				</Button>
			</div>
		{/if}
	</section>

	<!-- Features Section -->
	<section class="w-full py-12">
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
			{#each features as feature}
				<Card.Root class="border-sand bg-paper transition-shadow hover:shadow-md">
					<Card.Header>
						<div
							class="flex h-12 w-12 items-center justify-center rounded-xl bg-sage-100 text-sage-600"
						>
							<feature.icon class="h-6 w-6" />
						</div>
					</Card.Header>
					<Card.Content>
						<Card.Title class="font-serif text-xl">{feature.title}</Card.Title>
						<Card.Description class="mt-2">{feature.description}</Card.Description>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	</section>

	<!-- How It Works Section -->
	{#if !data.user}
		<section class="w-full py-12">
			<h2 class="mb-8 text-center font-serif text-3xl font-medium text-ink">How It Works</h2>

			<div class="grid gap-8 md:grid-cols-3">
				<div class="text-center">
					<div
						class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-lg font-medium text-paper"
					>
						1
					</div>
					<h3 class="font-serif text-xl font-medium text-ink">Upload Your Receipt</h3>
					<p class="mt-2 text-ink-light">
						Snap a photo of your grocery receipt. Our AI extracts all items automatically.
					</p>
				</div>

				<div class="text-center">
					<div
						class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-lg font-medium text-paper"
					>
						2
					</div>
					<h3 class="font-serif text-xl font-medium text-ink">Set Preferences</h3>
					<p class="mt-2 text-ink-light">
						Tell us about your dietary needs, allergies, and favorite cuisines.
					</p>
				</div>

				<div class="text-center">
					<div
						class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-lg font-medium text-paper"
					>
						3
					</div>
					<h3 class="font-serif text-xl font-medium text-ink">Get Recipes</h3>
					<p class="mt-2 text-ink-light">
						Receive personalized recipe suggestions with beautiful AI-generated images.
					</p>
				</div>
			</div>
		</section>
	{/if}
</div>
