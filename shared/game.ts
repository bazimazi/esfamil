/**
 * Shared, framework-free rules for اسم فامیل.
 *
 * The small answer pack below is authored for this project. It is a starter
 * lexicon, not an exhaustive Persian dictionary. An unfamiliar, well-formed
 * answer always goes to human review instead of being silently rejected.
 */

export type CategoryId = 'name' | 'family' | 'city' | 'food' | 'fruit' | 'animal';
export type AnswerStatus = 'valid' | 'invalid' | 'review';
export type Answers = Record<CategoryId, string>;

export const CATEGORIES: ReadonlyArray<{
  id: CategoryId;
  label: string;
  icon: string;
  description: string;
}> = [
  { id: 'name', label: 'اسم', icon: '✦', description: 'نام کوچک آدم‌ها' },
  { id: 'family', label: 'فامیل', icon: '❋', description: 'نام خانوادگی' },
  { id: 'city', label: 'شهر', icon: '⌂', description: 'شهرهای ایران و جهان' },
  { id: 'food', label: 'غذا', icon: '◒', description: 'غذا و خوراک آماده' },
  { id: 'fruit', label: 'میوه', icon: '❧', description: 'میوه‌ها؛ تازه یا خشک' },
  { id: 'animal', label: 'حیوان', icon: '♧', description: 'جانوران واقعی' },
];

// A deliberately fair starter alphabet: every letter has answers in all six
// categories, including fruit. Other letters can be added with future packs.
export const LETTERS = [
  'ا',
  'ب',
  'پ',
  'ت',
  'خ',
  'د',
  'ز',
  'س',
  'ش',
  'ک',
  'گ',
  'م',
  'ن',
  'ه',
] as const;

type Letter = (typeof LETTERS)[number];
type AnswerPack = Record<Letter, Record<CategoryId, readonly string[]>>;

/** Original, hand-curated factual word lists; distributed under ../LICENSE. */
export const ANSWER_PACK: AnswerPack = {
  ا: {
    name: ['امیر', 'آرش', 'آوا', 'احمد', 'الهام'],
    family: ['احمدی', 'امیری', 'آذری', 'اسدی'],
    city: ['اصفهان', 'اراک', 'اردبیل', 'آبادان', 'استانبول'],
    food: ['آش', 'آبگوشت', 'آلبالوپلو', 'املت'],
    fruit: ['انار', 'انگور', 'آلبالو', 'آلو', 'انبه'],
    animal: ['اسب', 'آهو', 'اردک', 'الاغ'],
  },
  ب: {
    name: ['بهار', 'بهرام', 'بابک', 'بیتا'],
    family: ['بهرامی', 'بابایی', 'باقری', 'بختیاری'],
    city: ['بابل', 'بوشهر', 'بیرجند', 'بجنورد', 'برلین'],
    food: ['باقالی‌پلو', 'بریانی', 'بورانی', 'باقلاقاتق'],
    fruit: ['به', 'بالنگ', 'بلوبری'],
    animal: ['ببر', 'بز', 'بلبل', 'بوفالو'],
  },
  پ: {
    name: ['پریسا', 'پیمان', 'پروانه', 'پویا'],
    family: ['پارسا', 'پناهی', 'پورمحمدی', 'پیرزاده'],
    city: ['پرند', 'پارس‌آباد', 'پاریس', 'پراگ'],
    food: ['پیتزا', 'پلو', 'پاستا', 'پیراشکی'],
    fruit: ['پرتقال', 'پاپایا', 'پشن‌فروت'],
    animal: ['پلنگ', 'پروانه', 'پاندا', 'پنگوئن'],
  },
  ت: {
    name: ['ترانه', 'تینا', 'تهمینه', 'تورج'],
    family: ['تهرانی', 'تقوی', 'توکلی', 'توحیدی'],
    city: ['تهران', 'تبریز', 'تفت', 'تاکستان', 'توکیو'],
    food: ['ته‌چین', 'تاس‌کباب', 'تاسکباب', 'تاکو', 'تیرامیسو'],
    fruit: ['توت', 'تمرهندی'],
    animal: ['تمساح', 'تشی', 'تنبل'],
  },
  خ: {
    name: ['خسرو', 'خاطره', 'خدیجه', 'خلیل'],
    family: ['خسروی', 'خلیلی', 'خادمی', 'خوشدل'],
    city: ['خرم‌آباد', 'خرمشهر', 'خوی', 'خلخال', 'خاش'],
    food: ['خورش', 'خورشت', 'خورش قیمه', 'خورش قورمه‌سبزی', 'خاگینه'],
    fruit: ['خرما', 'خرمالو', 'خربزه'],
    animal: ['خرس', 'خرگوش', 'خروس', 'خفاش'],
  },
  د: {
    name: ['داریوش', 'دنیا', 'دانیال', 'دریا'],
    family: ['دهقان', 'دانشور', 'درویش', 'داودی'],
    city: ['دامغان', 'دزفول', 'دماوند', 'دورود', 'دوبلین'],
    food: ['دلمه', 'دیزی', 'دمپختک', 'دال عدس'],
    fruit: ['دارابی', 'دوریان'],
    animal: ['دلفین', 'درنا', 'دارکوب', 'دال'],
  },
  ز: {
    name: ['زهرا', 'زینب', 'زهره', 'زانیار'],
    family: ['زارعی', 'زمانی', 'زاهدی', 'زند'],
    city: ['زنجان', 'زاهدان', 'زابل', 'زرند', 'زوریخ'],
    food: ['زرشک‌پلو', 'زیتون‌پرورده', 'زولبیا', 'زیره‌پلو'],
    fruit: ['زردآلو', 'زغال‌اخته', 'زیتون', 'زالزالک'],
    animal: ['زرافه', 'زنبور', 'زالو', 'زاغ'],
  },
  س: {
    name: ['سارا', 'سامان', 'سینا', 'سمیرا'],
    family: ['سعیدی', 'سلیمانی', 'سهرابی', 'ستاری'],
    city: ['ساری', 'سنندج', 'سمنان', 'سبزوار', 'سئول'],
    food: ['سوپ', 'سمبوسه', 'سوشی', 'سالاد', 'سمنو'],
    fruit: ['سیب', 'سنجد', 'سفرجل'],
    animal: ['سگ', 'سنجاب', 'سوسمار', 'سمور'],
  },
  ش: {
    name: ['شادی', 'شهاب', 'شبنم', 'شایان'],
    family: ['شریفی', 'شاکری', 'شاه‌حسینی', 'شفیعی'],
    city: ['شیراز', 'شاهرود', 'شوش', 'شوشتر', 'شیکاگو'],
    food: ['شله‌زرد', 'شامی', 'شیر‌برنج', 'شیشلیک'],
    fruit: ['شلیل', 'شاه‌توت'],
    animal: ['شیر', 'شتر', 'شاهین', 'شغال'],
  },
  ک: {
    name: ['کامران', 'کیوان', 'کتایون', 'کیمیا'],
    family: ['کریمی', 'کاظمی', 'کمالی', 'کاشانی'],
    city: ['کرمان', 'کرج', 'کاشان', 'کرمانشاه', 'کابل'],
    food: ['کباب', 'کتلت', 'کوکو', 'کشک بادمجان', 'کله‌پاچه'],
    fruit: ['کیوی', 'کنار', 'کامکوات'],
    animal: ['کبوتر', 'کوسه', 'کانگورو', 'کفتار'],
  },
  گ: {
    name: ['گیتی', 'گلناز', 'گلاره', 'گودرز'],
    family: ['گودرزی', 'گلستانی', 'گیلانی', 'گنجی'],
    city: ['گرگان', 'گنبد کاووس', 'گچساران', 'گناباد', 'گلاسگو'],
    food: ['گوجه‌پلو', 'گندم‌پلو', 'گولاش', 'گراتن'],
    fruit: ['گیلاس', 'گلابی', 'گریپ‌فروت', 'گوجه‌سبز'],
    animal: ['گربه', 'گاو', 'گرگ', 'گوزن'],
  },
  م: {
    name: ['مریم', 'محمد', 'مینا', 'مهران', 'مهسا'],
    family: ['محمدی', 'مرادی', 'موسوی', 'میرزایی'],
    city: ['مشهد', 'مراغه', 'مریوان', 'میبد', 'مادرید'],
    food: ['ماکارونی', 'میرزاقاسمی', 'مرصع‌پلو', 'موساکا'],
    fruit: ['موز', 'منگو', 'مانگو', 'ملون'],
    animal: ['مار', 'میمون', 'مرغ', 'ماهی', 'مورچه'],
  },
  ن: {
    name: ['نرگس', 'نیما', 'نازنین', 'نوید'],
    family: ['نادری', 'نصیری', 'نجفی', 'نوری'],
    city: ['نیشابور', 'نوشهر', 'نهاوند', 'نائین', 'نیویورک'],
    food: ['نیمرو', 'نرگسی', 'نخودآب', 'نودل'],
    fruit: ['نارنگی', 'نارگیل', 'نارنج', 'نکتارین'],
    animal: ['نهنگ', 'نوک‌اردکی', 'نیزه‌ماهی'],
  },
  ه: {
    name: ['هانیه', 'هدیه', 'هومن', 'هستی'],
    family: ['هاشمی', 'هدایتی', 'همتی', 'هرندی'],
    city: ['همدان', 'هشتگرد', 'هرات', 'هلسینکی'],
    food: ['همبرگر', 'هات‌داگ', 'هلیم'],
    fruit: ['هلو', 'هندوانه'],
    animal: ['هدهد', 'هامستر', 'هشت‌پا'],
  },
};

export function emptyAnswers(): Answers {
  return { name: '', family: '', city: '', food: '', fruit: '', animal: '' };
}

/**
 * Canonical form for comparison, never for changing the player's display text.
 * Spaces and half-spaces are insignificant; Persian/Arabic glyph variants,
 * vowel marks, tatweel and invisible direction controls are equivalent.
 */
export function normalizePersian(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[يى]/gu, 'ی')
    .replace(/ك/gu, 'ک')
    .replace(/[آأإٱ]/gu, 'ا')
    .replace(/\p{M}/gu, '')
    .replace(/[\s\u0640\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/gu, '');
}

// These are spelling variants of the same word, rather than different answers.
// Keep equivalence explicit and category-scoped; do not guess at synonyms.
const spellingAliases: Partial<Record<CategoryId, ReadonlyArray<readonly string[]>>> = {
  food: [
    ['خورش', 'خورشت'],
    ['خورش قیمه', 'خورشت قیمه'],
    ['خورش قورمه‌سبزی', 'خورشت قورمه‌سبزی'],
  ],
  fruit: [['منگو', 'مانگو']],
};

const canonicalSpellings = new Map<string, string>();
for (const category of CATEGORIES) {
  for (const variants of spellingAliases[category.id] ?? []) {
    const canonical = normalizePersian(variants[0]!);
    for (const variant of variants)
      canonicalSpellings.set(`${category.id}:${normalizePersian(variant)}`, canonical);
  }
}

function answerIdentity(answer: string, category: CategoryId): string {
  const normalized = normalizePersian(answer);
  return canonicalSpellings.get(`${category}:${normalized}`) ?? normalized;
}

const knownAnswers = new Map<string, Set<string>>();
for (const letter of LETTERS) {
  for (const category of CATEGORIES) {
    knownAnswers.set(
      `${letter}:${category.id}`,
      new Set(
        ANSWER_PACK[letter][category.id].map((answer) => answerIdentity(answer, category.id)),
      ),
    );
  }
}

function hasPlausibleShape(answer: string): boolean {
  return (
    answer.length >= 2 &&
    answer.length <= 48 &&
    /^[\u0621-\u063a\u0641-\u064a\u066e-\u066f\u0671-\u06d3\u06fa-\u06fc]+$/u.test(answer)
  );
}

export function checkAnswer(answer: string, letter: string, category: CategoryId): AnswerStatus {
  const normalized = normalizePersian(answer);
  const normalizedLetter = normalizePersian(letter);
  if (
    !hasPlausibleShape(normalized) ||
    normalizedLetter.length !== 1 ||
    !normalized.startsWith(normalizedLetter)
  ) {
    return 'invalid';
  }
  return knownAnswers.get(`${normalizedLetter}:${category}`)?.has(answerIdentity(answer, category))
    ? 'valid'
    : 'review';
}

export interface ScoredCell {
  category: CategoryId;
  answer: string;
  status: AnswerStatus;
  points: number;
  duplicate: boolean;
}

export interface ScoredPlayer {
  playerId: string;
  total: number;
  cells: ScoredCell[];
}

/**
 * Unique accepted answer = 10; repeated accepted answer = 5; everything else = 0.
 * Overrides resolve human review by `${playerId}:${category}`. A host can also
 * reject a known answer. Blank, malformed and wrong-letter text cannot be
 * accepted by an override. Inputs and original spellings are left untouched.
 */
export function scoreRound(
  entries: Array<{ playerId: string; answers: Answers }>,
  letter: string,
  overrides: Record<string, boolean> = {},
): ScoredPlayer[] {
  const players: ScoredPlayer[] = entries.map(({ playerId, answers }) => ({
    playerId,
    total: 0,
    cells: CATEGORIES.map(({ id }) => {
      const initial = checkAnswer(answers[id], letter, id);
      const overrideKey = `${playerId}:${id}`;
      const hasOverride = Object.prototype.hasOwnProperty.call(overrides, overrideKey);
      const status =
        initial !== 'invalid' && hasOverride
          ? overrides[overrideKey]
            ? 'valid'
            : 'invalid'
          : initial;
      return { category: id, answer: answers[id], status, points: 0, duplicate: false };
    }),
  }));

  const occurrences = new Map<string, number>();
  for (const player of players) {
    for (const cell of player.cells) {
      if (cell.status !== 'valid') continue;
      const key = `${cell.category}:${answerIdentity(cell.answer, cell.category)}`;
      occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
    }
  }
  for (const player of players) {
    for (const cell of player.cells) {
      if (cell.status !== 'valid') continue;
      cell.duplicate =
        (occurrences.get(`${cell.category}:${answerIdentity(cell.answer, cell.category)}`) ?? 0) >
        1;
      cell.points = cell.duplicate ? 5 : 10;
      player.total += cell.points;
    }
  }
  return players;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Local computer opponent: deterministic, curated, and intentionally imperfect. */
export function getPracticeRival(letter: string, seed: number | string = 0): Answers {
  const canonical = normalizePersian(letter);
  const pack = ANSWER_PACK[canonical as Letter];
  const answers = emptyAnswers();
  if (!pack) return answers;
  const missed = stableHash(`${seed}:${canonical}:missed`) % CATEGORIES.length;
  for (const [index, category] of CATEGORIES.entries()) {
    if (index === missed) continue;
    const choices = pack[category.id];
    answers[category.id] =
      choices[stableHash(`${seed}:${canonical}:${category.id}`) % choices.length] ?? '';
  }
  return answers;
}

/** dateKey is an explicit local YYYY-MM-DD string; no device timezone is read. */
export function dailyLetter(dateKey: string): string {
  return LETTERS[stableHash(dateKey) % LETTERS.length]!;
}

/** Avoid repeats until this alphabet is exhausted, then start a fresh cycle. */
export function chooseLetter(used: string[] = []): string {
  const previous = new Set(used.map(normalizePersian));
  const available = LETTERS.filter((letter) => !previous.has(letter));
  const pool: readonly string[] = available.length > 0 ? available : LETTERS;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function faNumber(value: number | string): string {
  return String(value).replace(/\d/gu, (digit) => PERSIAN_DIGITS[Number(digit)]!);
}
