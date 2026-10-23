import { Download, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** An update never reloads an active match or changes its rules mid-round. */
export function PwaNotice({ inGame }: { inGame: boolean }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh || inGame) return null;
  return (
    <div className="pwa-notice" role="status">
      <Download size={19} />
      <span>یه نسخه‌ی تازه آماده‌ست.</span>
      <button onClick={() => void updateServiceWorker(true)}>به‌روزرسانی</button>
      <button
        className="icon-button"
        aria-label="بعداً به‌روزرسانی کن"
        onClick={() => setNeedRefresh(false)}
      >
        <X size={17} />
      </button>
    </div>
  );
}
