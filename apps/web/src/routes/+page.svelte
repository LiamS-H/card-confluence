<script lang="ts">
	import { query_client } from '$lib/query/client';
</script>

<h1>CC</h1>
<button
	onclick={async () => {
		const resp = await query_client.query({ query: 't:instant cmc=0' });
		console.log(resp);
	}}
>
	query
</button>
