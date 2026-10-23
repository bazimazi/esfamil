import { describe, expect, it, vi } from 'vitest';
import {
  ANSWER_PACK,
  CATEGORIES,
  LETTERS,
  checkAnswer,
  chooseLetter,
  dailyLetter,
  emptyAnswers,
  faNumber,
  getPracticeRival,
  normalizePersian,
  scoreRound,
  type Answers,
} from '../shared/game.js';

const entry = (playerId: string, answers: Partial<Answers>) => ({
  playerId,
  answers: { ...emptyAnswers(), ...answers },
});

describe('Persian text and validation', () => {
  it('normalizes Arabic glyphs, alef, marks, half-spaces and bidi controls', () => {
    expect(normalizePersian('  \u200fآبـگُوشت\u202c ')).toBe('ابگوشت');
    expect(normalizePersian('كِيْوِي')).toBe('کیوی');
    expect(normalizePersian('شاه\u200cتوت')).toBe(normalizePersian('شاه توت'));
    expect(normalizePersian('إصفهان')).toBe('اصفهان');
    expect(checkAnswer('كِيْوِي', 'ک', 'fruit')).toBe('valid');
    expect(checkAnswer('آرش', 'ا', 'name')).toBe('valid');
  });

  it('separates unfamiliar plausible words from invalid inputs', () => {
    expect(checkAnswer('سامیار', 'س', 'name')).toBe('review');
    expect(checkAnswer('سیب', 'س', 'animal')).toBe('review');
    expect(checkAnswer('سیب', 'ش', 'fruit')).toBe('invalid');
    for (const value of [
      '',
      '  \u200c ',
      'س',
      'س۱۲۳',
      'sara',
      '<script>',
      'سارا!',
      'س،ارا',
      'سارا.',
      'س-ارا',
      'س'.repeat(49),
    ]) {
      expect(checkAnswer(value, 'س', 'name')).toBe('invalid');
    }
  });

  it('has a playable, correctly categorized starter pack for every letter', () => {
    expect(LETTERS.length).toBeGreaterThanOrEqual(12);
    expect(LETTERS.length).toBeLessThanOrEqual(16);
    expect(new Set(LETTERS).size).toBe(LETTERS.length);
    for (const letter of LETTERS) {
      for (const category of CATEGORIES) {
        const answers = ANSWER_PACK[letter][category.id];
        expect(answers.length, `${letter}:${category.id}`).toBeGreaterThanOrEqual(2);
        for (const answer of answers) {
          expect(checkAnswer(answer, letter, category.id), answer).toBe('valid');
        }
      }
    }
  });
});

describe('fair round scoring', () => {
  it('gives unique answers 10 and equivalent shared answers 5', () => {
    const result = scoreRound(
      [
        entry('a', { name: 'آرش', family: 'احمدی', city: 'اصفهان' }),
        entry('b', { name: 'اَرَش', family: 'امیری', city: 'إصفهان' }),
      ],
      'ا',
    );
    expect(result.map((player) => player.total)).toEqual([20, 20]);
    expect(result[0]!.cells[0]).toMatchObject({ answer: 'آرش', points: 5, duplicate: true });
    expect(result[0]!.cells[1]).toMatchObject({ points: 10, duplicate: false });
  });

  it('compares within categories and handles three-way duplicates', () => {
    const result = scoreRound(
      [
        entry('a', { name: 'پروانه', animal: 'پلنگ' }),
        entry('b', { name: 'پریسا', animal: 'پلنگ' }),
        entry('c', { animal: 'پلنگ' }),
        entry('d', { animal: 'پروانه' }),
      ],
      'پ',
    );
    expect(result.map((player) => player.total)).toEqual([15, 15, 5, 10]);
  });

  it('treats explicit spelling aliases as shared answers', () => {
    const fruit = scoreRound([entry('a', { fruit: 'منگو' }), entry('b', { fruit: 'مانگو' })], 'م');
    expect(fruit.map((player) => player.total)).toEqual([5, 5]);
    const food = scoreRound(
      [entry('a', { food: 'خورش قیمه' }), entry('b', { food: 'خورشت قیمه' })],
      'خ',
    );
    expect(food.map((player) => player.total)).toEqual([5, 5]);
    expect(food[1]!.cells[3].answer).toBe('خورشت قیمه');
  });

  it('awards no points to unresolved answers, then recalculates after review', () => {
    const entries = [entry('a', { name: 'سامیار' }), entry('b', { name: 'سامیار' })];
    const pending = scoreRound(entries, 'س');
    expect(pending[0]!.cells[0]).toMatchObject({ status: 'review', points: 0, duplicate: false });
    expect(scoreRound(entries, 'س', { 'a:name': true }).map((p) => p.total)).toEqual([10, 0]);
    expect(
      scoreRound(entries, 'س', { 'a:name': true, 'b:name': true }).map((p) => p.total),
    ).toEqual([5, 5]);
    expect(scoreRound(entries, 'س', { 'a:name': false })[0]!.cells[0].status).toBe('invalid');
  });

  it('lets hosts reject known answers without penalizing the accepted duplicate', () => {
    const result = scoreRound(
      [entry('a', { fruit: 'شاه توت' }), entry('b', { fruit: 'شاه\u200cتوت' })],
      'ش',
      { 'a:fruit': false },
    );
    expect(result.map((player) => player.total)).toEqual([0, 10]);
    expect(result[0]!.cells[4].status).toBe('invalid');
    expect(result[1]!.cells[4].duplicate).toBe(false);
  });

  it('cannot override blanks, malformed text or a wrong starting letter', () => {
    const result = scoreRound([entry('a', { name: 'نوید', family: 'sara' })], 'س', {
      'a:name': true,
      'a:family': true,
      'a:city': true,
    });
    expect(result[0]!.total).toBe(0);
    expect(result[0]!.cells.every((cell) => cell.status === 'invalid')).toBe(true);
  });

  it('preserves original spelling and never mutates supplied entries', () => {
    const entries = [entry('a', { food: 'ته چین' })];
    const before = JSON.stringify(entries);
    expect(scoreRound(entries, 'ت')[0]!.cells[3].answer).toBe('ته چین');
    expect(JSON.stringify(entries)).toBe(before);
    const fresh = emptyAnswers();
    fresh.name = 'سارا';
    expect(emptyAnswers().name).toBe('');
  });
});

describe('round selection and local practice', () => {
  it('produces a deterministic daily letter without reading the system clock', () => {
    expect(dailyLetter('2026-10-22')).toBe(dailyLetter('2026-10-22'));
    expect(LETTERS).toContain(dailyLetter('2026-10-22'));
    const month = new Set(
      Array.from({ length: 31 }, (_, day) => dailyLetter(`2026-10-${day + 1}`)),
    );
    expect(month.size).toBeGreaterThan(5);
  });

  it('avoids used letters, normalizes alef variants, and restarts only when exhausted', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      expect(chooseLetter(['آ'])).toBe('ب');
      expect(chooseLetter([...LETTERS].slice(0, -1))).toBe('ه');
      expect(chooseLetter([...LETTERS])).toBe('ا');
    } finally {
      random.mockRestore();
    }
  });

  it('uses only known answers, misses one category and is stable for a seed', () => {
    for (const letter of LETTERS) {
      const rival = getPracticeRival(letter, 'session-42');
      expect(rival).toEqual(getPracticeRival(letter, 'session-42'));
      expect(Object.values(rival).filter(Boolean)).toHaveLength(5);
      for (const category of CATEGORIES) {
        if (rival[category.id])
          expect(checkAnswer(rival[category.id], letter, category.id)).toBe('valid');
      }
    }
    expect(getPracticeRival('?', 42)).toEqual(emptyAnswers());
  });

  it('formats numbers without changing punctuation', () => {
    expect(faNumber(120)).toBe('۱۲۰');
    expect(faNumber('01:09')).toBe('۰۱:۰۹');
    expect(faNumber(-2.5)).toBe('-۲.۵');
  });
});
