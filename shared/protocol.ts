import type { Answers, CategoryId } from './game';

export type RoomPhase = 'lobby' | 'playing' | 'review' | 'finished';
export interface GameConfig {
  rounds: 1 | 3 | 5;
  duration: 60 | 90 | 120;
}
export interface PublicPlayer {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  filled: number;
}
export interface RoundCell {
  category: CategoryId;
  answer: string;
  status: 'valid' | 'invalid' | 'review';
  points: number;
  duplicate: boolean;
}
export interface RoundResult {
  playerId: string;
  total: number;
  cells: RoundCell[];
}
export interface PublicRoom {
  code: string;
  hostId: string;
  phase: RoomPhase;
  players: PublicPlayer[];
  round: number;
  config: GameConfig;
  letter: string | null;
  deadline: number | null;
  /** Answers are revealed only after the server stops a round. */
  results: RoundResult[] | null;
}
export interface ReviewVoteState {
  playerId: string;
  category: CategoryId;
  valid: number;
  invalid: number;
  needed: number;
  myVote: boolean | null;
}
export interface RoomSnapshot {
  /** Server wall-clock at serialization, for an approximate client clock offset. */
  serverNow: number;
  room: PublicRoom;
  playerId: string;
  /** A private resume credential. Persist locally; never expose to other players. */
  token: string;
  answers: Answers;
  reviewVotes: ReviewVoteState[];
}
export type ActionResponse =
  { ok: true; snapshot?: RoomSnapshot } | { ok: false; error: string; code?: string };
export type ActionAck = (response: ActionResponse) => void;

export interface ClientToServerEvents {
  'room:create': (payload: { name: string; config: GameConfig }, ack: ActionAck) => void;
  'room:join': (payload: { code: string; name: string }, ack: ActionAck) => void;
  'room:resume': (payload: { code: string; token: string }, ack: ActionAck) => void;
  'room:start': (ack: ActionAck) => void;
  'room:next': (ack: ActionAck) => void;
  'room:finalize': (ack: ActionAck) => void;
  'room:leave': (ack: ActionAck) => void;
  'answers:update': (payload: { round: number; answers: Partial<Answers> }, ack: ActionAck) => void;
  'round:stop': (payload: { round: number }, ack: ActionAck) => void;
  'review:vote': (
    payload: { round: number; playerId: string; category: CategoryId; valid: boolean },
    ack: ActionAck,
  ) => void;
}
export interface ServerToClientEvents {
  'room:state': (snapshot: RoomSnapshot) => void;
  'room:closed': (payload: { reason: string }) => void;
}

export const DEFAULT_CONFIG: GameConfig = { rounds: 3, duration: 90 };
export const MAX_PLAYERS = 8;
