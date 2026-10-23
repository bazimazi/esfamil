import { afterEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { ANSWER_PACK, CATEGORIES, emptyAnswers } from '../shared/game';
import type { Answers } from '../shared/game';
import type {
  ActionResponse,
  ClientToServerEvents,
  RoomSnapshot,
  ServerToClientEvents,
} from '../shared/protocol';
import { createGameServer } from '../server/game-server';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
const servers: ReturnType<typeof createGameServer>[] = [];
const clients: Client[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await Promise.all(servers.splice(0).map((server) => server.dispose()));
});

async function setup(roundDurationMs = 5_000, now?: () => number) {
  const server = createGameServer({ roundDurationMs, now });
  servers.push(server);
  const port = await server.listen();
  async function connect() {
    const client: Client = io(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      reconnection: false,
      autoConnect: false,
    });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => resolve());
      client.once('connect_error', reject);
      client.connect();
    });
    return client;
  }
  return { connect, server };
}

function success(response: ActionResponse): RoomSnapshot {
  expect(response.ok).toBe(true);
  if (!response.ok || !response.snapshot) throw new Error('Expected a successful snapshot');
  return response.snapshot;
}
function state(
  client: Client,
  predicate: (snapshot: RoomSnapshot) => boolean = () => true,
): Promise<RoomSnapshot> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.off('room:state', onState);
      reject(new Error('Timed out waiting for room state'));
    }, 2_000);
    function onState(snapshot: RoomSnapshot) {
      if (!predicate(snapshot)) return;
      clearTimeout(timeout);
      client.off('room:state', onState);
      resolve(snapshot);
    }
    client.on('room:state', onState);
  });
}
async function createRoom(client: Client, rounds: 1 | 3 | 5 = 1) {
  return success(
    await client
      .timeout(2_000)
      .emitWithAck('room:create', { name: 'مینا', config: { rounds, duration: 60 } }),
  );
}
function unfamiliarAnswers(letter: string): Answers {
  return Object.fromEntries(
    CATEGORIES.map((category, index) => [category.id, `${letter}ناشناخته${'ژ'.repeat(index + 1)}`]),
  ) as Answers;
}

describe('private-room multiplayer server', () => {
  it('keeps answers private, enforces host authority, reviews unfamiliar words, and scores a complete game once', async () => {
    const { connect } = await setup();
    const host = await connect();
    const guest = await connect();
    const created = await createRoom(host);
    const joined = success(
      await guest
        .timeout(2_000)
        .emitWithAck('room:join', { code: created.room.code.toLowerCase(), name: 'سارا' }),
    );
    expect(joined.token).not.toBe(created.token);
    expect(JSON.stringify(joined)).not.toContain(created.token);
    expect(await guest.timeout(2_000).emitWithAck('room:start')).toMatchObject({
      ok: false,
      code: 'HOST_ONLY',
    });
    const playingState = state(host, (snapshot) => snapshot.room.phase === 'playing');
    expect(await host.timeout(2_000).emitWithAck('room:start')).toEqual({ ok: true });
    const playing = await playingState;
    expect(await host.timeout(2_000).emitWithAck('round:stop', { round: 1 })).toMatchObject({
      ok: false,
      code: 'INCOMPLETE_ANSWERS',
    });
    const answers = unfamiliarAnswers(playing.room.letter!);
    const guestSeesProgress = state(
      guest,
      (snapshot) =>
        snapshot.room.players.find((player) => player.id === created.playerId)?.filled === 6,
    );
    expect(await host.timeout(2_000).emitWithAck('answers:update', { round: 1, answers })).toEqual({
      ok: true,
    });
    const privateState = await guestSeesProgress;
    expect(privateState.answers).toEqual(emptyAnswers());
    expect(privateState.room.results).toBeNull();
    expect(JSON.stringify(privateState)).not.toContain(answers[CATEGORIES[0].id]);
    const reviewingState = state(guest, (snapshot) => snapshot.room.phase === 'review');
    expect(await host.timeout(2_000).emitWithAck('round:stop', { round: 1 })).toEqual({ ok: true });
    const reviewing = await reviewingState;
    expect(reviewing.room.deadline).toBeNull();
    const category = reviewing.reviewVotes.find(
      (vote) => vote.playerId === created.playerId,
    )!.category;
    expect(
      await host.timeout(2_000).emitWithAck('review:vote', {
        round: 1,
        playerId: created.playerId,
        category,
        valid: true,
      }),
    ).toMatchObject({ ok: false, code: 'SELF_VOTE' });
    expect(
      await guest.timeout(2_000).emitWithAck('review:vote', {
        round: 1,
        playerId: 'invented-player',
        category,
        valid: true,
      }),
    ).toMatchObject({ ok: false, code: 'NOT_REVIEWABLE' });
    expect(
      await guest.timeout(2_000).emitWithAck('review:vote', {
        round: 1,
        playerId: created.playerId,
        category,
        valid: true,
      }),
    ).toEqual({ ok: true });
    expect(await guest.timeout(2_000).emitWithAck('room:finalize')).toMatchObject({
      ok: false,
      code: 'HOST_ONLY',
    });
    const finalState = state(host, (snapshot) => snapshot.room.phase === 'finished');
    expect(await host.timeout(2_000).emitWithAck('room:finalize')).toEqual({ ok: true });
    const finished = await finalState;
    const hostResult = finished.room.results!.find(
      (result) => result.playerId === created.playerId,
    )!;
    expect(hostResult.total).toBeGreaterThan(0);
    expect(finished.room.players.find((player) => player.id === created.playerId)!.score).toBe(
      hostResult.total,
    );
    expect(await host.timeout(2_000).emitWithAck('room:finalize')).toMatchObject({
      ok: false,
      code: 'NOT_REVIEW',
    });
  });

  it('uses the server deadline and rejects answer mutations after expiry', async () => {
    let current = Date.now();
    const { connect } = await setup(5_000, () => current);
    const host = await connect();
    await createRoom(host);
    const started = state(host, (snapshot) => snapshot.room.phase === 'playing');
    expect(await host.timeout(2_000).emitWithAck('room:start')).toEqual({ ok: true });
    const playing = await started;
    expect(playing.serverNow).toBe(current);
    // Advance the authoritative clock without letting the scheduled timer run.
    current = playing.room.deadline! + 1;
    const reviewing = state(host, (snapshot) => snapshot.room.phase === 'review');
    expect(
      await host
        .timeout(2_000)
        .emitWithAck('answers:update', { round: 1, answers: { [CATEGORIES[0].id]: 'محمد' } }),
    ).toMatchObject({ ok: false, code: 'ROUND_NOT_ACTIVE' });
    const expired = await reviewing;
    expect(expired.serverNow).toBe(current);
    expect(expired.answers).toEqual(emptyAnswers());
    expect(await host.timeout(2_000).emitWithAck('round:stop', { round: 1 })).toMatchObject({
      ok: false,
      code: 'ROUND_NOT_ACTIVE',
    });
  });

  it('automatically stops on timeout and advances three rounds without repeating scores or letters', async () => {
    const timeoutSetup = await setup(40);
    const timedHost = await timeoutSetup.connect();
    await createRoom(timedHost);
    const timedReview = state(timedHost, (snapshot) => snapshot.room.phase === 'review');
    await timedHost.timeout(2_000).emitWithAck('room:start');
    expect((await timedReview).room.results).toHaveLength(1);

    const { connect } = await setup();
    const host = await connect();
    await createRoom(host, 3);
    let nextPlaying = state(host, (snapshot) => snapshot.room.phase === 'playing');
    await host.timeout(2_000).emitWithAck('room:start');
    let playing = await nextPlaying;
    const letters = new Set<string>();
    let total = 0;
    for (let round = 1; round <= 3; round++) {
      expect(playing.room.round).toBe(round);
      expect(letters.has(playing.room.letter!)).toBe(false);
      letters.add(playing.room.letter!);
      const pack = ANSWER_PACK[playing.room.letter as keyof typeof ANSWER_PACK];
      const answers = Object.fromEntries(CATEGORIES.map(({ id }) => [id, pack[id][0]])) as Answers;
      await host.timeout(2_000).emitWithAck('answers:update', { round, answers });
      const reviewState = state(host, (snapshot) => snapshot.room.phase === 'review');
      await host.timeout(2_000).emitWithAck('round:stop', { round });
      total += (await reviewState).room.results![0].total;
      if (round === 3) {
        const finishState = state(host, (snapshot) => snapshot.room.phase === 'finished');
        await host.timeout(2_000).emitWithAck('room:next');
        expect((await finishState).room.players[0].score).toBe(total);
      } else {
        if (round === 2) {
          const lobbyState = state(host, (snapshot) => snapshot.room.phase === 'lobby');
          await host.timeout(2_000).emitWithAck('room:finalize');
          expect((await lobbyState).room.players[0].score).toBe(total);
        }
        nextPlaying = state(host, (snapshot) => snapshot.room.phase === 'playing');
        await host.timeout(2_000).emitWithAck('room:next');
        playing = await nextPlaying;
        expect(playing.room.players[0].score).toBe(total);
      }
    }
  });

  it('resumes a persistent player identity and migrates the host after disconnect', async () => {
    const { connect } = await setup();
    const host = await connect();
    const guest = await connect();
    const created = await createRoom(host);
    const joined = success(
      await guest.timeout(2_000).emitWithAck('room:join', { code: created.room.code, name: 'علی' }),
    );
    const migrated = state(guest, (snapshot) => snapshot.room.hostId === joined.playerId);
    host.disconnect();
    expect(
      (await migrated).room.players.find((player) => player.id === created.playerId)?.connected,
    ).toBe(false);
    const resumedClient = await connect();
    const resumed = success(
      await resumedClient
        .timeout(2_000)
        .emitWithAck('room:resume', { code: created.room.code, token: created.token }),
    );
    expect(resumed.playerId).toBe(created.playerId);
    expect(resumed.token).toBe(created.token);
    expect(resumed.room.hostId).toBe(joined.playerId);
    expect(await resumedClient.timeout(2_000).emitWithAck('room:start')).toMatchObject({
      ok: false,
      code: 'HOST_ONLY',
    });
    expect(await guest.timeout(2_000).emitWithAck('room:start')).toEqual({ ok: true });
  });

  it('rejects delayed answers, stops, and votes from a previous round', async () => {
    const { connect } = await setup();
    const host = await connect();
    const guest = await connect();
    const created = await createRoom(host, 3);
    await guest.timeout(2_000).emitWithAck('room:join', { code: created.room.code, name: 'سارا' });
    let playingState = state(host, (snapshot) => snapshot.room.phase === 'playing');
    await host.timeout(2_000).emitWithAck('room:start');
    const first = await playingState;
    const oldAnswers = unfamiliarAnswers(first.room.letter!);
    await host.timeout(2_000).emitWithAck('answers:update', { round: 1, answers: oldAnswers });
    await host.timeout(2_000).emitWithAck('round:stop', { round: 1 });
    playingState = state(
      host,
      (snapshot) => snapshot.room.phase === 'playing' && snapshot.room.round === 2,
    );
    await host.timeout(2_000).emitWithAck('room:next');
    const second = await playingState;
    expect(
      await host.timeout(2_000).emitWithAck('answers:update', { round: 1, answers: oldAnswers }),
    ).toMatchObject({ ok: false, code: 'STALE_ROUND' });
    expect(await host.timeout(2_000).emitWithAck('round:stop', { round: 1 })).toMatchObject({
      ok: false,
      code: 'STALE_ROUND',
    });
    const freshAnswers = unfamiliarAnswers(second.room.letter!);
    await host.timeout(2_000).emitWithAck('answers:update', { round: 2, answers: freshAnswers });
    const reviewState = state(
      guest,
      (snapshot) => snapshot.room.phase === 'review' && snapshot.room.round === 2,
    );
    await host.timeout(2_000).emitWithAck('round:stop', { round: 2 });
    const reviewing = await reviewState;
    expect(
      reviewing.room.results!.find((result) => result.playerId === created.playerId)!.cells[0]
        .answer,
    ).toBe(freshAnswers.name);
    expect(
      await guest.timeout(2_000).emitWithAck('review:vote', {
        round: 1,
        playerId: created.playerId,
        category: 'name',
        valid: true,
      }),
    ).toMatchObject({ ok: false, code: 'STALE_ROUND' });
  });

  it('rejects malformed configuration, unknown answer categories, and invalid resume credentials', async () => {
    const { connect } = await setup();
    const host = await connect();
    const malformed = { name: 'مینا', config: { rounds: 99, duration: 0 } };
    // Raw transport clients are untrusted even though application callers use TypeScript.
    const raw = host as unknown as Socket;
    expect(await raw.timeout(2_000).emitWithAck('room:create', malformed)).toMatchObject({
      ok: false,
      code: 'INVALID_CONFIG',
    });
    const created = await createRoom(host);
    expect(await host.timeout(2_000).emitWithAck('room:start')).toEqual({ ok: true });
    expect(
      await raw
        .timeout(2_000)
        .emitWithAck('answers:update', { round: 1, answers: { invented: 'علی' } }),
    ).toMatchObject({ ok: false, code: 'INVALID_ANSWERS' });
    const intruder = await connect();
    expect(
      await intruder
        .timeout(2_000)
        .emitWithAck('room:resume', { code: created.room.code, token: 'a'.repeat(64) }),
    ).toMatchObject({ ok: false, code: 'INVALID_SESSION' });
  });
});
