<script lang="ts">
	import OracleSpan from '$components/oracle-span.svelte';
	import type { DetailedCard } from '$lib';

	const { card }: { card: DetailedCard } = $props();
</script>

<div class="flex h-7 grow bg-foreground p-0.5 pl-0">
	<div class="flex grow justify-between bg-background px-1 text-sm">
		<span class="truncate">{card.name}</span>
		<OracleSpan text={card.mana_cost ?? ''} />
	</div>
</div>
