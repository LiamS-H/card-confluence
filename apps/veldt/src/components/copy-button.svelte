<script lang="ts">
	import { type ButtonProps, Button } from '$components/ui/button';
	import {
		LibraryAdd,
		LibraryAddCheck,
		ProgressActivity
	} from '@material-symbols-svg/svelte/sharp';
	let { children, size, text, ...restProps }: { text: string } & Omit<ButtonProps, 'onclick'> =
		$props();

	let copied: boolean | null = $state(false);
</script>

<Button
	{size}
	{...restProps}
	onclick={() => {
		copied = null;
		navigator.clipboard
			.writeText(text)
			.then(() => {
				copied = true;
				setTimeout(() => {
					copied = false;
				}, 500);
			})
			.catch((e) => console.error(e));
	}}
>
	{@render children()}
	{#if copied === null}
		<ProgressActivity class="h-2/3" />
	{:else if copied}
		<LibraryAddCheck class="h-2/3" />
	{:else}
		<LibraryAdd class="h-2/3" />
	{/if}
</Button>
