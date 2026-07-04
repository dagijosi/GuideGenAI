import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ProgressEvent } from '../types';

export function useProgress(projectId: string | null) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [latest, setLatest] = useState<ProgressEvent | null>(null);
  const [livePageCount, setLivePageCount] = useState<number | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const socket: Socket = io(
      (import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000') + '/progress',
      { transports: ['websocket'] },
    );

    socket.on(`progress:${projectId}`, (event: ProgressEvent) => {
      setLatest(event);
      setEvents((prev) => [...prev.slice(-99), event]);
      // Track the highest page count seen in any event
      if (event.pageCount !== undefined) {
        setLivePageCount((prev) => Math.max(prev ?? 0, event.pageCount!));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId]);

  const clear = () => {
    setEvents([]);
    setLatest(null);
    setLivePageCount(null);
  };

  return { events, latest, livePageCount, clear };
}
