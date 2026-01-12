<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
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
		ChefHat
	} from 'lucide-svelte';

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

		if (!file.type.startsWith('image/')) {
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
			fileInput.value = '';
		}
	}
</script>

<svelte:head>
	<title>Upload Receipt - Receipt2Recipe</title>
</svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<div>
		<Button href="/receipts" variant="ghost" size="sm" class="-ml-2 mb-2">
			<ArrowLeft class="mr-1 h-4 w-4" />
			Back to receipts
		</Button>
		<div class="relative">
			<div
				class="absolute -left-4 -top-2 h-20 w-20 rounded-full bg-sage-100/50 blur-2xl"
			></div>
			<h1 class="font-serif text-3xl font-medium text-ink">Upload Receipt</h1>
			<p class="mt-1 text-ink-light">
				Snap it, drop it, and let us do the rest
			</p>
		</div>
	</div>

	<Card.Root class="overflow-hidden">
		<Card.Content class="pt-6">
			<form
				method="POST"
				enctype="multipart/form-data"
				use:enhance={() => {
					loading = true;
					return async ({ result }) => {
						loading = false;
						if (result.type === 'redirect') {
							goto(result.location);
						}
					};
				}}
				class="space-y-6"
			>
				{#if form?.error}
					<div class="rounded-lg bg-sienna-50 p-3 text-sm text-sienna-700">
						{form.error}
					</div>
				{/if}

				<div
					role="button"
					tabindex="0"
					class="relative rounded-xl border-2 border-dashed transition-colors {dragover
						? 'border-sage-500 bg-sage-50'
						: 'border-sand hover:border-sage-400'}"
					ondragover={(e) => {
						e.preventDefault();
						dragover = true;
					}}
					ondragleave={() => (dragover = false)}
					ondrop={handleDrop}
				>
					{#if preview}
						<div class="relative p-4">
							<div class="absolute inset-0 bg-gradient-to-b from-sage-100/30 to-transparent"></div>
							<img
								src={preview}
								alt="Receipt preview"
								class="relative mx-auto max-h-96 rounded-lg shadow-lg"
							/>
							<button
								type="button"
								onclick={clearPreview}
								class="absolute right-6 top-6 rounded-full bg-ink/80 p-2 text-paper transition-transform hover:scale-110 hover:bg-ink"
							>
								<X class="h-4 w-4" />
							</button>
							<div class="absolute bottom-6 left-1/2 -translate-x-1/2">
								<div class="flex items-center gap-2 rounded-full bg-sage-600 px-4 py-2 text-sm font-medium text-paper shadow-lg">
									<Sparkles class="h-4 w-4" />
									Looking good!
								</div>
							</div>
						</div>
					{:else}
						<label class="flex cursor-pointer flex-col items-center gap-4 p-12 transition-all {dragover ? 'scale-[1.02]' : ''}">
							<div class="relative">
								<div class="rounded-2xl bg-sage-100 p-5">
									<Upload class="h-10 w-10 text-sage-600" />
								</div>
								{#if dragover}
									<div class="absolute -right-1 -top-1">
										<Sparkles class="h-5 w-5 animate-pulse text-sage-500" />
									</div>
								{/if}
							</div>
							<div class="text-center">
								<p class="font-serif text-xl font-medium text-ink">
									{dragover ? 'Drop it like it\'s hot!' : 'Drop your receipt here'}
								</p>
								<p class="mt-1 text-sm text-ink-light">or click to browse your files</p>
								<p class="mt-3 text-xs text-ink-muted">PNG, JPG, or HEIC up to 10MB</p>
							</div>
							<input
								bind:this={fileInput}
								type="file"
								name="receipt"
								accept="image/*"
								class="hidden"
								onchange={handleFileChange}
								required
							/>
						</label>
					{/if}
				</div>

				<div class="flex gap-3">
					<Button type="button" variant="outline" href="/receipts" class="flex-1">Cancel</Button>
					<Button type="submit" disabled={loading || !preview} class="flex-1">
						{#if loading}
							Processing...
						{:else}
							<Image class="mr-2 h-4 w-4" />
							Upload & Scan
						{/if}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	<Card.Root class="border-sage-200 bg-gradient-to-br from-sage-50 to-paper">
		<Card.Content class="pt-6">
			<div class="flex items-center gap-2">
				<Camera class="h-5 w-5 text-sage-600" />
				<h3 class="font-serif text-lg font-medium text-ink">Quick tips for a perfect scan</h3>
			</div>
			<div class="mt-4 grid gap-3 sm:grid-cols-2">
				<div class="flex items-start gap-3">
					<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sage-100">
						<Sun class="h-4 w-4 text-sage-600" />
					</div>
					<div>
						<p class="text-sm font-medium text-ink">Good lighting</p>
						<p class="text-xs text-ink-muted">Natural light works best</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sage-100">
						<ScanLine class="h-4 w-4 text-sage-600" />
					</div>
					<div>
						<p class="text-sm font-medium text-ink">Full receipt</p>
						<p class="text-xs text-ink-muted">Capture all the edges</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sage-100">
						<Camera class="h-4 w-4 text-sage-600" />
					</div>
					<div>
						<p class="text-sm font-medium text-ink">Sharp focus</p>
						<p class="text-xs text-ink-muted">Steady hands, clear text</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sage-100">
						<Layers class="h-4 w-4 text-sage-600" />
					</div>
					<div>
						<p class="text-sm font-medium text-ink">Flat surface</p>
						<p class="text-xs text-ink-muted">No wrinkles or folds</p>
					</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- What happens next -->
	<div class="flex items-center justify-center gap-6 text-center text-sm text-ink-muted">
		<div class="flex items-center gap-2">
			<div class="flex h-6 w-6 items-center justify-center rounded-full bg-sage-100 text-xs font-medium text-sage-700">1</div>
			<span>Upload</span>
		</div>
		<div class="h-px w-8 bg-sand"></div>
		<div class="flex items-center gap-2">
			<div class="flex h-6 w-6 items-center justify-center rounded-full bg-paper-dark text-xs font-medium text-ink-muted">2</div>
			<span>We scan it</span>
		</div>
		<div class="h-px w-8 bg-sand"></div>
		<div class="flex items-center gap-2">
			<div class="flex h-6 w-6 items-center justify-center rounded-full bg-paper-dark text-xs font-medium text-ink-muted">3</div>
			<span>Recipes unlocked</span>
			<ChefHat class="h-4 w-4" />
		</div>
	</div>
</div>
