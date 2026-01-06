<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Upload, Image, X } from 'lucide-svelte';

	let { form } = $props();
	let loading = $state(false);
	let dragover = $state(false);
	let preview = $state<string | null>(null);
	let fileInput: HTMLInputElement;

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
		<h1 class="font-serif text-3xl font-medium text-ink">Upload Receipt</h1>
		<p class="mt-1 text-ink-light">Upload a photo of your grocery receipt</p>
	</div>

	<Card.Root>
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
							<img src={preview} alt="Receipt preview" class="mx-auto max-h-96 rounded-lg" />
							<button
								type="button"
								onclick={clearPreview}
								class="absolute right-6 top-6 rounded-full bg-ink/80 p-1 text-paper hover:bg-ink"
							>
								<X class="h-4 w-4" />
							</button>
						</div>
					{:else}
						<label class="flex cursor-pointer flex-col items-center gap-4 p-12">
							<div class="rounded-full bg-sage-100 p-4">
								<Upload class="h-8 w-8 text-sage-600" />
							</div>
							<div class="text-center">
								<p class="font-medium text-ink">Drop your receipt here or click to upload</p>
								<p class="mt-1 text-sm text-ink-light">PNG, JPG, or HEIC up to 10MB</p>
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

	<Card.Root class="border-sage-200 bg-sage-50">
		<Card.Content class="pt-6">
			<h3 class="font-medium text-ink">Tips for best results</h3>
			<ul class="mt-2 space-y-1 text-sm text-ink-light">
				<li>Make sure the receipt is well-lit and in focus</li>
				<li>Include the entire receipt in the photo</li>
				<li>Avoid shadows and reflections</li>
				<li>Place the receipt on a flat, contrasting surface</li>
			</ul>
		</Card.Content>
	</Card.Root>
</div>
