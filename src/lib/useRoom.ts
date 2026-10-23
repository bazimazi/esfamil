import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Answers, CategoryId } from '../../shared/game';
import type { ActionResponse, GameConfig, RoomSnapshot } from '../../shared/protocol';

type Credential = { code: string; token: string };
export type DraftStatus = 'saved' | 'saving' | 'unsaved';
const SESSION_KEY = 'esfamil:room';
function savedCredential(): Credential | null {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (typeof saved !== 'object' || saved === null) return null;
    const candidate = saved as Partial<Credential>;
    return typeof candidate.code === 'string' &&
      /^[A-Z2-9]{5}$/.test(candidate.code) &&
      typeof candidate.token === 'string' &&
      /^[a-f0-9]{64}$/.test(candidate.token)
      ? { code: candidate.code, token: candidate.token }
      : null;
  } catch {
    return null;
  }
}
function forgetCredential() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* optional persistence */
  }
}
export function useRoom() {
  const socket = useRef<Socket | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [clockOffset, setClockOffset] = useState(0);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('saved');
  const draftRequestId = useRef(0);
  const draftRound = useRef('');
  const credential = useRef(savedCredential());
  const mounted = useRef(false);
  const leaving = useRef(false);
  const generation = useRef(0);
  const ready = useRef<Promise<void>>(Promise.resolve());

  const receive = useCallback((state: RoomSnapshot) => {
    if (leaving.current) return;
    setClockOffset(state.serverNow - Date.now());
    const roundKey = `${state.room.code}:${state.room.round}`;
    if (draftRound.current !== roundKey) {
      // A new round starts from its own server draft. Ordinary room broadcasts
      // must not mark a newer, unacknowledged local edit as saved.
      draftRound.current = roundKey;
      draftRequestId.current++;
      setDraftStatus('saved');
    }
    credential.current = { code: state.room.code, token: state.token };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(credential.current));
    } catch {
      /* optional persistence */
    }
    setSnapshot(state);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const client = io(import.meta.env.VITE_SERVER_URL || undefined, {
      autoConnect: false,
      timeout: 8000,
      transports: ['websocket'],
    });
    socket.current = client;
    client.on('connect', () => {
      setConnected(true);
      setError('');
      const connectionGeneration = generation.current;
      // Requests must wait until this connection has restored its player identity.
      ready.current = new Promise<void>((resolve) => {
        if (!credential.current || leaving.current) {
          resolve();
          return;
        }
        client
          .timeout(8000)
          .emit(
            'room:resume',
            credential.current,
            (err: Error | null, response: ActionResponse) => {
              if (
                socket.current !== client ||
                leaving.current ||
                connectionGeneration !== generation.current
              ) {
                resolve();
                return;
              }
              if (err) {
                setError('ارتباط برقرار نشد. دوباره تلاش کن.');
                client.disconnect();
              } else if (response.ok && response.snapshot) receive(response.snapshot);
              else if (!response.ok) {
                setError(response.error);
                setSnapshot(null);
                credential.current = null;
                forgetCredential();
              }
              resolve();
            },
          );
      });
    });
    client.on('disconnect', () => {
      setConnected(false);
      draftRequestId.current++;
      setDraftStatus('unsaved');
    });
    client.on('connect_error', () => {
      setConnected(false);
      setError('به سرور وصل نشدیم. اینترنت و اجرای سرور بازی را بررسی کن.');
    });
    client.on('room:state', receive);
    client.on('room:closed', ({ reason }: { reason: string }) => {
      generation.current++;
      draftRequestId.current++;
      draftRound.current = '';
      setDraftStatus('unsaved');
      setSnapshot(null);
      setError(reason);
      credential.current = null;
      forgetCredential();
    });
    if (credential.current) client.connect();
    return () => {
      mounted.current = false;
      generation.current++;
      client.removeAllListeners();
      client.disconnect();
      socket.current = null;
    };
  }, [receive]);

  const markDraftDirty = useCallback(() => {
    draftRequestId.current++;
    setDraftStatus('unsaved');
  }, []);

  const request = useCallback(
    async (event: string, payload?: unknown, quiet = false): Promise<boolean> => {
      const client = socket.current;
      if (!client || leaving.current) return false;
      const currentGeneration = generation.current;
      if (!quiet) {
        setBusy(true);
        setError('');
      }
      try {
        if (!client.connected) {
          await new Promise<void>((resolve, reject) => {
            const cleanup = () => {
              client.off('connect', success);
              client.off('connect_error', fail);
              clearTimeout(timer);
            };
            const success = () => {
              cleanup();
              resolve();
            };
            const fail = () => {
              cleanup();
              reject(new Error('اتصال به سرور ممکن نشد.'));
            };
            const timer = setTimeout(fail, 8500);
            client.once('connect', success);
            client.once('connect_error', fail);
            client.connect();
          });
        }
        await ready.current;
        if (
          !mounted.current ||
          socket.current !== client ||
          currentGeneration !== generation.current
        )
          return false;
        if (!client.connected) throw new Error('ارتباط قطع شد. دوباره تلاش کن.');
        const response = await new Promise<ActionResponse>((resolve, reject) => {
          const callback = (err: Error | null, result: ActionResponse) =>
            err ? reject(new Error('پاسخ سرور نرسید. وضعیت اتصال را بررسی کن.')) : resolve(result);
          if (payload === undefined) client.timeout(8000).emit(event, callback);
          else client.timeout(8000).emit(event, payload, callback);
        });
        if (!mounted.current || currentGeneration !== generation.current) return false;
        if (!response.ok) {
          if (!quiet) setError(response.error);
          return false;
        }
        if (response.snapshot) receive(response.snapshot);
        return true;
      } catch (err) {
        if (!quiet && mounted.current && currentGeneration === generation.current)
          setError(err instanceof Error ? err.message : 'اتصال قطع شد.');
        return false;
      } finally {
        if (!quiet && mounted.current && currentGeneration === generation.current) setBusy(false);
      }
    },
    [receive],
  );

  const update = useCallback(
    async (answers: Answers): Promise<boolean> => {
      const requestId = ++draftRequestId.current;
      const roundKey = `${snapshot?.room.code}:${snapshot?.room.round}`;
      setDraftStatus('saving');
      const saved = await request('answers:update', { round: snapshot?.room.round, answers }, true);
      if (
        mounted.current &&
        requestId === draftRequestId.current &&
        roundKey === draftRound.current
      ) {
        setDraftStatus(saved ? 'saved' : 'unsaved');
      }
      return saved;
    },
    [request, snapshot?.room.code, snapshot?.room.round],
  );

  async function leave() {
    if (leaving.current) return;
    leaving.current = true;
    generation.current++;
    draftRequestId.current++;
    credential.current = null;
    forgetCredential();
    const client = socket.current;
    setBusy(true);
    try {
      // Leaving offline is immediate; never reconnect merely to leave a room.
      if (client?.connected)
        await new Promise<void>((resolve) => {
          client.timeout(1500).emit('room:leave', () => resolve());
        });
    } finally {
      client?.disconnect();
      draftRound.current = '';
      if (mounted.current) {
        setSnapshot(null);
        setConnected(false);
        setBusy(false);
        setError('');
        setDraftStatus('saved');
      }
      leaving.current = false;
    }
  }
  return {
    snapshot,
    connected,
    busy,
    error,
    clockOffset,
    draftStatus,
    markDraftDirty,
    clearError: () => setError(''),
    create: (name: string, config: GameConfig) => request('room:create', { name, config }),
    join: (code: string, name: string) =>
      request('room:join', { code: code.trim().toUpperCase(), name }),
    start: () => request('room:start'),
    next: () => request('room:next'),
    finalize: () => request('room:finalize'),
    leave,
    update,
    stop: () => request('round:stop', { round: snapshot?.room.round }),
    vote: (playerId: string, category: CategoryId, valid: boolean) =>
      request('review:vote', { round: snapshot?.room.round, playerId, category, valid }),
  };
}
