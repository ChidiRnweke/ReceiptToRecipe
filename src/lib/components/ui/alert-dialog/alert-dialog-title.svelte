<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { AlertDialog as AlertDialogPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: AlertDialogPrimitive.TitleProps = $props();
</script>

<AlertDialogPrimitive.Title
	bind:ref
	class={cn("text-lg font-semibold text-ink", className)}
	{...restProps}
>
	{@render children?.()}
</AlertDialogPrimitive.Title>
