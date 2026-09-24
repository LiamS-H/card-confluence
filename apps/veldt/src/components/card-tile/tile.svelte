<script lang="ts">
	import OracleSpan from '$components/oracle-span.svelte';
	import type { DetailedCard } from '$lib';

	const { card, width }: { card: DetailedCard; width: string | number } = $props();
</script>

<div class="flex h-7 grow bg-foreground p-1 pl-0" style={`width:${width}px`}>
	<div class="flex grow justify-between bg-background text-sm">
		<span class="truncate px-2">{card.name}</span>
		<OracleSpan class="h-7" text={card.mana_cost ?? ''} />
	</div>
</div>
