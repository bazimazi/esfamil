import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  Clock3,
  Copy,
  Download,
  Flag,
  Heart,
  HelpCircle,
  Home,
  Link,
  LoaderCircle,
  MonitorSmartphone,
  Pencil,
  Plus,
  Settings2,
  Sun,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  CATEGORIES,
  checkAnswer,
  chooseLetter,
  dailyLetter,
  emptyAnswers,
  faNumber,
  getPracticeRival,
  normalizePersian,
  scoreRound,
  type Answers,
  type CategoryId,
} from '../shared/game';
import { DEFAULT_CONFIG, type GameConfig, type RoundResult } from '../shared/protocol';
import { Flower, Logo, NotebookArt } from './components/Illustrations';
import { PwaNotice } from './components/PwaNotice';
import { persianDate, playSound, tehranDateKey, useStored } from './lib/storage';
import { useRoom } from './lib/useRoom';
import {
  validLocalGame,
  validPreferences,
  validRecords,
  type Mode,
  type LocalGame,
  type Player,
  type Preferences,
  type RecordEntry,
} from './lib/schemas';

type ModalKind = 'rules' | 'settings' | 'ledger' | 'setup' | 'join' | 'leave' | null;
const MODE_LABELS: Record<Mode, string> = {
  solo: 'تمرین با حریف کاغذی',
  daily: 'حرفِ امروز',
  pass: 'دورهمی نوبتی',
  online: 'دورهمی آنلاین',
};
const PREVIEW_HINTS: Record<CategoryId, string> = {
  name: 'اسم کوچیک، دختر یا پسر',
  family: 'یک نام خانوادگی',
  city: 'یک گوشه از ایران یا دنیا',
  food: 'بوی غذای خوب میاد…',
  fruit: 'از باغِ کلمه‌ها بچین',
  animal: 'از دنیای جانورها',
};

function Modal({
  title,
  children,
  onClose,
  wide = false,
  restoreFocusTo,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  restoreFocusTo?: HTMLElement | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Safari does not focus mouse-clicked buttons. Capture the actual opener,
    // including keyboard-generated clicks, instead of relying on activeElement.
    const previous = restoreFocusTo?.isConnected
      ? restoreFocusTo
      : (document.activeElement as HTMLElement | null);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input,select,a[href],[tabindex="0"]',
        ) || [],
      );
    focusables()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const nodes = focusables();
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', key);
      previous?.focus({ preventScroll: true });
    };
  }, [onClose, restoreFocusTo]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal paper ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" aria-label="بستن پنجره" onClick={onClose}>
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function App() {
  const [preferences, setPreferences] = useStored<Preferences>(
    'preferences',
    { name: '', sound: true, config: DEFAULT_CONFIG },
    validPreferences,
  );
  const [local, setLocal] = useStored<LocalGame | null>('active-game', null, validLocalGame);
  const [records, setRecords] = useStored<RecordEntry[]>('notebook', [], validRecords);
  const [modal, setModal] = useState<ModalKind>(null);
  const [mode, setMode] = useState<Mode>('solo');
  const [config, setConfig] = useState<GameConfig>(preferences.config);
  const [playerName, setPlayerName] = useState(preferences.name);
  const [passNames, setPassNames] = useState(['', '']);
  const [joinCode, setJoinCode] = useState(new URLSearchParams(location.search).get('room') || '');
  const [draft, setDraft] = useState<Answers>(() =>
    local?.stage === 'playing' ? local.answers[local.activeIndex] : emptyAnswers(),
  );
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<
    (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null
  >(null);
  const [installHelp, setInstallHelp] = useState(false);
  const room = useRoom();
  const snapshot = room.snapshot;
  const networkGame = !!snapshot;
  const currentRoom = snapshot?.room;
  const gamePhase = currentRoom?.phase || local?.stage;
  const inGame = !!local || networkGame;
  const activeLetter = currentRoom?.letter || local?.letter || '';
  const activeDeadline = currentRoom?.deadline || local?.deadline || 0;
  const playing = gamePhase === 'playing';
  const duration = currentRoom?.config.duration || local?.config.duration || 90;
  const seconds = Math.max(
    0,
    Math.ceil((activeDeadline - now - (networkGame ? room.clockOffset : 0)) / 1000),
  );
  const isHost = snapshot?.playerId === currentRoom?.hostId;
  const today = tehranDateKey();
  const dailyBest = Math.max(
    0,
    ...records.filter((r) => r.mode === 'daily' && r.date === today).map((r) => r.score),
  );
  const closeModal = useCallback(() => {
    setModal(null);
    setInstallHelp(false);
  }, []);
  const notify = useCallback((message: string) => setToast(message), []);
  const previousOnlineRound = useRef('');
  const lastPhase = useRef<string | undefined>(undefined);
  const lastDialogTrigger = useRef<HTMLElement | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener('online', change);
    window.addEventListener('offline', change);
    const install = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as typeof installPrompt);
    };
    window.addEventListener('beforeinstallprompt', install);
    return () => {
      window.removeEventListener('online', change);
      window.removeEventListener('offline', change);
      window.removeEventListener('beforeinstallprompt', install);
    };
  }, []);
  useEffect(() => {
    if (joinCode && !inGame) setModal('join');
  }, []); // An invite opens its join sheet once.
  useEffect(() => {
    const key = snapshot
      ? `${snapshot.room.code}:${snapshot.room.round}:${snapshot.room.phase}`
      : '';
    if (snapshot && key !== previousOnlineRound.current) {
      previousOnlineRound.current = key;
      if (snapshot.room.phase === 'playing') {
        setDraft(snapshot.answers);
        setModal(null);
      }
    }
  }, [snapshot]);
  useEffect(() => {
    if (gamePhase !== lastPhase.current) {
      if (gamePhase === 'playing') playSound('start', preferences.sound);
      if (gamePhase === 'review') playSound('stop', preferences.sound);
      if (gamePhase === 'finished') playSound('win', preferences.sound);
      lastPhase.current = gamePhase;
    }
  }, [gamePhase, preferences.sound]);
  useEffect(() => {
    if (!snapshot || snapshot.room.phase !== 'playing') return;
    const timer = setTimeout(() => {
      void room.update(draft);
    }, 160);
    return () => clearTimeout(timer);
  }, [draft, snapshot?.room.code, snapshot?.room.round, snapshot?.room.phase]);

  const localResults = useMemo(
    () =>
      local
        ? scoreRound(
            local.players.map((p, i) => ({ playerId: p.id, answers: local.answers[i] })),
            local.letter,
            local.overrides,
          )
        : [],
    [local],
  );
  const results: RoundResult[] = currentRoom?.results || localResults;
  const players = currentRoom?.players || local?.players || [];
  const filled = CATEGORIES.filter((c) => normalizePersian(draft[c.id])).length;

  const finishLocalTurn = useCallback(() => {
    setLocal((previous) => {
      if (!previous || previous.stage !== 'playing') return previous;
      const answers = [...previous.answers];
      answers[previous.activeIndex] = { ...draftRef.current };
      if (previous.mode === 'pass' && previous.activeIndex < previous.players.length - 1)
        return {
          ...previous,
          answers,
          activeIndex: previous.activeIndex + 1,
          stage: 'handoff',
          deadline: 0,
        };
      return { ...previous, answers, stage: 'review', deadline: 0 };
    });
  }, [setLocal]);
  useEffect(() => {
    if (local?.stage === 'playing' && seconds === 0 && !networkGame) finishLocalTurn();
  }, [local?.stage, seconds, networkGame, finishLocalTurn]);
  // Keep local drafts on disk; the absolute deadline continues across reloads.
  useEffect(() => {
    if (local?.stage !== 'playing' || networkGame) return;
    setLocal((previous) => {
      if (!previous || previous.stage !== 'playing') return previous;
      const answers = [...previous.answers];
      answers[previous.activeIndex] = draft;
      return { ...previous, answers };
    });
  }, [draft]);
  useEffect(() => {
    if (local?.stage === 'playing' && !networkGame) setDraft(local.answers[local.activeIndex]);
  }, [local?.id, local?.round, local?.activeIndex, local?.stage]);
  useEffect(() => {
    if (gamePhase !== 'finished') return;
    const own = networkGame ? players.find((p) => p.id === snapshot?.playerId) : players[0];
    if (!own) return;
    const id = networkGame ? `room:${currentRoom!.code}:${own.id}` : local!.id;
    const words =
      results
        .find((r) => r.playerId === own.id)
        ?.cells.filter((c) => c.points === 10)
        .map((c) => c.answer) || [];
    const record: RecordEntry = {
      id,
      date: local?.dateKey || today,
      mode: networkGame ? 'online' : local!.mode,
      score: own.score,
      max: (currentRoom?.config.rounds || local!.config.rounds) * 60,
      words,
      letter: activeLetter,
    };
    setRecords((previous) =>
      previous.some((r) => r.id === id) ? previous : [record, ...previous].slice(0, 100),
    );
  }, [gamePhase]);

  function openSetup(nextMode: Mode) {
    setMode(nextMode);
    setConfig(preferences.config);
    setPlayerName(preferences.name);
    setModal('setup');
    playSound('tap', preferences.sound);
  }
  function startLocal(nextMode: Exclude<Mode, 'online'>, customConfig = config) {
    const name = playerName.trim() || preferences.name || 'شما';
    setPreferences((p) => ({ ...p, name, config: customConfig }));
    const selectedConfig =
      nextMode === 'daily' ? { rounds: 1 as const, duration: 90 as const } : customConfig;
    const letter = nextMode === 'daily' ? dailyLetter(today) : chooseLetter();
    const id = crypto.randomUUID();
    const selectedPlayers: Player[] =
      nextMode === 'pass'
        ? passNames.map((n, i) => ({
            id: `local-${i}`,
            name: n.trim() || (i === 0 ? name : `بازیکن ${faNumber(i + 1)}`),
            score: 0,
          }))
        : [
            { id: 'you', name, score: 0 },
            { id: 'paper', name: 'حریف کاغذی', score: 0 },
          ];
    const answers = selectedPlayers.map((p) =>
      p.id === 'paper'
        ? getPracticeRival(letter, nextMode === 'daily' ? today : id)
        : emptyAnswers(),
    );
    setDraft(emptyAnswers());
    setNow(Date.now());
    setLocal({
      id,
      mode: nextMode,
      stage: nextMode === 'pass' ? 'handoff' : 'playing',
      config: selectedConfig,
      players: selectedPlayers,
      round: 1,
      activeIndex: 0,
      letter,
      used: [letter],
      deadline: Date.now() + selectedConfig.duration * 1000,
      answers,
      overrides: {},
      dateKey: today,
    });
    setModal(null);
  }
  async function createOnline() {
    if (local) setLocal(null);
    const ok = await room.create(playerName.trim() || preferences.name || 'میزبان', config);
    if (ok) {
      setPreferences((p) => ({ ...p, name: playerName.trim() || 'میزبان', config }));
      setModal(null);
    }
  }
  async function joinOnline() {
    const ok = await room.join(joinCode, playerName.trim() || preferences.name || 'هم‌بازی');
    if (ok) {
      setLocal(null);
      setPreferences((p) => ({ ...p, name: playerName.trim() || 'هم‌بازی' }));
      setModal(null);
      history.replaceState(null, '', location.pathname);
    }
  }
  function nextLocal() {
    if (!local) return;
    const updated = local.players.map((p) => ({
      ...p,
      score: p.score + (localResults.find((r) => r.playerId === p.id)?.total || 0),
    }));
    if (local.round === local.config.rounds) {
      setLocal({ ...local, players: updated, stage: 'finished' });
      return;
    }
    const letter = chooseLetter(local.used);
    const answers = updated.map((p) =>
      p.id === 'paper'
        ? getPracticeRival(letter, `${local.id}:${local.round + 1}`)
        : emptyAnswers(),
    );
    setDraft(emptyAnswers());
    setNow(Date.now());
    setLocal({
      ...local,
      players: updated,
      round: local.round + 1,
      letter,
      used: [...local.used, letter],
      activeIndex: 0,
      answers,
      overrides: {},
      stage: local.mode === 'pass' ? 'handoff' : 'playing',
      deadline: Date.now() + local.config.duration * 1000,
    });
  }
  async function stop() {
    if (networkGame) {
      const saved = await room.update(draft);
      if (saved) await room.stop();
    } else finishLocalTurn();
  }
  async function leaveGame() {
    if (networkGame) await room.leave();
    setLocal(null);
    setDraft(emptyAnswers());
    setModal(null);
  }
  async function copyInvite() {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('room', currentRoom!.code);
    try {
      await navigator.clipboard.writeText(url.toString());
      notify('لینک دعوت کپی شد. برای دوستت بفرست!');
    } catch {
      notify(`کد دورهمی: ${currentRoom!.code}`);
    }
  }
  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } else {
      setInstallHelp(true);
      setModal('settings');
    }
  }
  const ownId = networkGame ? snapshot!.playerId : local?.players[0].id;
  const roundNumber = currentRoom?.round || local?.round || 1;
  const roundCount = currentRoom?.config.rounds || local?.config.rounds || 3;
  const rankedPlayers = [...players]
    .sort((a, b) => b.score - a.score)
    .map((p, _, all) => ({ ...p, rank: all.findIndex((other) => other.score === p.score) + 1 }));

  return (
    <div
      className="app-shell"
      onClickCapture={(event) => {
        if (!(event.target instanceof Element) || event.target.closest('[role="dialog"]')) return;
        const control = event.target.closest<HTMLElement>('button,a');
        if (control) lastDialogTrigger.current = control;
      }}
    >
      <a className="skip-link" href="#main-content">
        رفتن به بازی
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            aria-label="اسم فامیل، خانه"
            onClick={() =>
              inGame ? setModal('leave') : window.scrollTo({ top: 0, behavior: 'smooth' })
            }
          >
            <Logo />
            <span className="brand-caption">یک حرف، هزار خاطره</span>
          </button>
          <nav aria-label="منوی اصلی">
            <button
              className={!inGame ? 'nav-active' : ''}
              onClick={() =>
                inGame ? setModal('leave') : window.scrollTo({ top: 0, behavior: 'smooth' })
              }
            >
              حیاط بازی
            </button>
            <button onClick={() => setModal('ledger')}>دفتر خاطرات</button>
            <button onClick={() => setModal('rules')}>چطور بازی کنیم؟</button>
          </nav>
          <div className="header-actions">
            <button
              className="icon-button sound-button"
              title={preferences.sound ? 'خاموش کردن صدا' : 'روشن کردن صدا'}
              aria-label={preferences.sound ? 'خاموش کردن صدا' : 'روشن کردن صدا'}
              onClick={() => setPreferences((p) => ({ ...p, sound: !p.sound }))}
            >
              {preferences.sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button
              className="profile-button"
              onClick={() => setModal('settings')}
              aria-label="تنظیمات و نام بازیکن"
            >
              <span>{preferences.name ? preferences.name.slice(0, 1) : 'م'}</span>
              <b>{preferences.name || 'مهمونِ ما'}</b>
              <Settings2 size={16} />
            </button>
          </div>
        </div>
      </header>

      {!online && (
        <div className="connectivity-note">
          <WifiOff size={16} /> آفلاینی؛ تمرین و دورهمی نوبتی همچنان کار می‌کنن.
        </div>
      )}
      {room.error && (
        <div className="error-banner" role="alert">
          <span>{room.error}</span>
          <button className="icon-button" aria-label="بستن پیام" onClick={room.clearError}>
            <X size={18} />
          </button>
        </div>
      )}
      {networkGame && !room.connected && (
        <div className="connectivity-note">
          <LoaderCircle size={16} className="spin" /> در حال اتصال دوباره به دورهمی…
        </div>
      )}

      <main id="main-content" tabIndex={-1}>
        {!inGame && (
          <div className="home-page">
            <section className="hero wrap">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="tiny-star">✳</span> جمعمون با تو جمعه!
                </div>
                <h1>
                  اسم، فامیل،
                  <br />
                  <span className="underlined">دوباره دور هم.</span>
                </h1>
                <p>
                  همون بازیِ پشتِ دفتر مشق؛ این بار، هر جا که باشی.
                  <br className="desktop-break" /> یه حرف انتخاب می‌شه، خاطره‌ها شروع می‌شن.
                </p>
                <div className="hero-cta">
                  <button
                    className="button button-orange button-large"
                    onClick={() => openSetup('solo')}
                  >
                    یه دست بازی کنیم <ArrowLeft size={24} />
                  </button>
                  <span>
                    <MonitorSmartphone size={17} /> روی گوشی و کامپیوتر
                  </span>
                </div>
                <div className="hero-footnote">
                  <span className="green-dot" /> بدون ثبت‌نام، بی‌دردسر، مثل قدیما.
                </div>
              </div>
              <NotebookArt />
            </section>
            <section className="play-section wrap" aria-labelledby="modes-title">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">مدادها آماده؟</span>
                  <h2 id="modes-title">امروز چطور بازی کنیم؟</h2>
                </div>
                <span className="heading-note">
                  برای هر جمعی، یه جور بازی <span>↙</span>
                </span>
              </div>
              <div className="mode-grid">
                <button className="mode-card practice-card" onClick={() => openSetup('solo')}>
                  <div className="mode-card-top">
                    <span className="mode-symbol">
                      <Pencil size={27} />
                    </span>
                    <span className="card-tag">بی‌نیاز از اینترنت</span>
                  </div>
                  <h3>یه دست گرم کنیم</h3>
                  <p>
                    تنهایی، با یه حریف کاغذی.
                    <br />
                    برای وقتی که کلمه‌ها نوکِ زبونتن.
                  </p>
                  <span className="card-action">
                    شروع تمرین <ArrowLeft size={20} />
                  </span>
                  <span className="card-number" aria-hidden="true" />
                </button>
                <div className="mode-card friends-card">
                  <div className="mode-card-top">
                    <span className="mode-symbol">
                      <Users size={29} />
                    </span>
                    <span className="card-tag">۲ تا ۸ هم‌بازی</span>
                  </div>
                  <h3>بچه‌ها رو صدا کن!</h3>
                  <p>
                    یه دورهمی بساز، لینک رو بفرست.
                    <br />
                    دور هم، حتی از راه دور.
                  </p>
                  <div className="friends-actions">
                    <button onClick={() => openSetup('online')}>
                      ساخت دورهمی <Plus size={18} />
                    </button>
                    <button
                      className="join-link"
                      onClick={() => {
                        setPlayerName(preferences.name);
                        setModal('join');
                      }}
                    >
                      کد دارم <ChevronLeft size={17} />
                    </button>
                  </div>
                  <span className="card-number" aria-hidden="true" />
                </div>
                <button className="mode-card pass-card" onClick={() => openSetup('pass')}>
                  <div className="mode-card-top">
                    <span className="mode-symbol">
                      <Heart size={28} />
                    </span>
                    <span className="card-tag">۲ تا ۴ نفر، یک دستگاه</span>
                  </div>
                  <h3>همین‌جا، کنار هم</h3>
                  <p>
                    گوشی رو دست‌به‌دست کنین؛
                    <br />
                    هر نفر یه برگه، هر برگه یه خاطره.
                  </p>
                  <span className="card-action">
                    شروع دورهمی نوبتی <ArrowLeft size={20} />
                  </span>
                  <span className="card-number" aria-hidden="true" />
                </button>
              </div>
            </section>
            <section className="daily-ticket wrap" aria-labelledby="daily-title">
              <div className="daily-letter">{dailyLetter(today)}</div>
              <div className="daily-copy">
                <div className="section-kicker">
                  <Sun size={15} /> حرفِ امروز <span> / {persianDate()}</span>
                </div>
                <h2 id="daily-title">یک حرف مشترک، هزار تا جواب متفاوت.</h2>
                <p>۹۰ ثانیه برای کلمه‌های تازه. هر روز یه بهونه برای برگشتن.</p>
              </div>
              <div className="daily-action">
                {dailyBest > 0 && <small>بهترینِ امروزت: {faNumber(dailyBest)} از ۶۰</small>}
                <button className="button button-outline" onClick={() => startLocal('daily')}>
                  {dailyBest ? 'دوباره امتحان کنیم' : 'چالش امروز رو بازی کن'}{' '}
                  <ArrowLeft size={19} />
                </button>
              </div>
              <span className="ticket-hole hole-top" />
              <span className="ticket-hole hole-bottom" />
            </section>
            <div className="home-bottom wrap">
              <span>
                <Flower /> کلمه‌ها بهونه‌ان، کنار هم بودن قشنگه.
              </span>
              <button onClick={() => void install()}>
                <Download size={16} /> روی دستگاهت نگهش دار
              </button>
            </div>
          </div>
        )}

        {inGame && (
          <div className="game-page wrap">
            <div className="game-topline">
              <button className="text-button" onClick={() => setModal('leave')}>
                <ArrowRight size={17} /> برگشت به حیاط
              </button>
              <span className="game-mode-label">
                {networkGame ? (
                  <>
                    <Wifi size={15} /> دورهمی {currentRoom!.code}
                  </>
                ) : (
                  MODE_LABELS[local!.mode]
                )}
              </span>
              <button
                className="icon-button"
                aria-label="قوانین بازی"
                onClick={() => setModal('rules')}
              >
                <HelpCircle size={21} />
              </button>
            </div>

            {currentRoom?.phase === 'lobby' && (
              <section className="lobby paper">
                <div className="eyebrow">
                  <span className="green-dot" /> دورهمی‌مون داره جور می‌شه
                </div>
                <h1>
                  {currentRoom.round > 0 ? 'یه نفس تازه، یه حرف تازه.' : 'صندلیِ دوستات خالیه!'}
                </h1>
                <p>
                  {currentRoom.round > 0
                    ? 'امتیازها ثبت شدن. برای حرف بعدی آماده‌این؟'
                    : 'با کد یا لینک دعوت، دوستات رو به این دورهمی بیار.'}
                </p>
                <button
                  className="room-code"
                  onClick={() => void copyInvite()}
                  aria-label={`کپی دعوت، کد ${currentRoom.code}`}
                >
                  <b dir="ltr">{currentRoom.code}</b>
                  <Copy size={21} />
                </button>
                <div className="lobby-players">
                  {players.map((p, i) => (
                    <div key={p.id} className={`player-chip player-color-${i % 4}`}>
                      <span className="avatar">{p.name.slice(0, 1)}</span>
                      <b>{p.name}</b>
                      {p.id === currentRoom.hostId && <small>میزبان</small>}
                      <span className={p.connected ? 'green-dot' : 'gray-dot'} />
                    </div>
                  ))}
                </div>
                <div className="lobby-config">
                  <span>{faNumber(currentRoom.config.rounds)} دست</span>
                  <i />
                  <span>هر دست {faNumber(currentRoom.config.duration)} ثانیه</span>
                  <i />
                  <span>۶ ستون</span>
                </div>
                <div className="lobby-buttons">
                  <button className="button button-outline" onClick={() => void copyInvite()}>
                    <Link size={18} /> کپی لینک دعوت
                  </button>
                  {isHost ? (
                    <button
                      className="button button-blue"
                      disabled={
                        (currentRoom.round === 0 &&
                          currentRoom.players.filter((p) => p.connected).length < 2) ||
                        room.busy
                      }
                      onClick={() => void (currentRoom.round > 0 ? room.next() : room.start())}
                    >
                      {room.busy ? (
                        <LoaderCircle className="spin" size={19} />
                      ) : (
                        <ArrowLeft size={19} />
                      )}{' '}
                      {currentRoom.round > 0 ? 'دست بعدی' : 'شروع بازی'}
                    </button>
                  ) : (
                    <p className="waiting-note">
                      <Clock3 size={17} /> منتظر شروع بازی توسط میزبان…
                    </p>
                  )}
                </div>
                <small className="honest-note">
                  {currentRoom.round === 0 &&
                  currentRoom.players.filter((p) => p.connected).length < 2
                    ? 'برای شروع، حداقل دو نفر باید وصل باشن.'
                    : 'جواب‌ها تا پایان هر دست برای بقیه پنهان می‌مونن.'}
                </small>
              </section>
            )}

            {local?.stage === 'handoff' && !networkGame && (
              <section className="handoff paper">
                <div className="handoff-icon">
                  <Users size={42} />
                </div>
                <span className="section-kicker">
                  دست {faNumber(local.round)} از {faNumber(local.config.rounds)}
                </span>
                <h1>نوبتِ {local.players[local.activeIndex].name}ه!</h1>
                <p>
                  دستگاه رو به این بازیکن بده.
                  <br />
                  تا وقتی آماده نشده، برگه رو باز نکنین.
                </p>
                <div className="privacy-note">
                  <BookOpen size={20} /> برگه‌ی نفر قبلی بسته‌ست. هر نفر{' '}
                  {faNumber(local.config.duration)} ثانیه وقت داره.
                </div>
                <button
                  className="button button-orange"
                  onClick={() => {
                    setDraft(emptyAnswers());
                    setNow(Date.now());
                    setLocal({
                      ...local,
                      stage: 'playing',
                      deadline: Date.now() + local.config.duration * 1000,
                    });
                  }}
                >
                  آماده‌ام، برگه‌م رو بده <ArrowLeft size={20} />
                </button>
                <small className="honest-note">
                  این حالت نوبتیه؛ استپِ هم‌زمان فقط در دورهمی آنلاین انجام می‌شه.
                </small>
              </section>
            )}

            {playing && (
              <section className="playing-layout">
                <aside className="game-sidebar">
                  <div className="round-label">
                    <span>دستِ</span>
                    <b>
                      {faNumber(roundNumber)}
                      <small> / {faNumber(roundCount)}</small>
                    </b>
                  </div>
                  <div className={`letter-card ${seconds <= 10 ? 'letter-urgent' : ''}`}>
                    <small>این دست، با حرفِ</small>
                    <strong>{activeLetter}</strong>
                    <span>هر کلمه، یه فرصت!</span>
                  </div>
                  <div
                    className={`timer ${seconds <= 10 ? 'timer-urgent' : ''}`}
                    role="timer"
                    aria-label={`${faNumber(seconds)} ثانیه باقی مانده`}
                  >
                    <Clock3 size={19} />
                    <b dir="ltr">
                      {faNumber(Math.floor(seconds / 60))}:
                      {faNumber(String(seconds % 60).padStart(2, '0'))}
                    </b>
                    <span>فرصت داری</span>
                    <div className="timer-track">
                      <i style={{ width: `${Math.min(100, (seconds / duration) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="sidebar-score">
                    <span>هم‌بازی‌ها</span>
                    {players.map((p, i) => (
                      <div key={p.id}>
                        <span className={`small-avatar player-color-${i % 4}`}>
                          {p.name.slice(0, 1)}
                        </span>
                        <b>{p.name}</b>
                        <small>{faNumber(p.score)}</small>
                      </div>
                    ))}
                  </div>
                </aside>
                <div className="answer-sheet paper">
                  <div className="sheet-top">
                    <div>
                      <span className="section-kicker">
                        برگه‌ی{' '}
                        {networkGame
                          ? players.find((p) => p.id === ownId)?.name
                          : local!.players[local!.activeIndex].name}
                      </span>
                      <h1>حالا نوبتِ کلمه‌های توئه.</h1>
                    </div>
                    <span className="sheet-completion">
                      {faNumber(filled)}
                      <small> / ۶</small>
                    </span>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void stop();
                    }}
                  >
                    <div className="answer-rows">
                      {CATEGORIES.map((category, index) => {
                        const value = draft[category.id];
                        const wrong =
                          value.trim().length > 0 &&
                          !normalizePersian(value).startsWith(normalizePersian(activeLetter));
                        return (
                          <div
                            key={category.id}
                            className={`answer-row ${wrong ? 'answer-error' : ''}`}
                          >
                            <label htmlFor={`answer-${category.id}`}>
                              <span className="category-icon">{category.icon}</span>
                              <b>{category.label}</b>
                              <small>{faNumber(index + 1)}</small>
                            </label>
                            <div className="answer-input-wrap">
                              <input
                                id={`answer-${category.id}`}
                                value={value}
                                maxLength={60}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                enterKeyHint={index === CATEGORIES.length - 1 ? 'done' : 'next'}
                                placeholder={PREVIEW_HINTS[category.id]}
                                onChange={(e) => {
                                  if (networkGame) room.markDraftDirty();
                                  setDraft((d) => ({ ...d, [category.id]: e.target.value }));
                                }}
                                aria-invalid={wrong}
                                aria-describedby={wrong ? `hint-${category.id}` : undefined}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (index < CATEGORIES.length - 1)
                                      document
                                        .getElementById(`answer-${CATEGORIES[index + 1].id}`)
                                        ?.focus();
                                    else
                                      document
                                        .querySelector<HTMLButtonElement>('.stop-button')
                                        ?.focus();
                                  }
                                }}
                              />
                              {wrong && (
                                <small className="field-error" id={`hint-${category.id}`}>
                                  با «{activeLetter}» شروع کن
                                </small>
                              )}
                            </div>
                            <span className={`answer-mark ${value && !wrong ? 'has-answer' : ''}`}>
                              {value && !wrong ? <Check size={18} /> : <span>·</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="sheet-bottom">
                      <div>
                        <span className="ink-dot" />{' '}
                        {networkGame
                          ? 'استپ که بزنی، برگه‌ی همه بسته می‌شه.'
                          : 'تا زمان داری، می‌تونی جواب‌هات رو عوض کنی.'}
                        <small>
                          {networkGame
                            ? 'برای استپ، هر ۶ ستون رو پر کن.'
                            : local?.mode === 'pass'
                              ? 'برای نفر بعدی، برگه‌ت بسته می‌شه.'
                              : 'حریف کاغذی، رایانه‌ایه؛ آدم واقعی نیست.'}
                        </small>
                        {networkGame && (
                          <small className={`draft-state draft-${room.draftStatus}`}>
                            {!room.connected
                              ? 'اتصال قطع شده؛ تغییرات تازه هنوز ذخیره نشدن.'
                              : room.draftStatus === 'saved'
                                ? '✓ برگه روی سرور ذخیره شد'
                                : room.draftStatus === 'saving'
                                  ? 'در حال ذخیره‌ی برگه…'
                                  : 'تغییرات در انتظار ذخیره…'}
                          </small>
                        )}
                      </div>
                      <button
                        type="submit"
                        className="button button-orange stop-button"
                        disabled={networkGame && (filled < 6 || room.busy || !room.connected)}
                      >
                        <Flag size={19} />
                        {filled === 6 ? 'استپ! نوشتم' : 'ثبت برگه'}
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            )}

            {gamePhase === 'review' && (
              <section className="review-page">
                <div className="review-heading">
                  <div>
                    <div className="eyebrow">
                      <Pencil size={16} /> مدادها زمین!
                    </div>
                    <h1>ببینیم کی چی نوشته.</h1>
                    <p>جواب تازه ۱۰، جواب مشترک ۵، خانه‌ی خالی یا نادرست ۰.</p>
                  </div>
                  <div className="review-letter">
                    <small>حرف این دست</small>
                    <b>{activeLetter}</b>
                  </div>
                </div>
                <div className="review-scroll paper">
                  <table className="review-table">
                    <caption className="sr-only">
                      مقایسه پاسخ‌ها و امتیازهای دست {faNumber(roundNumber)}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">ستون</th>
                        {players.map((p) => (
                          <th key={p.id} scope="col">
                            {p.name}
                            {p.id === ownId && <small> (تو)</small>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {CATEGORIES.map((category) => (
                        <tr key={category.id}>
                          <th scope="row">
                            <span>{category.icon}</span>
                            {category.label}
                          </th>
                          {players.map((player) => {
                            const cell = results
                              .find((r) => r.playerId === player.id)
                              ?.cells.find((c) => c.category === category.id);
                            if (!cell) return <td key={player.id}>—</td>;
                            const reviewable =
                              checkAnswer(cell.answer, activeLetter, category.id) === 'review';
                            const vote = snapshot?.reviewVotes.find(
                              (v) => v.playerId === player.id && v.category === category.id,
                            );
                            return (
                              <td key={player.id}>
                                <div className="review-answer">
                                  <b>{cell.answer || '—'}</b>
                                  <span className={`points points-${cell.status}`}>
                                    {cell.status === 'review' ? '؟' : faNumber(cell.points)}
                                  </span>
                                </div>
                                <small className={`answer-verdict verdict-${cell.status}`}>
                                  {cell.status === 'review'
                                    ? 'نیاز به بررسی'
                                    : cell.duplicate
                                      ? 'جواب مشترک'
                                      : cell.points === 10
                                        ? 'جوابِ خاص خودت'
                                        : cell.answer
                                          ? 'پذیرفته نشد'
                                          : 'خانه‌ی خالی'}
                                </small>
                                {reviewable && (
                                  <div className="review-controls">
                                    {networkGame ? (
                                      vote && player.id !== ownId ? (
                                        <>
                                          <button
                                            disabled={room.busy}
                                            className={vote.myVote === true ? 'voted-yes' : ''}
                                            aria-label={`پذیرش ${cell.answer}`}
                                            onClick={() =>
                                              void room.vote(player.id, category.id, true)
                                            }
                                          >
                                            <Check size={14} />
                                          </button>
                                          <button
                                            disabled={room.busy}
                                            className={vote.myVote === false ? 'voted-no' : ''}
                                            aria-label={`رد ${cell.answer}`}
                                            onClick={() =>
                                              void room.vote(player.id, category.id, false)
                                            }
                                          >
                                            <X size={14} />
                                          </button>
                                          <small>
                                            {faNumber(vote.valid)} موافق / {faNumber(vote.needed)}{' '}
                                            لازم
                                          </small>
                                        </>
                                      ) : (
                                        <small>رأی هم‌بازی‌ها</small>
                                      )
                                    ) : (
                                      <>
                                        <button
                                          className={
                                            local!.overrides[`${player.id}:${category.id}`] === true
                                              ? 'voted-yes'
                                              : ''
                                          }
                                          aria-label={`پذیرش ${cell.answer}`}
                                          onClick={() =>
                                            setLocal((g) =>
                                              g
                                                ? {
                                                    ...g,
                                                    overrides: {
                                                      ...g.overrides,
                                                      [`${player.id}:${category.id}`]: true,
                                                    },
                                                  }
                                                : g,
                                            )
                                          }
                                        >
                                          <Check size={14} /> درسته
                                        </button>
                                        <button
                                          className={
                                            local!.overrides[`${player.id}:${category.id}`] ===
                                            false
                                              ? 'voted-no'
                                              : ''
                                          }
                                          aria-label={`رد ${cell.answer}`}
                                          onClick={() =>
                                            setLocal((g) =>
                                              g
                                                ? {
                                                    ...g,
                                                    overrides: {
                                                      ...g.overrides,
                                                      [`${player.id}:${category.id}`]: false,
                                                    },
                                                  }
                                                : g,
                                            )
                                          }
                                        >
                                          <X size={14} /> قبول نیست
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row">جمع این دست</th>
                        {players.map((p) => (
                          <td key={p.id}>
                            <b>{faNumber(results.find((r) => r.playerId === p.id)?.total || 0)}</b>
                            <small> امتیاز</small>
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="review-footer">
                  <p>
                    <HelpCircle size={18} />
                    {networkGame
                      ? 'کلمه‌های تازه با رأی دیگران پذیرفته می‌شن؛ رأی ناتمام صفر امتیازه.'
                      : 'واژه‌نامه‌مون هنوز کوچیکه. جواب‌های تازه رو با هم بررسی کنین؛ بررسی‌نشده‌ها صفر می‌گیرن.'}
                  </p>
                  {networkGame ? (
                    isHost ? (
                      <button
                        className="button button-blue"
                        disabled={room.busy}
                        onClick={() => void room.next()}
                      >
                        {roundNumber === roundCount ? 'نتیجه‌ی دورهمی' : 'ثبت امتیاز و دست بعد'}
                        <ArrowLeft size={19} />
                      </button>
                    ) : (
                      <span className="waiting-note">منتظر میزبان برای دست بعد…</span>
                    )
                  ) : (
                    <button className="button button-blue" onClick={nextLocal}>
                      {roundNumber === roundCount ? 'بریم سراغ نتیجه' : 'ثبت امتیاز و دست بعد'}
                      <ArrowLeft size={19} />
                    </button>
                  )}
                </div>
              </section>
            )}

            {gamePhase === 'finished' && (
              <section className="finish-page paper">
                <div className="confetti" aria-hidden="true">
                  {Array.from({ length: 18 }, (_, i) => (
                    <i key={i} style={{ '--i': i } as React.CSSProperties} />
                  ))}
                </div>
                <span className="finish-trophy">
                  <Trophy size={46} />
                </span>
                <div className="section-kicker">یه دورهمی دیگه رفت تو خاطره‌ها</div>
                <h1>
                  {(() => {
                    const sorted = [...players].sort((a, b) => b.score - a.score);
                    return sorted[0]?.score === sorted[1]?.score
                      ? 'رفاقت مساوی شد!'
                      : `${sorted[0]?.name}، دستت طلا!`;
                  })()}
                </h1>
                <p>اسم‌ها یادمون می‌رن، این لحظه‌ها نه.</p>
                <div className="podium">
                  {rankedPlayers.map((p, i) => (
                    <div className={p.rank === 1 ? 'winner-row' : ''} key={p.id}>
                      <span className="rank">
                        {p.rank === 1 ? <Trophy size={20} /> : faNumber(p.rank)}
                      </span>
                      <span className={`small-avatar player-color-${i % 4}`}>
                        {p.name.slice(0, 1)}
                      </span>
                      <b>{p.name}</b>
                      <strong>
                        {faNumber(p.score)}
                        <small> امتیاز</small>
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="finish-actions">
                  <button
                    className="button button-orange"
                    onClick={() => {
                      void leaveGame();
                    }}
                  >
                    برگردیم به حیاط <Home size={18} />
                  </button>
                  <button className="button button-outline" onClick={() => setModal('ledger')}>
                    <BookOpen size={18} /> دفتر خاطرات
                  </button>
                </div>
                <small className="honest-note">
                  نتیجه روی همین دستگاه توی دفتر خاطراتت ثبت شد.
                </small>
              </section>
            )}
          </div>
        )}
      </main>
      <footer className="site-footer wrap">
        <span>
          با حوصله، برای رفاقت <span className="footer-star">✳</span> اسم فامیل
        </span>
        <div>
          <span className="version-label">نسخه‌ی آغازین · ۰.۱</span>
          <button onClick={() => setModal('rules')}>قانون بازی</button>
          <button className="footer-settings" onClick={() => setModal('settings')}>
            تنظیمات
          </button>
        </div>
      </footer>

      {modal === 'setup' && (
        <Modal
          restoreFocusTo={lastDialogTrigger.current}
          title={
            mode === 'online'
              ? 'یه دورهمی تازه بسازیم'
              : mode === 'pass'
                ? 'صندلی‌ها رو بچینیم'
                : 'یه دست گرم کنیم'
          }
          onClose={closeModal}
        >
          <div className="setup-intro">
            {mode === 'online'
              ? 'بعد از ساختن، کد و لینک دعوت می‌گیری.'
              : 'قانون‌ها رو همین اول با هم قرار می‌ذاریم.'}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === 'online') void createOnline();
              else startLocal(mode === 'pass' ? 'pass' : 'solo');
            }}
          >
            <label className="form-label" htmlFor="player-name">
              چی صدات کنیم؟
            </label>
            <input
              className="text-input"
              id="player-name"
              maxLength={24}
              placeholder="مثلاً سارا"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
            {mode === 'pass' && (
              <fieldset className="pass-names">
                <legend>هم‌بازی‌ها</legend>
                {passNames.map((name, i) => (
                  <label key={i}>
                    <span>نفر {faNumber(i + 1)}</span>
                    <input
                      className="text-input"
                      maxLength={24}
                      placeholder={
                        i === 0 ? playerName || 'اسم بازیکن اول' : `اسم بازیکن ${faNumber(i + 1)}`
                      }
                      value={name}
                      onChange={(e) =>
                        setPassNames((names) => names.map((n, j) => (i === j ? e.target.value : n)))
                      }
                    />
                    {i >= 2 && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`حذف بازیکن ${faNumber(i + 1)}`}
                        onClick={() => setPassNames((names) => names.filter((_, j) => j !== i))}
                      >
                        <X size={17} />
                      </button>
                    )}
                  </label>
                ))}
                {passNames.length < 4 && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setPassNames((n) => [...n, ''])}
                  >
                    <Plus size={17} /> یه هم‌بازی دیگه
                  </button>
                )}
              </fieldset>
            )}
            <fieldset className="choice-field">
              <legend>چند دست بازی کنیم؟</legend>
              <div className="segmented">
                {([1, 3, 5] as const).map((n) => (
                  <button
                    type="button"
                    key={n}
                    aria-pressed={config.rounds === n}
                    className={config.rounds === n ? 'selected' : ''}
                    onClick={() => setConfig((c) => ({ ...c, rounds: n }))}
                  >
                    {faNumber(n)} دست
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="choice-field">
              <legend>فرصت هر دست</legend>
              <div className="segmented">
                {([60, 90, 120] as const).map((n) => (
                  <button
                    type="button"
                    key={n}
                    aria-pressed={config.duration === n}
                    className={config.duration === n ? 'selected' : ''}
                    onClick={() => setConfig((c) => ({ ...c, duration: n }))}
                  >
                    {faNumber(n)} ثانیه
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="setup-rule">
              <span>اسم · فامیل · شهر · غذا · میوه · حیوان</span>
              <small>۱۰ امتیاز خاص، ۵ مشترک، ۰ نادرست</small>
            </div>
            <button
              className="button button-blue full-width"
              disabled={room.busy || (mode === 'online' && !online)}
              type="submit"
            >
              {room.busy ? <LoaderCircle size={20} className="spin" /> : <ArrowLeft size={20} />}{' '}
              {mode === 'online' ? 'دورهمی رو بساز' : 'بزن بریم!'}
            </button>
            {mode === 'solo' && (
              <p className="honest-note">حریف کاغذی رایانه‌ایه و جواب‌هاش از قبل مشخص می‌شن.</p>
            )}
            {mode === 'pass' && (
              <p className="honest-note">
                بازی روی یک دستگاه، به نوبت و با زمان برابر برای هر نفر.
              </p>
            )}
          </form>
        </Modal>
      )}

      {modal === 'join' && (
        <Modal
          restoreFocusTo={lastDialogTrigger.current}
          title="یه صندلی هم برای تو!"
          onClose={closeModal}
        >
          <p className="modal-description">کد دورهمی رو از دوستت بگیر و بیا تو.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void joinOnline();
            }}
          >
            <label className="form-label" htmlFor="join-name">
              اسم تو
            </label>
            <input
              className="text-input"
              id="join-name"
              maxLength={24}
              placeholder="چی صدات کنیم؟"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
            <label className="form-label" htmlFor="join-code">
              کد دورهمی
            </label>
            <input
              className="text-input code-input"
              id="join-code"
              dir="ltr"
              maxLength={5}
              autoComplete="off"
              placeholder="ABCDE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            />
            {room.error && (
              <p className="form-error" role="alert">
                {room.error}
              </p>
            )}
            <button
              className="button button-blue full-width"
              disabled={joinCode.length !== 5 || room.busy || !online}
            >
              {room.busy ? <LoaderCircle size={20} className="spin" /> : <ArrowLeft size={20} />}{' '}
              بریم توی جمع
            </button>
          </form>
        </Modal>
      )}

      {modal === 'rules' && (
        <Modal
          restoreFocusTo={lastDialogTrigger.current}
          title="قانونش ساده‌ست، خاطره‌ش موندنی."
          onClose={closeModal}
          wide
        >
          <div className="rules-intro">
            <span className="rules-letter">س</span>
            <p>
              یه حرف برای همه، شش ستون برای فکر کردن.
              <br />
              مثلاً با «س»: سارا، سهرابی، ساری، سمبوسه، سیب، سگ.
            </p>
          </div>
          <ol className="rules-list">
            <li>
              <b>با حرف این دست بنویس.</b>
              <p>
                برای هر ستون یه جواب پیدا کن. ا و آ یک حرف حساب می‌شن؛ ی و ک عربی هم پذیرفته‌ان.
              </p>
            </li>
            <li>
              <b>سریع باش، ولی خلاق‌تر.</b>
              <p>
                در دورهمی آنلاین، اولین نفر با شش جواب می‌تونه «استپ» بزنه و برگه‌ی همه بسته می‌شه.
                اگر کسی استپ نزد، زمان که تموم بشه برگه‌ها بسته می‌شن.
              </p>
            </li>
            <li>
              <b>برگه‌ها رو با هم بخونیم.</b>
              <p>
                واژه‌های شناخته‌شده بررسی می‌شن؛ واژه‌ی تازه برای رأی می‌ره، چون هیچ واژه‌نامه‌ای
                همه‌چیز رو نمی‌دونه. در آنلاین، اکثریت دیگر بازیکن‌ها باید موافق باشن. رأی ناتمام
                صفر امتیازه.
              </p>
            </li>
          </ol>
          <div className="scoring-guide">
            <div>
              <b>۱۰</b>
              <span>درست و منحصربه‌فرد</span>
            </div>
            <div>
              <b>۵</b>
              <span>درست، ولی مشترک</span>
            </div>
            <div>
              <b>۰</b>
              <span>خالی، نادرست یا بی‌رأی</span>
            </div>
          </div>
          <p className="honest-note">
            در تمرین و چالش روز، حریف کاغذی رایانه‌ایه و خودت داورِ واژه‌های تازه‌ای. چالش روز جدول
            رتبه‌بندی سراسری نداره. بازی نوبتی به هر نفر زمان جداگانه می‌ده.
          </p>
          <button className="button button-blue full-width" onClick={closeModal}>
            گرفتم، مداد من کو؟ <Pencil size={18} />
          </button>
        </Modal>
      )}

      {modal === 'settings' && (
        <Modal
          restoreFocusTo={lastDialogTrigger.current}
          title="به سلیقه‌ی خودت"
          onClose={closeModal}
        >
          <label className="form-label" htmlFor="settings-name">
            نام بازیکن
          </label>
          <input
            className="text-input"
            id="settings-name"
            value={preferences.name}
            maxLength={24}
            placeholder="مهمونِ ما"
            onChange={(e) => {
              setPreferences((p) => ({ ...p, name: e.target.value }));
              setPlayerName(e.target.value);
            }}
          />
          <div className="setting-row">
            <div>
              <b>صدای مداد و جشن</b>
              <small>چند نت کوچیک برای حال خوب</small>
            </div>
            <button
              role="switch"
              aria-checked={preferences.sound}
              aria-label="صدای بازی"
              className={`toggle ${preferences.sound ? 'on' : ''}`}
              onClick={() => setPreferences((p) => ({ ...p, sound: !p.sound }))}
            >
              <i />
            </button>
          </div>
          <div className="settings-install">
            <MonitorSmartphone size={28} />
            <div>
              <b>همیشه دم دستت</b>
              <p>اسم فامیل رو به صفحه‌ی اصلی دستگاهت اضافه کن.</p>
            </div>
          </div>
          <button className="button button-outline full-width" onClick={() => void install()}>
            <Download size={18} /> افزودن به دستگاه
          </button>
          {installHelp && (
            <p className="install-help">
              در Chrome یا Edge از منوی مرورگر «نصب برنامه / Install app» رو بزن. در Safari آیفون:
              Share ← Add to Home Screen. نصب به HTTPS یا localhost نیاز داره.
            </p>
          )}
          <small className="honest-note">
            نام و نتیجه‌ها فقط روی همین دستگاه ذخیره می‌شن. انیمیشن‌ها از تنظیم کاهش حرکت دستگاهت
            پیروی می‌کنن.
          </small>
        </Modal>
      )}

      {modal === 'ledger' && (
        <Modal
          restoreFocusTo={lastDialogTrigger.current}
          title="دفترِ خاطرات تو"
          onClose={closeModal}
          wide
        >
          {records.length === 0 ? (
            <div className="empty-notebook">
              <BookOpen size={55} />
              <h3>این دفتر منتظر اولین خاطره‌ست.</h3>
              <p>یه دور بازی کن تا نتیجه و کلمه‌های خوبت اینجا بمونن.</p>
              <button className="button button-blue" onClick={closeModal}>
                برگردیم به بازی <ArrowLeft size={19} />
              </button>
            </div>
          ) : (
            <>
              <div className="ledger-stats">
                <div>
                  <b>{faNumber(records.length)}</b>
                  <span>دورهمی ثبت‌شده</span>
                </div>
                <div>
                  <b>{faNumber(Math.max(...records.map((r) => r.score)))}</b>
                  <span>بیشترین امتیاز</span>
                </div>
                <div>
                  <b>{faNumber(records.filter((r) => r.mode === 'daily').length)}</b>
                  <span>چالش روزانه</span>
                </div>
              </div>
              <div className="ledger-entries">
                {records.map((entry) => (
                  <article key={entry.id}>
                    <div className="ledger-letter">{entry.letter}</div>
                    <div>
                      <h3>{MODE_LABELS[entry.mode]}</h3>
                      <small>
                        {new Intl.DateTimeFormat('fa-IR', {
                          dateStyle: 'medium',
                          timeZone: 'Asia/Tehran',
                        }).format(new Date(`${entry.date}T12:00:00+03:30`))}
                      </small>
                      {entry.words.length > 0 && <p>یادگاریِ برگه: {entry.words.join('، ')}</p>}
                    </div>
                    <strong>
                      {faNumber(entry.score)}
                      <small> / {faNumber(entry.max)}</small>
                    </strong>
                  </article>
                ))}
              </div>
              <p className="honest-note">
                این دفتر محلیه؛ پاک کردن داده‌های مرورگر، دفتر رو هم پاک می‌کنه.
              </p>
            </>
          )}
        </Modal>
      )}

      {modal === 'leave' && (
        <Modal
          restoreFocusTo={lastDialogTrigger.current}
          title={gamePhase === 'finished' ? 'برگردیم به حیاط؟' : 'این دست رو نیمه‌کاره بذاریم؟'}
          onClose={closeModal}
        >
          <p className="modal-description">
            {networkGame
              ? 'با خروج، از این دورهمی جدا می‌شی.'
              : gamePhase === 'finished'
                ? 'نتیجه توی دفتر خاطراتت می‌مونه.'
                : 'امتیاز این بازی هنوز توی دفتر خاطرات ثبت نشده.'}
          </p>
          <div className="modal-actions">
            <button className="button button-blue" onClick={closeModal}>
              {gamePhase === 'finished' ? 'هنوز اینجام' : 'ادامه‌ی بازی'}
            </button>
            <button className="button button-outline" onClick={() => void leaveGame()}>
              برگشت به حیاط <ArrowLeft size={18} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={19} />
          {toast}
        </div>
      )}
      <div className="sr-only" aria-live="polite">
        {playing && [30, 10].includes(seconds)
          ? `${faNumber(seconds)} ثانیه فرصت باقی مانده`
          : gamePhase === 'review'
            ? 'زمان نوشتن تمام شد. پاسخ‌ها برای بررسی آماده‌اند.'
            : ''}
      </div>
      <PwaNotice inGame={inGame} />
    </div>
  );
}
export default App;
