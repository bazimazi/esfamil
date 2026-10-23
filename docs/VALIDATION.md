# First playable validation

Validated on **22 October 2026**. This records the delivered build, not the future production roadmap.

| Check | Result |
| --- | --- |
| TypeScript | `npm run check` passes |
| Production build | `npm run build` passes; generated PWA manifest and service worker |
| Domain and real Socket.IO tests | 20 pass: 14 rules/content tests and 6 network integration tests |
| Chromium browser checks | 24 pass, including the production offline test |
| WebKit browser checks | 24 pass: 16 accessibility checks and 8 gameplay checks |
| Dependency audit | `npm audit` reports no known vulnerabilities in the locked dependency tree |

The browser checks cover full solo matches, saved answers across reloads and expired deadlines, pass-and-play privacy and shared scoring, two independent online players, the Tehran-date daily challenge, accepting and rejecting unfamiliar answers, malformed/obsolete storage recovery, and completing a local game after a production PWA reloads offline.

Accessibility checks cover home, rules, writing, setup, settings, review, final results, and a real online lobby at **1440×1000** and **390×844**. Axe reports no violations of its WCAG 2 A/AA and 2.1 AA checks; no rules are disabled. Tests also check labels, headings, keyboard progression, skip-link activation, modal focus trapping, and focus restoration. Safari's configurable link Tab behavior is respected while verifying actual keyboard activation of the skip link.

The desktop and phone screenshots were visually inspected for Persian text, control clipping, and horizontal overflow. See [desktop](screenshots/desktop.png) and [phone writing screen](screenshots/mobile-game.png). Original vector artwork is rendered by the application. All font files are local; the production precache contains approximately **490 KiB** of application assets before transport compression.

These are headless Chromium and WebKit tests on Windows. They do not replace physical Android/iPhone testing, native keyboard and lifecycle testing, assistive-technology sessions, usability research with Iranian players, load testing, or signed native builds. No Lighthouse score, world-scale readiness, complete dictionary coverage, or native store approval is claimed.

## Reproduce

```sh
npm ci
npm run check
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
npm run test:e2e:webkit
```

The default browser runs start/reuse the development servers and skip the production-only offline scenario. To include it, first build and serve the application on port 3001 (`npm start`, or the development backend after a build), then set `ESFAMIL_TEST_PWA=1` for the browser test process. In PowerShell:

```powershell
$env:ESFAMIL_TEST_PWA = '1'
npm run test:e2e
npm run test:e2e:webkit
```

The PWA scenario uses an isolated browser context, waits for service-worker control, disables networking, reloads, and completes a local match. It does not disable networking on the host computer.
