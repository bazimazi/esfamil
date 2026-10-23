import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import {
  CATEGORIES,
  chooseLetter,
  emptyAnswers,
  normalizePersian,
  scoreRound,
} from '../shared/game';
import type { Answers, CategoryId } from '../shared/game';
import { MAX_PLAYERS } from '../shared/protocol';
import type {
  ActionAck,
  ActionResponse,
  ClientToServerEvents,
  GameConfig,
  PublicRoom,
  ReviewVoteState,
  RoomSnapshot,
  RoundResult,
  ServerToClientEvents,
} from '../shared/protocol';

interface SocketData {
  roomCode?: string;
  playerId?: string;
  windowStart: number;
  eventCount: number;
}
type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
interface Player {
  id: string;
  token: string;
  name: string;
  score: number;
  socketId?: string;
  answers: Answers;
}
interface Room {
  code: string;
  hostId: string;
  config: GameConfig;
  phase: PublicRoom['phase'];
  players: Map<string, Player>;
  round: number;
  letter: string | null;
  deadline: number | null;
  results: RoundResult[] | null;
  votes: Map<string, Map<string, boolean>>;
  usedLetters: string[];
  touchedAt: number;
  emptySince: number | null;
  timer?: ReturnType<typeof setTimeout>;
}
export interface GameServerOptions {
  /** Production defaults are bounded; overrides make isolated tests fast. */
  roundDurationMs?: number;
  now?: () => number;
  maxRooms?: number;
  emptyRoomTtlMs?: number;
  roomTtlMs?: number;
  cleanupIntervalMs?: number;
  staticDir?: string;
}

const categoryIds = CATEGORIES.map((category) => category.id);
const categorySet = new Set<string>(categoryIds);
const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const cleanText = (value: string) =>
  value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '');

class ActionError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}
function fail(message: string, code: string): never {
  throw new ActionError(message, code);
}
function nameFrom(value: unknown): string {
  if (typeof value !== 'string') fail('نام بازیکن را وارد کنید.', 'INVALID_NAME');
  const name = cleanText(value).trim().replace(/\s+/g, ' ');
  if (!name || name.length > 24) fail('نام باید بین ۱ تا ۲۴ نویسه باشد.', 'INVALID_NAME');
  return name;
}
function configFrom(value: unknown): GameConfig {
  if (
    !object(value) ||
    ![1, 3, 5].includes(value.rounds as number) ||
    ![60, 90, 120].includes(value.duration as number)
  ) {
    fail('تنظیمات بازی معتبر نیست.', 'INVALID_CONFIG');
  }
  return {
    rounds: value.rounds as GameConfig['rounds'],
    duration: value.duration as GameConfig['duration'],
  };
}
function roomCodeFrom(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Z2-9]{5}$/.test(value.trim().toUpperCase())) {
    fail('کد اتاق معتبر نیست.', 'INVALID_CODE');
  }
  return value.trim().toUpperCase();
}

/** An isolated server instance; importing this module never opens a port. */
export function createGameServer(options: GameServerOptions = {}) {
  const now = options.now ?? Date.now;
  const app = express();
  app.disable('x-powered-by');
  const httpServer = createServer(app);
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    maxHttpBufferSize: 16_384,
    serveClient: false,
    // WebSocket handshakes intentionally accept any Origin, including native
    // webviews and a separately hosted frontend. No ambient cookie credentials
    // are used: room resume tokens are private explicit message credentials.
    // This is not an Origin allowlist; cross-origin HTTP polling has no CORS
    // headers. Public deployments can restrict browser Origins at their proxy.
  });
  const rooms = new Map<string, Room>();
  const addressWindows = new Map<string, { start: number; count: number }>();
  let disposed = false;

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  if (options.staticDir) {
    const staticDir = path.resolve(options.staticDir);
    app.use(express.static(staticDir, { index: false }));
    app.use((req, res, next) => {
      if (req.method === 'GET' && req.accepts('html') && !req.path.startsWith('/api/')) {
        res.sendFile(path.join(staticDir, 'index.html'));
      } else next();
    });
  }

  function voteKey(playerId: string, category: CategoryId) {
    return `${playerId}:${category}`;
  }
  function resultsFor(room: Room): RoundResult[] {
    const overrides: Record<string, boolean> = {};
    const needed = Math.floor((room.players.size - 1) / 2) + 1;
    for (const [key, votes] of room.votes) {
      let valid = 0;
      let invalid = 0;
      for (const vote of votes.values()) vote ? valid++ : invalid++;
      if (valid >= needed) overrides[key] = true;
      if (invalid >= needed) overrides[key] = false;
    }
    return scoreRound(
      [...room.players.values()].map((player) => ({
        playerId: player.id,
        answers: player.answers,
      })),
      room.letter!,
      overrides,
    );
  }
  function reviewVotesFor(room: Room, viewerId: string): ReviewVoteState[] {
    if (room.phase !== 'review') return [];
    const base = scoreRound(
      [...room.players.values()].map((player) => ({
        playerId: player.id,
        answers: player.answers,
      })),
      room.letter!,
    );
    return base.flatMap((result) =>
      result.cells
        .filter((cell) => cell.status === 'review')
        .map((cell) => {
          const votes = room.votes.get(voteKey(result.playerId, cell.category));
          const all = [...(votes?.values() ?? [])];
          return {
            playerId: result.playerId,
            category: cell.category,
            valid: all.filter(Boolean).length,
            invalid: all.filter((vote) => !vote).length,
            needed: Math.floor((room.players.size - 1) / 2) + 1,
            myVote: votes?.get(viewerId) ?? null,
          };
        }),
    );
  }
  function snapshotFor(room: Room, player: Player): RoomSnapshot {
    return {
      serverNow: now(),
      room: {
        code: room.code,
        hostId: room.hostId,
        phase: room.phase,
        players: [...room.players.values()].map((entry) => ({
          id: entry.id,
          name: entry.name,
          score: entry.score,
          connected: !!entry.socketId,
          filled: categoryIds.filter((id) => normalizePersian(entry.answers[id]).length > 0).length,
        })),
        round: room.round,
        config: { ...room.config },
        letter: room.letter,
        deadline: room.deadline,
        results: room.phase === 'playing' ? null : room.results,
      },
      playerId: player.id,
      token: player.token,
      answers: { ...player.answers },
      reviewVotes: reviewVotesFor(room, player.id),
    };
  }
  function broadcast(room: Room) {
    for (const player of room.players.values()) {
      if (player.socketId) io.to(player.socketId).emit('room:state', snapshotFor(room, player));
    }
  }
  function clearRoundTimer(room: Room) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = undefined;
  }
  function closeRoom(room: Room, reason: string) {
    clearRoundTimer(room);
    for (const player of room.players.values()) {
      const socket = player.socketId ? io.sockets.sockets.get(player.socketId) : undefined;
      if (socket) {
        socket.data.roomCode = undefined;
        socket.data.playerId = undefined;
        socket.emit('room:closed', { reason });
      }
    }
    rooms.delete(room.code);
  }
  function stopRound(room: Room) {
    if (room.phase !== 'playing') return;
    clearRoundTimer(room);
    room.phase = 'review';
    room.deadline = null;
    room.results = resultsFor(room);
    room.touchedAt = now();
    broadcast(room);
  }
  function requireActiveRound(room: Room) {
    if (room.phase === 'playing' && room.deadline !== null && now() >= room.deadline)
      stopRound(room);
    if (room.phase !== 'playing') fail('این دور تمام شده است.', 'ROUND_NOT_ACTIVE');
  }
  function scheduleRoundTimer(room: Room) {
    clearRoundTimer(room);
    const remaining = Math.max(1, (room.deadline ?? now()) - now());
    room.timer = setTimeout(() => {
      if (room.phase !== 'playing') return;
      if (now() >= room.deadline!) stopRound(room);
      else scheduleRoundTimer(room);
    }, remaining);
    room.timer.unref();
  }
  function startRound(room: Room) {
    if (room.round >= room.config.rounds) fail('بازی به پایان رسیده است.', 'GAME_FINISHED');
    room.round++;
    room.letter = chooseLetter(room.usedLetters);
    room.usedLetters.push(room.letter);
    room.phase = 'playing';
    room.deadline = now() + (options.roundDurationMs ?? room.config.duration * 1000);
    room.results = null;
    room.votes.clear();
    for (const player of room.players.values()) player.answers = emptyAnswers();
    room.touchedAt = now();
    scheduleRoundTimer(room);
  }
  function finalizeRound(room: Room) {
    if (room.phase !== 'review') fail('دور هنوز آمادهٔ امتیازشماری نیست.', 'NOT_REVIEW');
    room.results = resultsFor(room);
    for (const result of room.results) {
      const player = room.players.get(result.playerId);
      if (player) player.score += result.total;
    }
    room.phase = room.round >= room.config.rounds ? 'finished' : 'lobby';
    room.touchedAt = now();
  }
  function context(socket: GameSocket) {
    const room = socket.data.roomCode ? rooms.get(socket.data.roomCode) : undefined;
    const player = socket.data.playerId ? room?.players.get(socket.data.playerId) : undefined;
    if (!room || !player || player.socketId !== socket.id)
      fail('ابتدا وارد یک اتاق شوید.', 'NOT_IN_ROOM');
    return { room, player };
  }
  function requireHost(room: Room, player: Player) {
    if (room.hostId !== player.id) fail('فقط میزبان می‌تواند این کار را انجام دهد.', 'HOST_ONLY');
  }
  function requireRound(room: Room, payload: unknown) {
    if (!object(payload) || !Number.isInteger(payload.round) || payload.round !== room.round) {
      fail('این درخواست مربوط به دست فعلی نیست.', 'STALE_ROUND');
    }
  }
  function requireUnattached(socket: GameSocket) {
    if (socket.data.roomCode) fail('ابتدا از اتاق فعلی خارج شوید.', 'ALREADY_IN_ROOM');
  }
  function consumeAdmission(socket: GameSocket) {
    const address = socket.handshake.address;
    let window = addressWindows.get(address);
    if (!window || now() - window.start >= 60_000) {
      window = { start: now(), count: 0 };
      addressWindows.set(address, window);
    }
    if (++window.count > 40) fail('کمی صبر کنید و دوباره تلاش کنید.', 'RATE_LIMIT');
  }
  function attach(socket: GameSocket, room: Room, player: Player) {
    if (player.socketId && player.socketId !== socket.id) {
      const previous = io.sockets.sockets.get(player.socketId);
      if (previous) {
        previous.data.roomCode = undefined;
        previous.data.playerId = undefined;
        previous.emit('room:closed', { reason: 'این بازیکن در دستگاه دیگری متصل شد.' });
        previous.disconnect(true);
      }
    }
    player.socketId = socket.id;
    socket.data.roomCode = room.code;
    socket.data.playerId = player.id;
    room.emptySince = null;
    room.touchedAt = now();
    migrateHost(room);
  }
  function migrateHost(room: Room) {
    const host = room.players.get(room.hostId);
    if (!host?.socketId) {
      room.hostId =
        [...room.players.values()].find((player) => player.socketId)?.id ??
        host?.id ??
        [...room.players.keys()][0] ??
        '';
    }
    if (![...room.players.values()].some((player) => player.socketId)) room.emptySince ??= now();
  }
  function removePlayer(socket: GameSocket) {
    const { room, player } = context(socket);
    socket.data.roomCode = undefined;
    socket.data.playerId = undefined;
    room.players.delete(player.id);
    for (const [key, votes] of room.votes) {
      if (key.startsWith(`${player.id}:`)) room.votes.delete(key);
      else votes.delete(player.id);
    }
    if (!room.players.size) {
      closeRoom(room, 'اتاق خالی شد.');
      return;
    }
    migrateHost(room);
    if (room.phase === 'review') room.results = resultsFor(room);
    broadcast(room);
  }

  io.use((socket, next) => {
    if (io.sockets.sockets.size >= 1_000) return next(new Error('SERVER_FULL'));
    socket.data.windowStart = now();
    socket.data.eventCount = 0;
    next();
  });
  io.on('connection', (socket) => {
    function run(ack: unknown, operation: () => RoomSnapshot | void) {
      let response: ActionResponse;
      try {
        if (now() - socket.data.windowStart >= 10_000) {
          socket.data.windowStart = now();
          socket.data.eventCount = 0;
        }
        if (++socket.data.eventCount > 160) fail('کمی صبر کنید و دوباره تلاش کنید.', 'RATE_LIMIT');
        const snapshot = operation();
        response = snapshot ? { ok: true, snapshot } : { ok: true };
      } catch (error) {
        response =
          error instanceof ActionError
            ? { ok: false, error: error.message, code: error.code }
            : {
                ok: false,
                error: 'انجام این کار ممکن نشد. دوباره تلاش کنید.',
                code: 'INTERNAL_ERROR',
              };
        if (!(error instanceof ActionError)) console.error('Game action failed:', error);
      }
      if (typeof ack === 'function') (ack as ActionAck)(response);
    }
    socket.on('room:create', (payload, ack) =>
      run(ack, () => {
        requireUnattached(socket);
        consumeAdmission(socket);
        if (!object(payload)) fail('درخواست معتبر نیست.', 'INVALID_PAYLOAD');
        const name = nameFrom(payload.name);
        const config = configFrom(payload.config);
        if (rooms.size >= (options.maxRooms ?? 300))
          fail('ظرفیت اتاق‌ها تکمیل است.', 'SERVER_FULL');
        let code: string;
        do {
          code = [...randomBytes(5)]
            .map((byte) => codeAlphabet[byte % codeAlphabet.length])
            .join('');
        } while (rooms.has(code));
        const player: Player = {
          id: randomUUID(),
          token: randomBytes(32).toString('hex'),
          name,
          score: 0,
          answers: emptyAnswers(),
        };
        const room: Room = {
          code,
          hostId: player.id,
          config,
          phase: 'lobby',
          players: new Map([[player.id, player]]),
          round: 0,
          letter: null,
          deadline: null,
          results: null,
          votes: new Map(),
          usedLetters: [],
          touchedAt: now(),
          emptySince: null,
        };
        rooms.set(code, room);
        attach(socket, room, player);
        broadcast(room);
        return snapshotFor(room, player);
      }),
    );
    socket.on('room:join', (payload, ack) =>
      run(ack, () => {
        requireUnattached(socket);
        consumeAdmission(socket);
        if (!object(payload)) fail('درخواست معتبر نیست.', 'INVALID_PAYLOAD');
        const code = roomCodeFrom(payload.code);
        const name = nameFrom(payload.name);
        const room = rooms.get(code);
        if (!room) fail('اتاق پیدا نشد.', 'ROOM_NOT_FOUND');
        if (room.phase !== 'lobby' || room.round !== 0)
          fail('بازی شروع شده است؛ منتظر بازی بعدی باشید.', 'GAME_STARTED');
        if (room.players.size >= MAX_PLAYERS) fail('اتاق پر است.', 'ROOM_FULL');
        const player: Player = {
          id: randomUUID(),
          token: randomBytes(32).toString('hex'),
          name,
          score: 0,
          answers: emptyAnswers(),
        };
        room.players.set(player.id, player);
        attach(socket, room, player);
        broadcast(room);
        return snapshotFor(room, player);
      }),
    );
    socket.on('room:resume', (payload, ack) =>
      run(ack, () => {
        requireUnattached(socket);
        consumeAdmission(socket);
        if (!object(payload)) fail('درخواست معتبر نیست.', 'INVALID_PAYLOAD');
        const code = roomCodeFrom(payload.code);
        if (typeof payload.token !== 'string' || !/^[a-f0-9]{64}$/.test(payload.token))
          fail('نشست معتبر نیست.', 'INVALID_SESSION');
        const room = rooms.get(code);
        const player =
          room && [...room.players.values()].find((entry) => entry.token === payload.token);
        if (!room || !player) fail('نشست قبلی پیدا نشد.', 'INVALID_SESSION');
        attach(socket, room, player);
        if (room.phase === 'playing' && now() >= room.deadline!) stopRound(room);
        broadcast(room);
        return snapshotFor(room, player);
      }),
    );
    socket.on('room:start', (ack) =>
      run(ack, () => {
        const { room, player } = context(socket);
        requireHost(room, player);
        if (room.phase !== 'lobby' || room.round !== 0)
          fail('بازی قبلاً شروع شده است.', 'GAME_STARTED');
        startRound(room);
        broadcast(room);
      }),
    );
    socket.on('room:next', (ack) =>
      run(ack, () => {
        const { room, player } = context(socket);
        requireHost(room, player);
        if (room.phase === 'review') finalizeRound(room);
        if (room.phase === 'finished') {
          broadcast(room);
          return;
        }
        if (room.phase !== 'lobby' || room.round === 0)
          fail('دور بعد هنوز آماده نیست.', 'INVALID_PHASE');
        startRound(room);
        broadcast(room);
      }),
    );
    socket.on('room:finalize', (ack) =>
      run(ack, () => {
        const { room, player } = context(socket);
        requireHost(room, player);
        finalizeRound(room);
        broadcast(room);
      }),
    );
    socket.on('answers:update', (payload, ack) =>
      run(ack, () => {
        const { room, player } = context(socket);
        requireActiveRound(room);
        requireRound(room, payload);
        if (!object(payload) || !object(payload.answers))
          fail('پاسخ‌ها معتبر نیستند.', 'INVALID_ANSWERS');
        const entries = Object.entries(payload.answers);
        if (
          entries.length > categoryIds.length ||
          entries.some(
            ([id, answer]) =>
              !categorySet.has(id) || typeof answer !== 'string' || answer.length > 80,
          )
        ) {
          fail('پاسخ‌ها معتبر نیستند.', 'INVALID_ANSWERS');
        }
        for (const [id, answer] of entries)
          player.answers[id as CategoryId] = cleanText(answer as string);
        room.touchedAt = now();
        broadcast(room);
      }),
    );
    socket.on('round:stop', (payload, ack) =>
      run(ack, () => {
        const { room, player } = context(socket);
        requireActiveRound(room);
        requireRound(room, payload);
        if (!categoryIds.every((id) => normalizePersian(player.answers[id]).length > 0)) {
          fail('برای گفتن «استپ»، هر شش خانه را پر کنید.', 'INCOMPLETE_ANSWERS');
        }
        stopRound(room);
      }),
    );
    socket.on('review:vote', (payload, ack) =>
      run(ack, () => {
        const { room, player } = context(socket);
        if (room.phase !== 'review') fail('رأی‌گیری فعال نیست.', 'NOT_REVIEW');
        requireRound(room, payload);
        if (
          !object(payload) ||
          typeof payload.playerId !== 'string' ||
          typeof payload.category !== 'string' ||
          !categorySet.has(payload.category) ||
          typeof payload.valid !== 'boolean'
        ) {
          fail('رأی معتبر نیست.', 'INVALID_VOTE');
        }
        if (payload.playerId === player.id)
          fail('نمی‌توانید به پاسخ خودتان رأی دهید.', 'SELF_VOTE');
        const result = scoreRound(
          [...room.players.values()].map((entry) => ({
            playerId: entry.id,
            answers: entry.answers,
          })),
          room.letter!,
        ).find((entry) => entry.playerId === payload.playerId);
        const cell = result?.cells.find((entry) => entry.category === payload.category);
        if (!cell || cell.status !== 'review')
          fail('فقط پاسخ‌های نیازمند بررسی رأی‌گیری می‌شوند.', 'NOT_REVIEWABLE');
        const key = voteKey(payload.playerId, payload.category as CategoryId);
        const votes = room.votes.get(key) ?? new Map<string, boolean>();
        votes.set(player.id, payload.valid);
        room.votes.set(key, votes);
        room.results = resultsFor(room);
        room.touchedAt = now();
        broadcast(room);
      }),
    );
    socket.on('room:leave', (ack) => run(ack, () => removePlayer(socket)));
    socket.on('disconnect', () => {
      const room = socket.data.roomCode ? rooms.get(socket.data.roomCode) : undefined;
      const player = socket.data.playerId ? room?.players.get(socket.data.playerId) : undefined;
      if (!room || !player || player.socketId !== socket.id) return;
      player.socketId = undefined;
      migrateHost(room);
      broadcast(room);
    });
  });

  const cleanup = setInterval(() => {
    const current = now();
    for (const room of rooms.values()) {
      if (
        (room.emptySince !== null &&
          current - room.emptySince >= (options.emptyRoomTtlMs ?? 30 * 60_000)) ||
        current - room.touchedAt >= (options.roomTtlMs ?? 6 * 60 * 60_000)
      ) {
        closeRoom(room, 'مهلت اتاق به پایان رسید.');
      }
    }
    for (const [address, window] of addressWindows)
      if (current - window.start > 60_000) addressWindows.delete(address);
  }, options.cleanupIntervalMs ?? 60_000);
  cleanup.unref();

  return {
    app,
    io,
    httpServer,
    listen(port = 0, host = '127.0.0.1'): Promise<number> {
      return new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, host, () => {
          httpServer.off('error', reject);
          const address = httpServer.address();
          resolve(typeof address === 'object' && address ? address.port : port);
        });
      });
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      clearInterval(cleanup);
      for (const room of rooms.values()) clearRoundTimer(room);
      rooms.clear();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
