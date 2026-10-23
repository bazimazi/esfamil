import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { ANSWER_PACK, type Answers } from '../shared/game.js';

async function openPracticeReview(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /یه دست بازی کنیم/ }).click();
  const setup = page.getByRole('dialog');
  await setup.getByLabel('چی صدات کنیم؟').fill('سارا');
  await setup.getByRole('button', { name: '۱ دست', exact: true }).click();
  await setup.getByRole('button', { name: 'بزن بریم!', exact: true }).click();
  await expect(page.locator('.answer-sheet')).toBeVisible();
  const letter = (await page.locator('.letter-card > strong').innerText()).trim();
  const pack = ANSWER_PACK[letter as keyof typeof ANSWER_PACK];
  const answers: Answers = {
    name: pack.name[0]!,
    family: `${letter}آزمایشی`,
    city: letter === 'س' ? 'تهران' : 'ساری',
    food: '',
    fruit: pack.fruit[0]!,
    animal: pack.animal[0]!,
  };
  for (const [category, answer] of Object.entries(answers)) {
    await page.locator(`#answer-${category}`).fill(answer);
  }
  await page.locator('.stop-button').click();
  await expect(page.locator('.review-page')).toBeVisible();
  await expect(page.locator('.points-review')).toHaveCount(1);
  await expect(page.locator('.points-invalid').first()).toBeVisible();
}

async function audit(page: Page, testInfo: TestInfo) {
  await page.evaluate(() => document.fonts.ready);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();

  const reportPath = testInfo.outputPath('axe-results.json');
  await writeFile(reportPath, JSON.stringify(results, null, 2));
  await testInfo.attach('axe-results', { path: reportPath, contentType: 'application/json' });

  const failures = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      checks: [...node.any, ...node.all, ...node.none].map((check) => ({
        id: check.id,
        message: check.message,
        data: check.data,
      })),
    })),
  }));

  const summary = failures
    .flatMap((failure) =>
      failure.nodes.map(
        (node) =>
          `${failure.id}: ${node.target.join(' | ')}: ${node.checks.map((check) => check.message).join('; ')}`,
      ),
    )
    .join('\n');
  expect(results.violations.length, summary).toBe(0);
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test.describe(`accessibility ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('home has accessible navigation, heading, and contrast', async ({
      page,
      browserName,
    }, testInfo) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      const skip = page.getByRole('link', { name: 'رفتن به بازی' });
      // Safari can omit links from Tab order according to its browser setting.
      // Verify the link's keyboard activation without assuming that OS setting.
      if (browserName === 'webkit') await skip.focus();
      else await page.keyboard.press('Tab');
      await expect(skip).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('#main-content')).toBeFocused();
      await expect(page).toHaveURL(/#main-content$/);
      await audit(page, testInfo);
    });

    test('rules dialog is named, traps focus, and restores its trigger', async ({
      page,
    }, testInfo) => {
      await page.goto('/');
      const trigger = page.getByRole('button', { name: 'قانون بازی', exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'قانونش ساده‌ست، خاطره‌ش موندنی.' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('heading', { level: 2 })).toBeVisible();
      const close = dialog.getByRole('button', { name: 'بستن پنجره' });
      await expect(close).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(dialog.getByRole('button', { name: /گرفتم، مداد من کو/ })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(close).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(dialog).toBeVisible();
      await audit(page, testInfo);
    });

    test('practice writing has labeled fields and keyboard progression', async ({
      page,
    }, testInfo) => {
      await page.goto('/');
      await page.getByRole('button', { name: /یه دست بازی کنیم/ }).click();
      const setup = page.getByRole('dialog');
      await setup.getByLabel('چی صدات کنیم؟').fill('سارا');
      await setup.getByRole('button', { name: 'بزن بریم!' }).click();

      await expect(page.getByRole('heading', { level: 1 })).toHaveText('حالا نوبتِ کلمه‌های توئه.');
      await expect(page.getByRole('textbox')).toHaveCount(6);
      const labels = [
        { id: 'name', name: /اسم/ },
        { id: 'family', name: /فامیل/ },
        { id: 'city', name: /شهر/ },
        { id: 'food', name: /غذا/ },
        { id: 'fruit', name: /میوه/ },
        { id: 'animal', name: /حیوان/ },
      ];
      for (const label of labels) {
        await expect(page.getByRole('textbox', { name: label.name })).toHaveAttribute(
          'id',
          `answer-${label.id}`,
        );
      }
      const first = page.getByRole('textbox', { name: /اسم/ });
      const second = page.getByRole('textbox', { name: /فامیل/ });
      await first.focus();
      await page.keyboard.press('Enter');
      await expect(second).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(first).toBeFocused();
      await audit(page, testInfo);
    });

    test('setup dialog exposes labeled name and selected rule controls', async ({
      page,
    }, testInfo) => {
      await page.goto('/');
      await page.getByRole('button', { name: /یه دست بازی کنیم/ }).click();
      const dialog = page.getByRole('dialog', { name: 'یه دست گرم کنیم' });
      await expect(dialog.getByRole('heading', { level: 2 })).toBeVisible();
      await dialog.getByLabel('چی صدات کنیم؟').fill('سارا');
      const round = dialog.getByRole('button', { name: '۱ دست', exact: true });
      await round.click();
      await expect(round).toHaveAttribute('aria-pressed', 'true');
      await expect(dialog.getByRole('button', { name: '۳ دست', exact: true })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      const duration = dialog.getByRole('button', { name: '۱۲۰ ثانیه', exact: true });
      await duration.click();
      await expect(duration).toHaveAttribute('aria-pressed', 'true');
      await audit(page, testInfo);
    });

    test('settings dialog labels its name, sound switch, and installation help', async ({
      page,
    }, testInfo) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'تنظیمات و نام بازیکن', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'به سلیقه‌ی خودت' });
      await dialog.getByLabel('نام بازیکن', { exact: true }).fill('سارا');
      const sound = dialog.getByRole('switch', { name: 'صدای بازی', exact: true });
      await sound.focus();
      await page.keyboard.press('Space');
      await expect(sound).toHaveAttribute('aria-checked', 'false');
      await dialog.getByRole('button', { name: 'افزودن به دستگاه', exact: true }).click();
      await expect(dialog.locator('.install-help')).toBeVisible();
      await audit(page, testInfo);
    });

    test('review exposes accepted, rejected, and undecided answers accessibly', async ({
      page,
    }, testInfo) => {
      await openPracticeReview(page);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('table')).toHaveAccessibleName(/مقایسه پاسخ‌ها و امتیازهای دست/);
      await expect(page.getByRole('button', { name: /پذیرش.*آزمایشی/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /رد.*آزمایشی/ })).toBeVisible();
      await audit(page, testInfo);
    });

    test('finished match presents a named result and usable next actions', async ({
      page,
    }, testInfo) => {
      await openPracticeReview(page);
      await page.getByRole('button', { name: 'بریم سراغ نتیجه', exact: true }).click();
      await expect(page.locator('.finish-page')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(
        page.getByRole('button', { name: 'برگردیم به حیاط', exact: true }),
      ).toBeVisible();
      await expect(
        page.locator('.finish-actions').getByRole('button', { name: 'دفتر خاطرات', exact: true }),
      ).toBeVisible();
      await audit(page, testInfo);
    });

    test('online lobby names its invitation and host controls', async ({ page }, testInfo) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'ساخت دورهمی', exact: true }).click();
      const setup = page.getByRole('dialog');
      await setup.getByLabel('چی صدات کنیم؟').fill('سارا');
      await setup.getByRole('button', { name: 'دورهمی رو بساز', exact: true }).click();
      await expect(page.locator('.lobby')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('button', { name: /^کپی دعوت، کد / })).toBeVisible();
      await expect(page.getByRole('button', { name: 'شروع بازی', exact: true })).toBeDisabled();
      await audit(page, testInfo);
    });
  });
}
