import { mkdir } from 'node:fs/promises';
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test';
import {
  ANSWER_PACK,
  CATEGORIES,
  dailyLetter,
  emptyAnswers,
  faNumber,
  type Answers,
} from '../shared/game.js';
import type { RoomSnapshot } from '../shared/protocol.js';

const DESKTOP = { width: 1440, height: 1000 };
const PHONE = { width: 390, height: 844 };

async function freshContext(
  browser: Browser,
  mobile = false,
  options: BrowserContextOptions = {},
): Promise<BrowserContext> {
  const context = await browser.newContext({
    baseURL: 'http://localhost:5173',
    viewport: mobile ? PHONE : DESKTOP,
    reducedMotion: 'reduce',
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: 1,
    ...options,
  });
  await context.addInitScript(() => {
    // Keep generated audio out of the test environment without altering gameplay.
    if (!localStorage.getItem('esfamil:preferences')) {
      localStorage.setItem(
        'esfamil:preferences',
        JSON.stringify({
          name: '',
          sound: false,
          config: { rounds: 1, duration: 90 },
        }),
      );
    }
  });
  return context;
}

async function configureOneRound(page: Page, playerName: string) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#player-name').fill(playerName);
  await dialog.getByRole('button', { name: '۱ دست', exact: true }).click();
}

async function startSolo(page: Page, playerName = 'سارا') {
  await page.getByRole('button', { name: 'یه دست بازی کنیم', exact: true }).click();
  await configureOneRound(page, playerName);
  await page.getByRole('dialog').getByRole('button', { name: 'بزن بریم!', exact: true }).click();
  await expect(page.locator('.answer-sheet')).toBeVisible();
}

function curatedAnswers(letter: string): Answers {
  const pack = ANSWER_PACK[letter as keyof typeof ANSWER_PACK];
  if (!pack) throw new Error(`No curated answers for displayed letter: ${letter}`);
  return Object.fromEntries(CATEGORIES.map(({ id }) => [id, pack[id][0]])) as Answers;
}

async function fillAnswers(page: Page, answers?: Answers): Promise<Answers> {
  const letter = (await page.locator('.letter-card strong').innerText()).trim();
  const selected = answers ?? curatedAnswers(letter);
  for (const category of CATEGORIES)
    await page.locator(`#answer-${category.id}`).fill(selected[category.id]);
  await expect(page.locator('.sheet-completion')).toContainText('۶');
  return selected;
}

async function expectReviewTotals(page: Page, totals: number[]) {
  await expect(page.locator('.review-page')).toBeVisible();
  const displayed = page.locator('.review-table tfoot td b');
  await expect(displayed).toHaveText(totals.map(faNumber));
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.width + 1);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.width + 1);
}

function observeRoom(page: Page): () => RoomSnapshot | undefined {
  let latest: RoomSnapshot | undefined;
  page.on('websocket', (socket) => {
    socket.on('framereceived', ({ payload }) => {
      const text = typeof payload === 'string' ? payload : payload.toString();
      if (!text.startsWith('42[')) return;
      try {
        const [event, state] = JSON.parse(text.slice(2)) as [string, RoomSnapshot];
        if (event === 'room:state') latest = state;
      } catch {
        /* Other transport frames are irrelevant to these assertions. */
      }
    });
  });
  return () => latest;
}

test('solo answers survive reload, finish a round, and persist one notebook entry', async ({
  browser,
}) => {
  const context = await freshContext(browser);
  const page = await context.newPage();
  try {
    await page.goto('/');
    await startSolo(page);
    const answers = await fillAnswers(page);
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem('esfamil:active-game') ?? 'null')?.answers[0],
        ),
      )
      .toEqual(answers);
    await page.reload();
    await expect(page.locator('.answer-sheet')).toBeVisible();
    for (const category of CATEGORIES)
      await expect(page.locator(`#answer-${category.id}`)).toHaveValue(answers[category.id]);
    await page.getByRole('button', { name: 'استپ! نوشتم', exact: true }).click();
    await expect(page.locator('.review-page')).toBeVisible();
    await expect(page.locator('.review-table tbody tr td:first-of-type .points-valid')).toHaveCount(
      6,
    );
    const scoreText = await page.locator('.review-table tfoot td b').first().innerText();
    const score = Number(
      scoreText.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))),
    );
    expect(score).toBeGreaterThanOrEqual(35);
    expect(score).toBeLessThanOrEqual(60);
    await page.getByRole('button', { name: 'بریم سراغ نتیجه', exact: true }).click();
    await expect(page.locator('.finish-page')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem('esfamil:notebook') ?? '[]').length),
      )
      .toBe(1);
    const persisted = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('esfamil:notebook') ?? '[]'),
    );
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ mode: 'solo', score, max: 60 });
    await page.reload();
    await expect(page.locator('.finish-page')).toBeVisible();
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('esfamil:notebook') ?? '[]').length,
      ),
    ).toBe(1);
    await page.locator('.finish-actions').getByRole('button', { name: 'دفتر خاطرات' }).click();
    await expect(page.getByRole('dialog').locator('.ledger-entries article')).toHaveCount(1);
  } finally {
    await context.close();
  }
});

test('pass-play conceals the first sheet and gives both players shared-answer scores', async ({
  browser,
}) => {
  const context = await freshContext(browser);
  const page = await context.newPage();
  try {
    await page.goto('/');
    await page.locator('.pass-card').click();
    await configureOneRound(page, 'سارا');
    await page.locator('.pass-names input').nth(0).fill('سارا');
    await page.locator('.pass-names input').nth(1).fill('نیما');
    await page.getByRole('dialog').getByRole('button', { name: 'بزن بریم!', exact: true }).click();
    await expect(page.locator('.handoff')).toContainText('سارا');
    await expect(page.locator('.answer-sheet')).toHaveCount(0);
    await page.locator('.handoff button').click();
    const answers = await fillAnswers(page);
    await page.getByRole('button', { name: 'استپ! نوشتم', exact: true }).click();
    await expect(page.locator('.handoff')).toContainText('نیما');
    await expect(page.locator('.answer-sheet')).toHaveCount(0);
    await expect(page.locator('.review-table')).toHaveCount(0);
    await page.locator('.handoff button').click();
    for (const category of CATEGORIES)
      await expect(page.locator(`#answer-${category.id}`)).toHaveValue('');
    await fillAnswers(page, answers);
    await page.getByRole('button', { name: 'استپ! نوشتم', exact: true }).click();
    await expectReviewTotals(page, [30, 30]);
    await expect(page.locator('.review-table tbody .points-valid')).toHaveCount(12);
    await expect(page.locator('.review-table tbody .points-valid')).toHaveText(Array(12).fill('۵'));
    await page.getByRole('button', { name: 'بریم سراغ نتیجه', exact: true }).click();
    await expect(page.locator('.finish-page h1')).toHaveText('رفاقت مساوی شد!');
    await expect(page.locator('.podium strong')).toHaveText(['۳۰ امتیاز', '۳۰ امتیاز']);
  } finally {
    await context.close();
  }
});

test('two independent online players create, join, play, stop and finish one real room', async ({
  browser,
}) => {
  const hostContext = await freshContext(browser);
  const guestContext = await freshContext(browser);
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const hostState = observeRoom(host);
  try {
    await host.goto('/');
    await host.getByRole('button', { name: 'ساخت دورهمی', exact: true }).click();
    await configureOneRound(host, 'سارا');
    await host
      .getByRole('dialog')
      .getByRole('button', { name: 'دورهمی رو بساز', exact: true })
      .click();
    await expect(host.locator('.lobby')).toBeVisible();
    const code = (await host.locator('.room-code b').innerText()).trim();
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    await expect(host.getByRole('button', { name: 'شروع بازی', exact: true })).toBeDisabled();
    await guest.goto('/');
    await guest.getByRole('button', { name: 'کد دارم', exact: true }).click();
    await guest.locator('#join-name').fill('نیما');
    await guest.locator('#join-code').fill(code);
    await guest
      .getByRole('dialog')
      .getByRole('button', { name: 'بریم توی جمع', exact: true })
      .click();
    await expect(guest.locator('.lobby')).toBeVisible();
    await expect(host.locator('.lobby-players .player-chip')).toHaveCount(2);
    await expect(guest.getByRole('button', { name: 'شروع بازی', exact: true })).toHaveCount(0);
    await host.getByRole('button', { name: 'شروع بازی', exact: true }).click();
    await expect(host.locator('.answer-sheet')).toBeVisible();
    await expect(guest.locator('.answer-sheet')).toBeVisible();
    const letter = await host.locator('.letter-card strong').innerText();
    await expect(guest.locator('.letter-card strong')).toHaveText(letter);
    const answers = await fillAnswers(guest);
    await expect(host.locator('#answer-name')).toHaveValue('');
    // Observe the actual broadcast to avoid racing the guest's debounced save.
    await expect
      .poll(() => hostState()?.room.players.find((p) => p.name === 'نیما')?.filled)
      .toBe(6);
    await fillAnswers(host, answers);
    await host.getByRole('button', { name: 'استپ! نوشتم', exact: true }).click();
    await expectReviewTotals(host, [30, 30]);
    await expectReviewTotals(guest, [30, 30]);
    await expect(guest.locator('.answer-sheet')).toHaveCount(0);
    await host.getByRole('button', { name: 'نتیجه‌ی دورهمی', exact: true }).click();
    await expect(host.locator('.finish-page h1')).toHaveText('رفاقت مساوی شد!');
    await expect(guest.locator('.finish-page h1')).toHaveText('رفاقت مساوی شد!');
    await expect(host.locator('.podium strong')).toHaveText(['۳۰ امتیاز', '۳۰ امتیاز']);
    await expect(guest.locator('.podium strong')).toHaveText(['۳۰ امتیاز', '۳۰ امتیاز']);
    for (const page of [host, guest]) {
      await expect
        .poll(() =>
          page.evaluate(() => JSON.parse(localStorage.getItem('esfamil:notebook') ?? '[]').length),
        )
        .toBe(1);
    }
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()]);
  }
});

test('an expired local game restores the saved sheet before automatically reviewing it', async ({
  browser,
}) => {
  const context = await freshContext(browser);
  const page = await context.newPage();
  const answers = curatedAnswers('س');
  const saved = {
    id: 'expired-reload-regression',
    mode: 'solo',
    stage: 'playing',
    config: { rounds: 1, duration: 60 },
    players: [
      { id: 'you', name: 'سارا', score: 0 },
      { id: 'paper', name: 'حریف کاغذی', score: 0 },
    ],
    round: 1,
    activeIndex: 0,
    letter: 'س',
    used: ['س'],
    deadline: Date.now() - 5_000,
    answers: [answers, emptyAnswers()],
    overrides: {},
    dateKey: '2026-10-22',
  };
  try {
    await page.goto('/');
    await page.evaluate(
      (game) => localStorage.setItem('esfamil:active-game', JSON.stringify(game)),
      saved,
    );
    await page.reload();
    await expectReviewTotals(page, [60, 0]);
    for (const [index, category] of CATEGORIES.entries()) {
      await expect(
        page
          .locator('.review-table tbody tr')
          .nth(index)
          .locator('td')
          .first()
          .locator('.review-answer b'),
      ).toHaveText(answers[category.id]);
    }
    const restored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('esfamil:active-game') ?? 'null'),
    );
    expect(restored.stage).toBe('review');
    expect(restored.answers[0]).toEqual(answers);
    await page.getByRole('button', { name: 'بریم سراغ نتیجه', exact: true }).click();
    await expect(page.locator('.finish-page')).toBeVisible();
    await page.reload();
    await expect(page.locator('.finish-page')).toBeVisible();
    const records = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('esfamil:notebook') ?? '[]'),
    );
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ id: saved.id, score: 60, max: 60 });
  } finally {
    await context.close();
  }
});

test('daily mode follows the Tehran date and unfamiliar answers can be accepted and rejected', async ({
  browser,
}) => {
  const context = await freshContext(browser, false, { timezoneId: 'America/Los_Angeles' });
  const page = await context.newPage();
  try {
    // It is still October 22 in Los Angeles, but already October 23 in Tehran.
    await page.clock.setFixedTime(new Date('2026-10-22T21:00:00Z'));
    await page.goto('/');
    const expected = dailyLetter('2026-10-23');
    await expect(page.locator('.daily-letter')).toHaveText(expected);
    await page.locator('.daily-ticket button').click();
    await expect(page.locator('.letter-card strong')).toHaveText(expected);
    await expect(page.locator('.timer b')).toHaveText('۱:۳۰');
    const daily = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('esfamil:active-game') ?? 'null'),
    );
    expect(daily).toMatchObject({
      mode: 'daily',
      dateKey: '2026-10-23',
      config: { rounds: 1, duration: 90 },
    });
    expect(daily.deadline - new Date('2026-10-22T21:00:00Z').getTime()).toBe(90_000);
    expect(expected).toBe('د');
    await page.locator('#answer-name').fill('دلارام');
    await page.getByRole('button', { name: 'ثبت برگه', exact: true }).click();
    await expect(page.locator('.review-page')).toBeVisible();
    const nameCell = page.locator('.review-table tbody tr').first().locator('td').first();
    await expect(nameCell.locator('.points')).toHaveText('؟');
    await expect(page.locator('.review-table tfoot td b').first()).toHaveText('۰');
    await nameCell.getByRole('button', { name: 'پذیرش دلارام', exact: true }).click();
    await expect(nameCell.locator('.points')).toHaveText('۱۰');
    await expect(page.locator('.review-table tfoot td b').first()).toHaveText('۱۰');
    await nameCell.getByRole('button', { name: 'رد دلارام', exact: true }).click();
    await expect(nameCell.locator('.points')).toHaveText('۰');
    await expect(page.locator('.review-table tfoot td b').first()).toHaveText('۰');
    await nameCell.getByRole('button', { name: 'پذیرش دلارام', exact: true }).click();
    await page.getByRole('button', { name: 'بریم سراغ نتیجه', exact: true }).click();
    await expect(page.locator('.finish-page')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem('esfamil:notebook') ?? '[]')[0]?.score),
      )
      .toBe(10);
    const record = await page.evaluate(
      () => JSON.parse(localStorage.getItem('esfamil:notebook') ?? '[]')[0],
    );
    expect(record).toMatchObject({ mode: 'daily', date: '2026-10-23', score: 10, max: 60 });
    await page
      .locator('.finish-actions')
      .getByRole('button', { name: 'برگردیم به حیاط', exact: true })
      .click();
    await page.locator('.daily-ticket button').click();
    await expect(page.locator('.letter-card strong')).toHaveText(expected);
    const replay = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('esfamil:active-game') ?? 'null'),
    );
    expect(replay.answers[1]).toEqual(daily.answers[1]);
  } finally {
    await context.close();
  }
});

test('malformed and obsolete saved data recover to a playable home screen', async ({ browser }) => {
  const context = await freshContext(browser);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('esfamil:active-game', '{');
      localStorage.setItem(
        'esfamil:preferences',
        JSON.stringify({ name: 42, sound: 'yes', config: {} }),
      );
      localStorage.setItem('esfamil:notebook', JSON.stringify([{ id: 'old-version' }]));
    });
    await page.reload();
    await expect(page.locator('.hero h1')).toBeVisible();
    await page.getByRole('button', { name: 'دفتر خاطرات', exact: true }).click();
    await expect(page.locator('.empty-notebook')).toBeVisible();
    await page.getByRole('button', { name: 'بستن پنجره', exact: true }).click();
    await page.evaluate(() =>
      localStorage.setItem(
        'esfamil:active-game',
        JSON.stringify({ stage: 'playing', players: null }),
      ),
    );
    await page.reload();
    await expect(page.locator('.hero h1')).toBeVisible();
    await startSolo(page);
    await expect(page.locator('.answer-sheet')).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('production PWA reloads offline and completes a local game from cached assets', async ({
  browser,
}) => {
  test.skip(
    process.env.ESFAMIL_TEST_PWA !== '1',
    'Run npm run build, serve it on port 3001, then set ESFAMIL_TEST_PWA=1.',
  );
  const context = await freshContext(browser, true, { baseURL: 'http://localhost:3001' });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect(page.locator('.hero h1')).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.hero h1')).toBeVisible();
    await expect(page.locator('.connectivity-note')).toContainText('آفلاینی');
    await startSolo(page);
    await fillAnswers(page);
    await page.screenshot({ path: 'test-results/offline-game.png', fullPage: true });
    await page.getByRole('button', { name: 'استپ! نوشتم', exact: true }).click();
    await expect(page.locator('.review-page')).toBeVisible();
    await page.getByRole('button', { name: 'بریم سراغ نتیجه', exact: true }).click();
    await expect(page.locator('.finish-page')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem('esfamil:notebook') ?? '[]').length),
      )
      .toBe(1);
    await expectNoHorizontalOverflow(page);
  } finally {
    await context.close();
  }
});

test('desktop and phone layouts render without horizontal overflow and save screenshots', async ({
  browser,
}) => {
  await mkdir('test-results', { recursive: true });
  for (const mobile of [false, true]) {
    const context = await freshContext(browser, mobile);
    const page = await context.newPage();
    const label = mobile ? 'mobile' : 'desktop';
    try {
      await page.goto('/');
      await expect(page.locator('.hero h1')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `test-results/${label}.png`, fullPage: true });
      await startSolo(page);
      await expectNoHorizontalOverflow(page);
      for (const category of CATEGORIES) {
        const bounds = await page.locator(`#answer-${category.id}`).boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual((mobile ? PHONE : DESKTOP).width + 1);
      }
      await page.screenshot({ path: `test-results/${label}-game.png`, fullPage: true });
    } finally {
      await context.close();
    }
  }
});
