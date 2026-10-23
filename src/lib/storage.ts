import { useEffect, useRef, useState } from 'react';

export function readStorage<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => value is T,
): T {
  try {
    const value = localStorage.getItem(`esfamil:${key}`);
    if (!value) return fallback;
    const parsed: unknown = JSON.parse(value);
    return !validate || validate(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(`esfamil:${key}`, JSON.stringify(value));
  } catch {
    /* Private mode can disable persistence. */
  }
}
export function useStored<T>(key: string, fallback: T, validate?: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(() => readStorage(key, fallback, validate));
  const persistedValue = useRef(value);
  useEffect(() => {
    // Mounting is a read, not a write: a delayed initial effect must not replace
    // newer data written by another document before this page finishes loading.
    if (Object.is(persistedValue.current, value)) return;
    writeStorage(key, value);
    persistedValue.current = value;
  }, [key, value]);
  return [value, setValue] as const;
}
export function tehranDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return ['year', 'month', 'day']
    .map((type) => parts.find((p) => p.type === type)?.value)
    .join('-');
}
export function persianDate(date = new Date()): string {
  return new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

let audio: AudioContext | undefined;
export function playSound(kind: 'tap' | 'start' | 'stop' | 'win', enabled: boolean) {
  if (!enabled) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const notes =
      kind === 'win'
        ? [523, 659, 784, 1046]
        : kind === 'start'
          ? [440, 660]
          : kind === 'stop'
            ? [440, 330]
            : [480];
    notes.forEach((frequency, index) => {
      const oscillator = audio!.createOscillator();
      const gain = audio!.createGain();
      const at = audio!.currentTime + index * 0.12;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.07, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.18);
      oscillator.connect(gain);
      gain.connect(audio!.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.2);
    });
  } catch {
    /* Audio is optional on devices with restricted autoplay. */
  }
}
