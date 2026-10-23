export function Flower({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 90 90" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.4">
        <path d="M45 33C20-4 2 27 32 41C-7 48 19 78 38 53C38 96 76 81 55 53C94 72 98 33 58 39C88 7 48-4 45 33Z" />
        <circle cx="45" cy="44" r="11" />
      </g>
    </svg>
  );
}

export function NotebookArt() {
  return (
    <div className="notebook-scene" aria-hidden="true">
      <div className="orbit-label">
        خاطره‌بازی، با سرعت نور <span>↗</span>
      </div>
      <svg className="tea-art" viewBox="0 0 140 160" fill="none">
        <ellipse cx="71" cy="138" rx="56" ry="12" fill="#d9c4a1" opacity=".35" />
        <path
          d="M24 130Q69 151 117 129L108 121H34Z"
          fill="#fff8e9"
          stroke="#253e8f"
          strokeWidth="2"
        />
        <path
          d="M38 43H99L93 105Q69 123 44 105Z"
          fill="#ffe4b2"
          stroke="#253e8f"
          strokeWidth="2.5"
        />
        <path d="M41 67Q69 74 97 66L93 104Q70 117 45 104Z" fill="#af482c" />
        <ellipse cx="69" cy="44" rx="30" ry="8" stroke="#253e8f" strokeWidth="2.5" fill="#fff8e9" />
        <path
          d="M99 57C134 48 131 91 96 90M55 33C42 20 68 21 55 8M77 31C66 19 90 20 78 5"
          stroke="#253e8f"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path d="M50 75L53 100" stroke="#f4c885" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <div className="notebook-shadow" />
      <div className="hero-notebook">
        <div className="binding">
          {Array.from({ length: 8 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <div className="notebook-heading">
          <span>دفترِ دورهمی</span>
          <small>یک برگ برای رفاقت</small>
        </div>
        <div className="sample-table">
          <div className="sample-row table-head">
            <b>اسم</b>
            <b>فامیل</b>
            <b>شهر</b>
          </div>
          <div className="sample-row">
            <span>سارا</span>
            <span>سهرابی</span>
            <span>ساری</span>
          </div>
          <div className="sample-row">
            <span>سامان</span>
            <span>ستوده</span>
            <span>سنندج</span>
          </div>
          <div className="sample-row blank-row">
            <span>...</span>
            <span>...</span>
            <span>...</span>
          </div>
        </div>
        <div className="scribble">تقلب ممنوع، خنده آزاد!</div>
        <div className="paper-score">
          ۱۰<span>آفرین!</span>
        </div>
      </div>
      <div className="letter-tile">
        <small>حرفِ ما</small>
        <b>س</b>
        <span>س مثل سلام!</span>
      </div>
      <div className="pencil">
        <i />
        <span />
        <b />
      </div>
      <div className="stamp-seal">
        صددرصد
        <br />
        <b>خاطره‌انگیز</b>
        <small>از نسل کاغذ و قلم</small>
      </div>
      <Flower className="hero-flower" />
      <svg className="doodle-arrow" viewBox="0 0 120 80" fill="none">
        <path
          d="M110 10C105 75 25 75 12 39M12 39L8 65M12 39L38 48"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function Logo() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span>اسم</span>
      <span>فامیل</span>
      <i>✳</i>
    </span>
  );
}
