<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { AlertDialog as AlertDialogPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: AlertDialogPrimitive.DescriptionProps = $props();
</script>

<AlertDialogPrimitive.Description
	bind:ref
	class={cn("text-sm text-ink-muted", className)}
	{...restProps}
>
	{@render children?.()}
</AlertDialogPrimitive.Description>
