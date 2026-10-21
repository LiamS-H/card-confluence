<script lang="ts">
	import { TagDoc } from '$components/tag-doc';
	import { TagDocState } from '$lib/editor';
	import type { TemplateStruct } from '@repo/schema-sync';

	const { template }: { template: TemplateStruct } = $props();

	const doc_state = $derived.by(() => {
		return new TagDocState(template.get('template'), () => {});
	});
</script>

<TagDoc {doc_state} />
