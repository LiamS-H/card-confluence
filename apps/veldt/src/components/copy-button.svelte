<script lang="ts" module>
	let copied = $state('');
</script>

<script lang="ts">
	import { type ButtonProps, Button } from '$components/ui/button';
	import { LibraryAdd, LibraryAddCheck } from '@material-symbols-svg/svelte/sharp';
	let { children, size, text, ...restProps }: { text: string } & Omit<ButtonProps, 'onclick'> =
		$props();
</script>

<Button
	{size}
	{...restProps}
	onclick={() => {
		navigator.clipboard
			.writeText(text)
			.then(() => {
				copied = text;
			})
			.catch((e) => console.error(e));
	}}
>
	{@render children()}
	{#if copied === text}
		<LibraryAddCheck class="h-2/3" />
	{:else}
		<LibraryAdd class="h-2/3" />
	{/if}
</Button>
