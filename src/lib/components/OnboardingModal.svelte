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

	type OnboardingState = 'active' | 'dismissed' | 'completed';

	const STORAGE_KEY = 'r2r_onboarding_state';
	const LEGACY_STORAGE_KEY = 'r2r_onboarding_dismissed';

	let onboardingState = $state<OnboardingState>('active');
	let forceOpen = $state(false);
	let hydrated = $state(false);

	const isFirstTimeUser = $derived(receiptCount === 0 && recipeCount === 0);
	const shouldShowOnboarding = $derived(
		browser && (forceOpen || (isFirstTimeUser && onboardingState === 'active'))
	);
	let showOnboarding = $state(false);

	// Current step in the workflow explanation
	let currentStep = $state(0);

	$effect(() => {
		if (!browser || hydrated) return;

		hydrated = true;
		forceOpen = new URLSearchParams(window.location.search).get('onboarding') === '1';

		const existingState = localStorage.getItem(STORAGE_KEY);
		if (!existingState && localStorage.getItem(LEGACY_STORAGE_KEY) === 'true') {
			localStorage.setItem(STORAGE_KEY, 'dismissed');
		}

		const storedState = localStorage.getItem(STORAGE_KEY);
		if (storedState === 'dismissed' || storedState === 'completed' || storedState === 'active') {
			onboardingState = storedState;
		} else {
			onboardingState = 'active';
			localStorage.setItem(STORAGE_KEY, 'active');
		}
	});

	$effect(() => {
		showOnboarding = shouldShowOnboarding;
	});

	$effect(() => {
		if (!browser || !hydrated) return;
		if (!showOnboarding && shouldShowOnboarding) {
			dismissOnboarding();
		}
	});

	const steps = [
		{
			icon: Upload,
			title: 'Receipts',
			description: "Drop a grocery receipt photo and we'll extract your items automatically.",
			cta: 'This is where your kitchen data starts.',
			actionLabel: 'Upload a receipt',
			actionHref: '/receipts/upload'
		},
		{
			icon: Warehouse,
			title: 'Cupboard',
			description:
				'Your scanned items land in your cupboard so you can track what you have and what is running low.',
			cta: 'Edit anything at any time.',
			actionLabel: 'Open cupboard',
			actionHref: '/cupboard'
		},
		{
			icon: ChefHat,
			title: 'Recipes',
			description:
				'Generate recipes based on what is already in your kitchen and your saved preferences.',
			cta: 'Use what you already bought first.',
			actionLabel: 'Generate recipe',
			actionHref: '/recipes/generate'
		},
		{
			icon: ShoppingCart,
			title: 'Shopping',
			description:
				'Missing ingredients can be added to your shopping list in one click while planning meals.',
			cta: 'Keep shopping fast and focused.',
			actionLabel: 'Open shopping list',
			actionHref: '/shopping'
		}
	];

	function clearOnboardingQuery() {
		if (!browser || !forceOpen) return;

		const nextUrl = new URL(window.location.href);
		nextUrl.searchParams.delete('onboarding');
		window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
	}

	function setOnboardingState(next: OnboardingState) {
		if (browser) {
			localStorage.setItem(STORAGE_KEY, next);
		}
		onboardingState = next;
		forceOpen = false;
		clearOnboardingQuery();
	}

	function dismissOnboarding() {
		setOnboardingState('dismissed');
	}

	function completeOnboarding() {
		setOnboardingState('completed');
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
	<AlertDialog.Content class="max-h-[90vh] w-[min(92vw,40rem)] overflow-y-auto sm:max-w-lg">
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

			<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
				<Button
					variant="outline"
					href={steps[currentStep].actionHref}
					onclick={() => setOnboardingState('dismissed')}
				>
					{steps[currentStep].actionLabel}
				</Button>

				{#if currentStep < steps.length - 1}
					<Button onclick={nextStep}>
						Next
						<ArrowRight class="ml-2 h-4 w-4" />
					</Button>
				{:else}
					<Button href="/shopping" onclick={completeOnboarding}>
						<ShoppingCart class="mr-2 h-4 w-4" />
						Finish tour
					</Button>
				{/if}
			</div>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
