import { Channel } from '$lib/utils/channel';
import type {
	QueryWorkerEvent,
	QueryWorkerRequest,
	QueryWorkerResponse
} from '$lib/card-confluence/query-worker/shared';

export const QueryReqChannel = new Channel<QueryWorkerRequest>('cc-query-req');
export const QueryResChannel = new Channel<QueryWorkerResponse>('cc-query-res');
export const QueryEventsChannel = new Channel<QueryWorkerEvent>('cc-client-event');
