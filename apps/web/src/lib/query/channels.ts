import { Channel } from '$lib/utils/channel';
import type { QueryWorkerEvent, QueryWorkerResponse } from '$lib/query/local-worker';
import type { QueryRequest } from './client';

export const QueryReqChannel = new Channel<QueryRequest>('cc-query-req');
export const QueryResChannel = new Channel<QueryWorkerResponse>('cc-query-res');
export const QueryEventsChannel = new Channel<QueryWorkerEvent>('cc-client-event');
