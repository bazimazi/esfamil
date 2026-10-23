import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  outputDir: 'test-results/artifacts',
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    launchOptions: process.env.ESFAMIL_CHROMIUM_PATH
      ? { executablePath: process.env.ESFAMIL_CHROMIUM_PATH }
      : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
