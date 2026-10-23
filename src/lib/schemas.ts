import { CATEGORIES, LETTERS, type Answers } from '../../shared/game';
import type { GameConfig } from '../../shared/protocol';

export type Mode = 'solo' | 'daily' | 'pass' | 'online';
export type Player = { id: string; name: string; score: number; connected?: boolean };
export type LocalGame = {
  id: string;
  mode: Exclude<Mode, 'online'>;
  stage: 'playing' | 'handoff' | 'review' | 'finished';
  config: GameConfig;
  players: Player[];
  round: number;
  activeIndex: number;
  letter: string;
  used: string[];
  deadline: number;
  answers: Answers[];
  overrides: Record<string, boolean>;
  dateKey: string;
};
export type RecordEntry = {
  id: string;
  date: string;
  mode: Mode;
  score: number;
  max: number;
  words: string[];
  letter: string;
};
export type Preferences = { name: string; sound: boolean; config: GameConfig };
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 60): value is string =>
  typeof value === 'string' && value.length <= max;
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const config = (value: unknown): value is GameConfig =>
  object(value) &&
  [1, 3, 5].includes(value.rounds as number) &&
  [60, 90, 120].includes(value.duration as number);
const date = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
const answers = (value: unknown): value is Answers =>
  object(value) && CATEGORIES.every((c) => text(value[c.id]));

export function validPreferences(value: unknown): value is Preferences {
  return (
    object(value) &&
    text(value.name, 24) &&
    typeof value.sound === 'boolean' &&
    config(value.config)
  );
}
export function validLocalGame(value: unknown): value is LocalGame | null {
  if (value === null) return true;
  if (
    !object(value) ||
    !text(value.id, 100) ||
    !['solo', 'daily', 'pass'].includes(value.mode as string) ||
    !['playing', 'handoff', 'review', 'finished'].includes(value.stage as string) ||
    !config(value.config) ||
    !date(value.dateKey)
  )
    return false;
  if (
    !Array.isArray(value.players) ||
    value.players.length < 2 ||
    value.players.length > 4 ||
    !value.players.every(
      (p) => object(p) && text(p.id, 100) && text(p.name, 24) && integer(p.score, 0, 300),
    )
  )
    return false;
  if (
    !integer(value.activeIndex, 0, value.players.length - 1) ||
    !integer(value.round, 1, value.config.rounds) ||
    !(LETTERS as readonly unknown[]).includes(value.letter)
  )
    return false;
  return (
    Array.isArray(value.answers) &&
    value.answers.length === value.players.length &&
    value.answers.every(answers) &&
    Array.isArray(value.used) &&
    value.used.length <= 5 &&
    value.used.every((l) => (LETTERS as readonly unknown[]).includes(l)) &&
    typeof value.deadline === 'number' &&
    Number.isFinite(value.deadline) &&
    object(value.overrides) &&
    Object.entries(value.overrides).every(([key, v]) => key.length <= 120 && typeof v === 'boolean')
  );
}
export function validRecords(value: unknown): value is RecordEntry[] {
  return (
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every(
      (r) =>
        object(r) &&
        text(r.id, 150) &&
        date(r.date) &&
        ['solo', 'daily', 'pass', 'online'].includes(r.mode as string) &&
        integer(r.score, 0, 300) &&
        integer(r.max, 60, 300) &&
        Array.isArray(r.words) &&
        r.words.length <= 6 &&
        r.words.every((w) => text(w)) &&
        text(r.letter, 2),
    )
  );
}
