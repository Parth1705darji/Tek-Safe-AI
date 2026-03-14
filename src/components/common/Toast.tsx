import { useState, useEffect } from 'react';

interface ToastItem {
  id: number;
  message: string;
}

let _nextId = 0;

/** Call from anywhere to show a toast. No React context needed. */
export function showToast(message: string) {
  window.dispatchEvent(
    new CustomEvent('teksafe:toast', { detail: { message, id: ++_nextId } })
  );
}

/** Mount once at the app root — renders all active toasts. */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, id } = (e as CustomEvent<{ message: string; id: number }>).detail;
      setToasts((prev) => [...prev, { id, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2000);
    };
    window.addEventListener('teksafe:toast', handler);
    return () => window.removeEventListener('teksafe:toast', handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-slide-up rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-xl dark:bg-gray-700"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
