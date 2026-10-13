/**
 * Toast in place: pilha no canto da tela, feedback de algo que terminou
 * longe do cursor (compilou, baixou, salvou, falhou).
 * Entra e sai com transform + opacity, sem bounce. Respeita reduced-motion
 * pelo CSS global (a animação zera e o toast aparece no lugar).
 */
import { useEffect, useRef, useState } from 'react';
import { Check, Info, X, AlertTriangle } from 'lucide-react';

export type ToastKind = 'ok' | 'info' | 'error';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

let seq = 0;

export function useToasts(timeout = 4000) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<number[]>([]);

  const dismiss = (id: number) =>
    setItems((list) => list.filter((t) => t.id !== id));

  const push = (text: string, kind: ToastKind = 'info') => {
    const id = ++seq;
    // Mantém no máximo 3: o mais antigo sai.
    setItems((list) => [...list.slice(-2), { id, kind, text }]);
    const h = window.setTimeout(() => dismiss(id), timeout);
    timers.current.push(h);
  };

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return { items, push, dismiss, ok: (t: string) => push(t, 'ok'), error: (t: string) => push(t, 'error') };
}

const ICON = { ok: Check, info: Info, error: AlertTriangle };

export function ToastStack({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div
      className="fixed bottom-3 left-3 right-3 z-50 flex flex-col gap-2 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {items.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div
            key={t.id}
            data-testid="toast"
            className="toast-in pointer-events-auto relative overflow-hidden flex items-start gap-2 border-2 border-black bg-white rounded-xl py-2 pl-2.5 pr-7 text-[11px] leading-snug shadow-[3px_3px_0px_0px_#000]"
          >
            <span
              className={
                'mt-px shrink-0 ' +
                (t.kind === 'ok' ? 'text-emerald-600' : t.kind === 'error' ? 'text-red-600' : 'text-neutral-500')
              }
            >
              <Icon className="w-3.5 h-3.5" />
            </span>
            <span className="flex-1 break-words">{t.text}</span>
            <button
              onClick={() => onDismiss(t.id)}
              aria-label="Fechar aviso"
              className="absolute top-1 right-1 p-0.5 text-neutral-400 hover:text-black"
            >
              <X className="w-3 h-3" />
            </button>
            <span className="toast-bar absolute bottom-0 left-0 h-[3px] bg-black w-full" />
          </div>
        );
      })}
    </div>
  );
}