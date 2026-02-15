<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Upload, Warehouse, ChefHat, ShoppingCart, ArrowRight, X } from 'lucide-svelte';
	import { browser } from '$app/environment';

	type Props = {
		receiptCount: number;
		recipeCount: number;
	};

	let { receiptCount, recipeCount }: Props = $props();

	const STORAGE_KEY = 'r2r_onboarding_dismissed';

	// Check if onboarding was already dismissed
	let dismissed = $state(browser ? localStorage.getItem(STORAGE_KEY) === 'true' : true);

	// Show onboarding if user is new (0 receipts) and hasn't dismissed
	let showOnboarding = $derived(!dismissed && receiptCount === 0);

	// Current step in the workflow explanation
	let currentStep = $state(0);

	const steps = [
		{
			icon: Upload,
			title: 'Scan Your Receipt',
			description:
				"Drop a photo of your grocery receipt. We'll extract and organize all your purchased items automatically.",
			cta: "This tells us what's in your kitchen."
		},
		{
			icon: Warehouse,
			title: 'Stock Your Cupboard',
			description:
				'Your scanned items fill your cupboard. We track what you have, estimate when things run low, and show you why we think so.',
			cta: 'You can always correct us if we get it wrong.'
		},
		{
			icon: ChefHat,
			title: 'Generate Recipes',
			description:
				"Get personalized recipe suggestions based on what you have. We'll prioritize ingredients in your kitchen.",
			cta: "Cook with what you've got!"
		},
		{
			icon: ShoppingCart,
			title: 'Smart Shopping Lists',
			description:
				"Missing ingredients? Add them to your shopping list with one click. We'll even suggest restocks.",
			cta: 'Never forget an ingredient again.'
		}
	];

	function dismissOnboarding() {
		if (browser) {
			localStorage.setItem(STORAGE_KEY, 'true');
		}
		dismissed = true;
	}

	function nextStep() {
		if (currentStep < steps.length - 1) {
			currentStep++;
		}
	}

	function prevStep() {
		if (currentStep > 0) {
			currentStep--;
		}
	}
</script>

<AlertDialog.Root bind:open={showOnboarding}>
	<AlertDialog.Content class="max-w-md">
		<button
			onclick={dismissOnboarding}
			class="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
		>
			<X class="h-4 w-4" />
			<span class="sr-only">Close</span>
		</button>

		<div class="text-center">
			<!-- Step indicator -->
			<div class="mb-6 flex justify-center gap-2">
				{#each steps as step, i}
					<button
						onclick={() => (currentStep = i)}
						aria-label="Go to step {i + 1}: {step.title}"
						class="h-2 w-2 rounded-full transition-all {i === currentStep
							? 'w-6 bg-sage-600'
							: 'bg-stone-200 hover:bg-stone-300'}"
					></button>
				{/each}
			</div>

			<!-- Current step content -->
			<AlertDialog.Header>
				<div class="space-y-4">
					<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-50">
						{#key currentStep}
							{@const Icon = steps[currentStep].icon}
							<Icon class="h-8 w-8 text-sage-600" />
						{/key}
					</div>

					<div class="space-y-2">
						<p class="font-mono text-xs tracking-widest text-ink-muted uppercase">
							Step {currentStep + 1} of {steps.length}
						</p>
						<AlertDialog.Title class="font-display text-center text-2xl text-ink">
							{steps[currentStep].title}
						</AlertDialog.Title>
					</div>

					<AlertDialog.Description class="text-center text-sm leading-relaxed text-ink-light">
						{steps[currentStep].description}
					</AlertDialog.Description>

					<p class="text-xs font-medium text-sage-600 italic">{steps[currentStep].cta}</p>
				</div>
			</AlertDialog.Header>
		</div>

		<AlertDialog.Footer class="mt-6 flex-col gap-2 sm:flex-row sm:justify-between">
			{#if currentStep > 0}
				<Button variant="ghost" onclick={prevStep}>Back</Button>
			{:else}
				<AlertDialog.Cancel onclick={dismissOnboarding} class="mt-0">Skip tour</AlertDialog.Cancel>
			{/if}

			{#if currentStep < steps.length - 1}
				<Button onclick={nextStep}>
					Next
					<ArrowRight class="ml-2 h-4 w-4" />
				</Button>
			{:else}
				<Button href="/receipts/upload" onclick={dismissOnboarding}>
					<Upload class="mr-2 h-4 w-4" />
					Start Scanning
				</Button>
			{/if}
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
