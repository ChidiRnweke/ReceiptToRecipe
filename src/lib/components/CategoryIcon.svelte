<script lang="ts">
	import {
		Carrot,
		Milk,
		Beef,
		Fish,
		Wheat,
		Snowflake,
		Package,
		Croissant,
		Coffee,
		Cookie,
		SprayCan,
		Egg,
		LeafyGreen
	} from 'lucide-svelte';
	import { cn } from '$lib/utils';

	let { category, class: className = 'h-4 w-4' } = $props<{
		category: string | null;
		class?: string;
	}>();

	const normalized = $derived((category || '').toLowerCase());
</script>

{#if normalized.includes('produce') || normalized.includes('vegetable') || normalized.includes('fruit')}
	<Carrot class={cn(className)} />
{:else if normalized.includes('dairy') || normalized.includes('milk') || normalized.includes('yogurt')}
	<Milk class={cn(className)} />
{:else if normalized.includes('meat') || normalized.includes('chicken')}
	<Beef class={cn(className)} />
{:else if normalized.includes('seafood') || normalized.includes('fish')}
	<Fish class={cn(className)} />
{:else if normalized.includes('frozen')}
	<Snowflake class={cn(className)} />
{:else if normalized.includes('pantry') || normalized.includes('canned')}
	<Wheat class={cn(className)} />
{:else if normalized.includes('bakery') || normalized.includes('bread')}
	<Croissant class={cn(className)} />
{:else if normalized.includes('beverage') || normalized.includes('drink')}
	<Coffee class={cn(className)} />
{:else if normalized.includes('snack')}
	<Cookie class={cn(className)} />
{:else if normalized.includes('household') || normalized.includes('cleaning')}
	<SprayCan class={cn(className)} />
{:else if normalized.includes('egg')}
	<Egg class={cn(className)} />
{:else if normalized === 'other'}
	<LeafyGreen class={cn(className)} />
{:else}
	<Package class={cn(className)} />
{/if}
