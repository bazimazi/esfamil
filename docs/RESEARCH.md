# اسم فامیل — game and platform research

Research date: **22 October 2026**. This document separates observed rules from the design decisions proposed for this repository. Technology comparisons use current official documentation, rather than old claims about engine or browser support. Research informs the implementation; it is not a claim that every feature below has shipped. See [the implementation plan](IMPLEMENTATION_PLAN.md) for delivery stages and release gates.

## 1. What makes this game work

اسم فامیل is a social word game played with a shared initial letter and several categories. Each player privately fills a row, someone calls «استوپ», answers are revealed, and the group compares them. The tension comes from three competing goals: recall an acceptable answer, finish quickly, and avoid the obvious answer everyone else will choose. The review conversation is part of the enjoyment, not an administrative screen to skip.

Persian descriptions agree on this loop but document different house rules. Dano­ma describes familiar columns such as name, surname, city, country, food, fruit, object, flower/color, occupation, and animal; it documents 10 points for a distinct answer, 5 for a duplicate, and a 20-point variant when one player alone fills a column. It also notes that groups may disallow improvised compounds and should agree on rules first. [Dano­ma: steps and rules](https://danoma.ir/post/%D9%85%D8%B1%D8%A7%D8%AD%D9%84-%D9%88-%D9%86%DA%A9%D8%A7%D8%AA-%D8%A8%D8%A7%D8%B2%DB%8C-%D8%A7%D8%B3%D9%85-%D9%81%D8%A7%D9%85%DB%8C%D9%84/)

Other Persian explanations describe a simpler 10/5 system, with zero for empty or unacceptable answers. This variation matters: the digital product should state its scoring profile and letter policy before play instead of implying there is one universally binding rulebook. [NameFarsi: game explanation](https://namefarsi.com/%D8%A7%D8%B3%D9%85-%D9%81%D8%A7%D9%85%DB%8C%D9%84/), [FamilyMag: scoring and group agreement](https://familymag.ir/articles/5474/esm-famil-game)

These are descriptions of customary play, not a national competition standard. This research did not establish a single authoritative Iranian federation ruleset or a reliable historical origin date. Those claims should not appear in marketing copy without further evidence.

### Product implications — our proposed decisions

- Protect the complete loop: invitation → shared rules → letter reveal → private writing → stop → group reveal → understandable scoring → next round → final notebook.
- Keep core rules recognizable. Novelty should come from presentation, social ritual, discovery, and optional modes.
- A room must make time limit, number of rounds, selected categories, stop behavior, scoring, and word-review policy visible before starting.
- Differentiate **private social play** from **ranked competition**. A host settling a family argument can be delightful; a host arbitrarily awarding their own ranked points is unacceptable.
- Do not equate speed with skill for all audiences. Offer a relaxed fixed-timer practice mode alongside classic stop play. Accessibility time accommodations belong in unranked rooms, with the same settings for everyone in that room.

## 2. Rule design and edge cases

The following is a recommended product specification, rather than a quotation from a traditional ruleset.

| Decision | Recommended default | Reason |
| --- | --- | --- |
| Participants | 2–8 humans in private online rooms; one human for local practice | Small enough for readable answers and useful review |
| Core categories | اسم، فامیل، شهر، میوه، حیوان، غذا | Familiar, recognizably Iranian, broad enough for curated letters |
| Optional packs | کشور، رنگ، گل، اشیا، شغل; regional/cultural packs later | Some category/letter combinations are much harder or disputed |
| Match length | 3 rounds in a quick match; longer setting later | A short complete loop before adding progression |
| Round cap | 90 seconds in classic, explicit fixed timer in practice | Prevent a match from stalling if nobody can finish |
| Stop | A player with every field nonempty can call stop; server freezes the accepted drafts | Mirrors the ritual while keeping authority on the server |
| Stop validity | Nonempty is a permission check, not proof of category correctness | A fabricated word must still be reviewable |
| Scoring | Accepted unique 10, accepted shared 5, empty/rejected 0; optional sole-valid-answer 20 | State exactly what the 20-point condition means |
| Letter family | Treat ا and آ as one starting-letter family by default | Avoid a keyboard/orthography trap; display the rule |
| Repeated letters | Without replacement during a match | Variety and predictability |
| Ties | Shared placing; an optional, explicitly chosen tiebreak round | Avoid hidden speed-based tie resolution |
| Late join | Lobby join only; spectator or next match during active play | Fairness and simpler mental model |
| Disconnection | Keep the seat during a short reconnect window; preserve accepted drafts | Mobile connectivity changes should not erase a round |

The sole-answer bonus should mean **only one accepted valid answer in that category**, not merely one distinct word. For example, if two players write سیب and everyone else leaves fruit empty, both receive 5; neither receives 20. If one writes سیب and another writes an invalid fruit, only the accepted سیب receives the optional 20. The room's frozen rules determine the outcome.

Avoid assigning every Persian letter uniformly to every category combination. A letter that is pleasant for names may be punishing for colors or countries. Use a curated eligibility matrix with several verified examples per enabled category. Do not quietly regenerate letters based on a player's answers or score. Advanced rooms can deliberately opt into difficult letters and accept incomplete columns.

### Modes with distinct promises

1. **Classic courtyard:** private group, race to complete, familiar scoring, social review.
2. **Solo notebook:** local timed practice, explanatory answer feedback, personal results; no fabricated online opponents or global ranking claims.
3. **Daily page:** the same local-date challenge for everyone, fixed categories and rules. Until server verification exists, results are personal and unranked.
4. **Family table:** later, one device with concealed handoffs and a fixed timer for each player. It cannot fairly reproduce simultaneous secret writing on a single visible screen, so present it as an adapted mode.
5. **Ranked club:** future, curated category/letter pool and moderated appeals. No gameplay-affecting purchases, hints, letter swaps, or host overrides.

## 3. Persian correctness is game logic

Unicode-equivalent strings and game-equivalent answers are different concepts. Unicode defines canonical and compatibility normalization; it does not decide that two spellings mean the same city or that a word is a fruit. [Unicode Standard Annex #15](https://www.unicode.org/reports/tr15/)

The W3C documents contextual shaping, bidirectional text, and separate Persian and Arabic character forms, including ي versus ی. It is a layout reference and draft note, not a rulebook for word acceptance. [W3C Arabic & Persian Layout Requirements](https://www.w3.org/TR/alreq/)

### Proposed normalization pipeline

Maintain three values: `rawDisplay`, a normalized orthographic comparison key, and an optional category-specific canonical concept ID.

1. Preserve the original answer for display and appeals. Limit length and reject malformed payloads on the server.
2. Normalize comparison text with a documented Unicode form; NFKC is useful for compatibility presentation forms, but must never silently rewrite the player's displayed answer.
3. Map Arabic `ك` to Persian `ک`, and `ي`/`ى` to `ی` for this Persian-language ruleset.
4. Remove tatweel and optional vowel marks from matching keys. Strip direction-control characters from untrusted input or reject them; do not allow them to disguise initials or answers.
5. Trim and collapse whitespace. Maintain a compact comparison key that ignores ordinary spaces and ZWNJ for approved compound aliases, while retaining the legible spelling. Do not infer validity from the compact key alone.
6. Apply the room's initial-letter policy, including the declared ا/آ family. Check the first actual letter after normalization, not the first UTF-16 code unit.
7. Resolve known aliases only inside the selected category. Different transliterations of one country may share a concept ID, while a name and a city with identical spelling remain separate category entries.
8. Compare canonical IDs when known and normalized keys otherwise. Final scores follow the review result and frozen rules.

Do not globally merge س/ص/ث, ز/ذ/ض/ظ, ه/ح, ق/غ, or ء/ئ/ؤ. Similar pronunciation does not make these interchangeable initial letters. Do not remove «ال», «آقا», «خانم», or arbitrary word prefixes globally. Do not accept a typo automatically just because edit distance is small. Spell correction can suggest a review question without changing submitted content.

Useful fixtures include `كيان` ↔ `کیان`, `علي` ↔ `علی`, `سيب` ↔ `سیب`, and a dictionary-approved pair such as `سیب زمینی` ↔ `سیب‌زمینی`. Crucially, a spelling-equivalence fixture does not assert that سیب‌زمینی belongs in the fruit category.

### Dictionary and adjudication

A small hand-curated dictionary is suitable for a transparent prototype and practice explanations. It is not an exhaustive Persian lexicon. Content records should eventually include canonical ID, category IDs, aliases, initial family, evidence/source, locale, age suitability, license/provenance, reviewer, and version. Surnames and local names are especially open-ended; absence from the dictionary cannot establish invalidity.

Use three answer states: **known**, **needs review**, and **rejected with a reason**. Wrong initial, empty answer, and prohibited characters can be rejected mechanically. An unfamiliar name, spelling variant, or borderline category needs a visible review path. Never label a prefix-only validator or finite dictionary as an omniscient AI judge.

For private rooms, the first useful stage is an explicit host-reviewed result with a visible audit of overrides. A fuller design groups duplicate answers and reviews each unique answer once, hiding authors during voting. Define eligible voters, self-vote rules, quorum, tie treatment, absent-player handling, review deadline, and finalization in the room rules. Two-player disputes need mutual agreement or a declared host/referee policy; majority voting cannot magically resolve them. Ranked results require trusted adjudication beyond colluding room votes.

## 4. Competitive landscape and opportunities

One existing browser product advertises private links, 2–8 players, several modes, a daily challenge, leaderboards, coins, and powers. These are the publisher's claims, not functionality verified through a completed match. Its public FAQ raises exactly the hard questions this project must answer clearly: duplicate answers, editing after submission, invalid answers, and disconnects. [Esmfamil.com publisher FAQ](https://esmfamil.com/FAQ)

Our differentiation should be a well-made Persian social game, not a longer feature checklist. The recommended identity is **an Iranian school notebook opened in a neighborhood courtyard**: warm paper, cobalt ink, vermilion stamps, dark green chalk, a pencil margin, a familiar tea glass, and playful handmade details. This is an original design direction for the repository, not competitor-derived artwork. Avoid decorative clichés that impair reading or turn every screen into a museum exhibit.

Original extensions worth testing:

- **دفتر خاطره / shared notebook:** a post-match keepsake of the group's most interesting accepted words. A paper stamp explains which answer was shared, original, or the only accepted one.
- **واژه‌ی تازه / word discovery:** after scoring, explain one unfamiliar accepted word and optionally save it to a personal wordbook. No hint is leaked during competition.
- **حیاط امروز / today's courtyard:** a short personal challenge with seasonal category artwork and fixed fair rules. The calendar changes the atmosphere, not competitive power.
- **مهربان بازی کن / family settings:** slower timer, larger writing, reduced motion, fewer categories, and a no-pressure practice loop.
- **پاتوق / club identity:** earn visual notebook covers, stamp styles, and avatars. Cosmetics can support the game without selling correct answers or time advantages.

Validate these with Persian speakers of different ages before extending progression. Do not assume gamified streaks, chat, currencies, or notifications improve a family game.

## 5. Cross-platform architecture study

### Recommendation

Use **React + TypeScript + semantic HTML/CSS**, built with Vite, as the shared responsive PWA client; use **Node.js + TypeScript + Socket.IO** for authoritative online rooms, with pure shared rule functions and runtime-validated commands. This is an engineering judgment for a text-first social game. It is not a claim that React is inherently better for all games.

Most of the interaction is Persian text entry, focus, reading, invitations, voting, and score explanation. Native browser input controls offer a direct path to mobile keyboards and accessible semantics. CSS/SVG and restrained animation can deliver the notebook personality without a real-time 3D renderer. One browser URL makes a family invitation immediately playable on phones and computers. Share rule types, not trusted authority: the server still validates everything received from clients.

| Approach | Strength for this game | Tradeoff | Decision |
| --- | --- | --- | --- |
| Responsive PWA | One link, DOM text input, rapid iteration, browser reach, optional installation | Browser-specific install behavior; background execution and native integrations vary | **Build first** |
| PWA + Capacitor | Reuse the web client in iOS/Android containers; add haptics, deep links, native integrations | Native toolchains, signing, store review, platform QA remain real work | Add when the web loop is proven |
| Flutter | Supported native mobile, desktop, and web targets; strong custom UI and animation | Dart stack; renderer/semantics and web text entry require their own testing; less code sharing with a TS server | Strong alternative for a native-first team |
| Godot | Excellent 2D scene/animation workflow and native game exports | Web build needs WebAssembly/WebGL 2; extra renderer/input integration for a form-oriented game | Prefer if the product evolves into substantial spatial minigames |
| Unity | Mature game tooling, native exports, animation, and current mobile web support | Engine payload and lifecycle complexity buy little for this word game | Unnecessary for the current core loop |
| Tauri 2 + web client | Reuse HTML/CSS/JS in a desktop/mobile wrapper with native extension options | Rust/native build chain and system-WebView variation; requires wrapper-specific security and QA | Optional desktop distribution after demand |

Capacitor officially provides a web-focused native runtime and plugin access on iOS and Android. It adds a container, not a finished mobile release pipeline. [Capacitor documentation](https://capacitorjs.com/docs)

Flutter officially targets iOS, Android, Windows, macOS, Linux, and web. Its own FAQ documents internationalization and accessibility support. Flutter web exposes semantics through an accessibility layer, which should be deliberately enabled and tested rather than assumed from visual parity. [Flutter platform support](https://docs.flutter.dev/reference/supported-platforms), [Flutter FAQ](https://docs.flutter.dev/resources/faq), [Flutter web accessibility](https://docs.flutter.dev/ui/accessibility/web-accessibility)

Godot's current web exporter requires WebAssembly and WebGL 2; C# projects in Godot 4 cannot currently export to web. Single-threaded export improves compatibility, but mobile performance and payload still require care. [Godot web export](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)

Current Unity 6 documentation explicitly lists supported mobile browsers. The older claim that Unity web never supports phones is outdated. The reason to avoid Unity here is fit and complexity, not a false platform restriction. [Unity 6 browser compatibility](https://docs.unity3d.com/6000.0/Documentation/Manual/webgl-browsercompatibility.html)

Tauri accepts web frontends and targets desktop/mobile; it uses operating-system WebViews, whose versions differ by platform. Test the same web UI inside each wrapper before promising equivalent behavior. [Tauri introduction](https://v2.tauri.app/start/), [Tauri WebView versions](https://v2.tauri.app/reference/webview-versions/)

### Installation, offline play, and native packaging

A manifest describes the installed PWA. Install promotion differs by browser and device. Offline capability is a separate concern: a service worker can cache the application and practice data, but it cannot keep an authoritative multiplayer room running without a reachable server. Service-worker lifecycle and background facilities are constrained by browsers. [MDN installable PWAs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [MDN offline/background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)

Proposed distribution sequence: responsive browser → installable PWA → Android Capacitor package → iOS package using macOS/Xcode and real-device QA → optional Tauri desktop builds. Desktop users already get a full keyboard and browser experience before wrappers exist. Signing, app icons, deep links, support URLs, store metadata, release accounts, device labs, and update behavior are release deliverables, not automatically solved by a shared codebase. Do not claim store-ready apps until signed artifacts have been built and tested.

Offline practice should remain available after a successful initial cache, with a visible offline state. Online room controls should clearly report inability to connect. Never silently replace missing humans with bots. Do not queue a competitive answer offline and later claim it was submitted before the server deadline.

## 6. Authority, fairness, and network reliability

Socket.IO supplies rooms, acknowledgements, reconnection, and optional recovery. It guarantees ordering for delivered messages, but default arrival semantics are at most once. Recovery may fail, so full state synchronization is still necessary. [Socket.IO architecture](https://socket.io/docs/v4/how-it-works), [delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/), [connection recovery](https://socket.io/docs/v4/connection-state-recovery)

The proposed backend owns room rules, membership, phase, letter choice, timers, accepted drafts, stop order, review decisions, scores, and match history. Client clocks animate remaining time; they never authorize writes. Broadcast only public state and the receiving player's own private draft. Other players' answer text must not appear in a payload until reveal, even if the UI intends to hide it.

Useful protocol properties: bounded validated payloads; stable participant identity separate from socket ID; unpredictable resume token; command IDs and acknowledgement; room/round revision; idempotent commands; monotonic state transitions; explicit error codes; and a `sync` path after reconnect. Prefer server receipt time for cutoff acceptance. Do not trust client-supplied timestamps, scores, readiness of another player, host status, or timer completion.

For the first running build, one Node process with in-memory rooms is honest and useful. A restart loses live rooms; document this. Production durability needs persisted matches and resumable sessions. Horizontal scaling needs a shared adapter and room ownership strategy. Socket.IO's long-polling transport requires appropriate session affinity across nodes; a generic Redis pub/sub adapter does not automatically provide connection-state recovery. [Socket.IO multiple nodes](https://socket.io/docs/v4/using-multiple-nodes/), [adapter recovery compatibility](https://socket.io/docs/v4/connection-state-recovery)

External search, generative AI, and another phone cannot be perfectly prevented. Keep friendly play low friction. For ranked play, use short server-timed rounds, curated content, anomaly review, collusion signals, and an appeal mechanism without intrusive monitoring or pretending that focus-loss proves cheating.

## 7. Experience and quality requirements

These are proposed acceptance targets, not performance measurements.

- Persian first: `lang="fa"`, RTL document direction, logical CSS properties, properly isolated LTR room codes, correct Persian digits where appropriate, and no letter spacing that breaks connected script.
- Use actual labels and input elements. Keep typed content intact while focusing and submitting; respect composition events so a mobile keyboard's partially composed word is not accidentally discarded. [MDN composition events](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event)
- On phones, the active field, letter, and timer must remain understandable with the keyboard open. Use large text inputs, at least 44 px product touch targets, safe-area padding, and portrait layouts. On desktop, provide predictable Tab/Shift+Tab and Enter-to-next behavior.
- Make paper texture subtle; never place busy illustration under answer text. Use one original illustration system and purposeful objects. Avoid default dashboard cards, stock gradient blobs, gratuitous floating panels, and decorative progress indicators.
- Keep reveal animations short, readable, and interruptible. Honor reduced motion. Separate sound and haptics preferences; initialize audio after user interaction; keep all results clear without sound.
- Target WCAG 2.2 AA for contrast, focus, keyboard access, labels, and status feedback. Avoid announcing a ticking clock every second to screen readers. Manual assistive-technology testing is required before claiming conformance. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- Self-host critical fonts/assets and avoid dependence on third-party CDNs for basic play. Measure from Iranian networks and modest Android devices, not only a fast development laptop.
- First-load target: keep compressed application JavaScript below 250 KB before optional artwork; avoid layout shift during font loading; keep typing responsive while timers and background decorations animate. Verify actual budgets in release builds.
- Online targets: rapid visible confirmation of saved answers, explicit connection/reconnection state, no hidden answer leakage, and a complete two-client round that survives a temporary connection drop.

## 8. Research limitations and next validation

This is a sourced desk study plus product/engineering recommendations. It does not replace interviews, real-device Persian keyboard testing, a completed competitor usability study, exhaustive lexical validation, load testing, or signed native release validation. Publisher marketing was treated as marketing. No competitor artwork, code, or word database was copied.

Next research should observe at least five real groups spanning teenagers, adults, and mixed-age families; record which categories trigger disputes; test whether a timer feels fair; inspect keyboard-open layouts on iOS/Android; and measure how often unfamiliar but valid answers are rejected. Those findings should change the dictionary, review flow, and room defaults before ranked launch.
