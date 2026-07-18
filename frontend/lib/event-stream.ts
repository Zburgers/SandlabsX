import { afterEventCursor } from './capsule-api';
import type { OperationEvent } from './capsule-types';

const durableEventTypes = ['OPERATION_QUEUED', 'OPERATION_STARTED', 'OPERATION_PROGRESS', 'OPERATION_SUCCEEDED', 'OPERATION_FAILED', 'OPERATION_CANCELLED'];

export function capsuleEventCursor(events: Pick<OperationEvent, 'cursor'>[]): number | undefined { return events.at(-1)?.cursor; }

export function normalizeDurableEvent(event: Pick<MessageEvent<string>, 'lastEventId' | 'type' | 'data'>): OperationEvent {
  const cursor = Number(event.lastEventId);
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error('Durable event cursor must be a non-negative integer');
  return { cursor, type: event.type, payload: JSON.parse(event.data) as unknown };
}

export function connectResumableEvents(cursor: number | undefined, onEvent: (event: OperationEvent) => void): () => void {
  const source = new EventSource(cursor === undefined ? '/api/v2/events' : `/api${afterEventCursor(cursor)}`);
  const receive = (event: MessageEvent<string>) => onEvent(normalizeDurableEvent(event));
  source.onmessage = receive;
  durableEventTypes.forEach(type => source.addEventListener(type, receive));
  return () => source.close();
}
