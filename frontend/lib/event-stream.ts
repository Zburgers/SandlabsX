import type { OperationEvent } from './capsule-types';

export function capsuleEventCursor(events: Pick<OperationEvent, 'id'>[]): string | undefined { return events.at(-1)?.id; }

export function connectResumableEvents(url: string, lastEventId: string | undefined, onEvent: (event: OperationEvent) => void): () => void {
  const source = new EventSource(lastEventId ? `${url}${url.includes('?') ? '&' : '?'}lastEventId=${encodeURIComponent(lastEventId)}` : url);
  source.onmessage = event => onEvent(JSON.parse(event.data) as OperationEvent);
  return () => source.close();
}
