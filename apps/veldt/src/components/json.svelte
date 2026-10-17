<script lang="ts" module>
	let search = $state('');
</script>

<script lang="ts">
	import { Input } from '$components/ui/input';
	import { Button } from './ui/button';

	const { json }: { json: string } = $props();
	let pre: HTMLPreElement;

	let index = $state(0);
	const parsed = $derived.by(() => {
		const needle = search.toLowerCase();
		const haystack = json.toLowerCase();

		const segments: { text: string; match: number }[] = [];

		let last = 0;
		let count = 0;

		let i;

		while ((i = haystack.indexOf(needle, last)) && i !== -1) {
			if (i > last) {
				segments.push({ text: json.slice(last, i), match: 0 });
			}
			segments.push({ text: json.slice(i, i + needle.length), match: ++count });
			last = i + needle.length;
		}
		if (last < json.length) segments.push({ text: json.slice(last), match: 0 });

		return { segments, count };
	});

	function step(inc: number) {
		if (!parsed.count) return;
		index = (index + inc + parsed.count + 1) % (parsed.count + 1);
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		step(e.shiftKey ? -1 : 1);
	}

	$effect(() => {
		parsed;
		pre
			?.querySelector(`mark[data-match="${index}"]`)
			?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
	});
</script>

<div class="sticky top-0 flex w-fit bg-background">
	<Input
		variant="outline"
		class="pl-1"
		bind:value={search}
		focus
		placeholder="search"
		oninput={() => (index = 0)}
		{onkeydown}
	/>
	{const disabled = $derived(parsed.count === 0)}
	<Button {disabled} onclick={() => step(-1)}>-</Button>
	<span
		class={`flex h-10 items-center justify-center border-2 border-foreground px-2 ${disabled ? 'opacity-50' : ''}`}
		>{index}/{parsed.count}</span
	>
	<Button {disabled} onclick={() => step(1)}>+</Button>
</div>

<pre
	bind:this={pre}
	class="w-full overflow-x-auto">{#each parsed.segments as s}{#if s.match === 0}{s.text}{:else}<mark
				data-match={s.match}
				data-current={s.match === index ? '' : undefined}
				class="scroll-mt-12 bg-secondary text-foreground data-current:bg-primary data-current:text-primary-foreground"
				>{s.text}</mark
			>{/if}{/each}</pre>
