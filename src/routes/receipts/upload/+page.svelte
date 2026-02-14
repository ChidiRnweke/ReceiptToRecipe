<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
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
		Paperclip
	} from 'lucide-svelte';
	import WashiTape from '$lib/components/WashiTape.svelte';

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

<div class="relative min-h-screen overflow-x-hidden bg-bg-paper p-6 md:p-10">
	<!-- Desk Texture (Subtle Noise) -->
	<div
		class="pointer-events-none absolute inset-0 opacity-[0.03]"
		style="background-image: url('https://www.transparenttextures.com/patterns/cardboard-flat.png')"
	></div>

	<div class="relative z-10 mx-auto max-w-3xl">
		<div class="mb-8 flex items-center justify-between">
			<Button
				href="/receipts"
				variant="ghost"
				class="hidden pl-0 font-serif text-text-muted hover:bg-transparent hover:text-text-primary md:inline-flex"
			>
				<ArrowLeft class="mr-2 h-4 w-4" />
				Back to Ledger
			</Button>
		</div>

		<div class="mb-10 text-center">
			<h1 class="font-display mb-2 text-4xl text-ink">The Inbox</h1>
			<p class="font-serif text-ink-light italic">Drop your receipts here for processing.</p>
		</div>

		<div class="flex flex-col-reverse gap-8 md:flex-col">
			<!-- Tips Note (Sticky Note Style) - Moved above on mobile -->
			<div class="order-1 mx-auto max-w-2xl rotate-1 transform md:order-2">
				<div class="relative border border-yellow-200 bg-yellow-50 p-6 shadow-sm">
					<div class="absolute -top-3 left-1/2 -translate-x-1/2">
						<WashiTape color="yellow" width="w-24" />
					</div>

					<h3
						class="font-ui mt-2 mb-6 text-center text-xs tracking-widest text-text-muted uppercase"
					>
						Scanning Guidelines
					</h3>

					<div class="grid grid-cols-2 gap-6">
						<div class="flex items-start gap-3">
							<Sun class="mt-0.5 h-5 w-5 text-amber-500" />
							<div>
								<p class="font-serif text-sm font-bold text-ink">Lighting</p>
								<p class="font-serif text-xs text-ink-light">Ensure scanned items are well-lit.</p>
							</div>
						</div>
						<div class="flex items-start gap-3">
							<Layers class="mt-0.5 h-5 w-5 text-amber-500" />
							<div>
								<p class="font-serif text-sm font-bold text-ink">Flat</p>
								<p class="font-serif text-xs text-ink-light">Flatten wrinkles for better OCR.</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Main Drop Zone Container -->
			<div
				class="relative order-2 rotate-1 rounded-sm border border-border bg-white p-2 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] transition-transform duration-300 hover:rotate-0 md:order-1"
			>
				<!-- Washi Tape Decor -->
				<WashiTape
					color="sage"
					class="absolute -top-3 left-1/2 z-20 w-32 -translate-x-1/2 shadow-sm"
				/>

				<div
					class="relative flex min-h-70 flex-col items-center justify-center rounded-sm border-2 border-dashed border-border bg-bg-card p-8 transition-colors duration-300 md:min-h-100 {dragover
						? 'border-primary-400 bg-primary-50'
						: ''}"
				>
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
						class="flex h-full w-full flex-col items-center justify-center"
					>
						{#if form?.error}
							<div
								class="absolute top-4 right-4 left-4 rotate-1 border border-sienna-200 bg-sienna-50 p-3 text-center font-serif text-sm text-sienna-800 shadow-sm"
							>
								<Paperclip class="mr-2 inline h-4 w-4" />
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
							class="flex h-full w-full flex-col items-center justify-center outline-none"
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
								<div
									class="relative mx-auto w-full max-w-sm -rotate-2 transform transition-transform duration-500 hover:rotate-0"
								>
									<div class="border border-border/50 bg-white p-3 pb-12 shadow-lg">
										<img
											src={preview}
											alt="Receipt preview"
											class="h-auto w-full contrast-125 grayscale-[0.1] filter"
										/>
										<div class="font-hand absolute right-4 bottom-4 text-xl text-text-muted">
											Receipt #{Math.floor(Math.random() * 1000)}
										</div>
									</div>

									<button
										type="button"
										onclick={(e) => {
											e.stopPropagation();
											clearPreview();
										}}
										class="absolute -top-3 -right-3 z-30 rounded-full bg-white p-2 text-text-muted shadow-md transition-colors hover:bg-red-50 hover:text-red-500"
									>
										<X class="h-4 w-4" />
									</button>
								</div>

								<div class="mt-8 flex flex-col items-center gap-3">
									<Button
										type="submit"
										disabled={loading}
										size="lg"
										class="font-display bg-text-primary px-8 text-lg text-white shadow-md hover:bg-text-secondary"
									>
										{#if loading}
											<ScanLine class="mr-2 h-4 w-4 animate-pulse" />
											Scanning...
										{:else}
											Process Receipt
										{/if}
									</Button>
									<p class="font-serif text-xs text-text-muted italic">
										We'll extract ingredients and add them to your kitchen.
									</p>
								</div>
							{:else}
								<div class="pointer-events-none flex flex-col items-center gap-6">
									<div
										class="flex h-24 w-24 items-center justify-center rounded-full border border-border bg-bg-hover shadow-inner"
									>
										<Upload class="h-10 w-10 text-text-muted" />
									</div>
									<div class="space-y-2 text-center">
										<h3 class="font-hand text-3xl text-ink">
											{dragover ? 'Drop it here!' : 'Place receipt here'}
										</h3>
										<p class="hidden font-serif text-sm text-text-muted md:block">
											Click to browse or drag & drop
										</p>
										<p class="font-serif text-sm text-text-muted md:hidden">
											Tap to take a photo or select from library
										</p>
									</div>
								</div>
							{/if}
						</div>
					</form>
				</div>
			</div>
		</div>
	</div>
</div>
