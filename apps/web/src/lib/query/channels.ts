import { Channel } from '$lib/utils/channel';
import type { ClientEvent } from '$lib/query/client';
import type { QueryRequest, QueryResponse } from '$lib/query/local-worker';

export const QueryReqChannel = new Channel<QueryRequest>('cc-query-req');
export const QueryResChannel = new Channel<QueryResponse>('cc-query-res');
export const ClientEventsChannel = new Channel<ClientEvent>('cc-client-event');
