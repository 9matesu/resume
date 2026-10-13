/**
 * Button = uma ação, quatro estados: parado, pressionado, carregando e
 * pronto. O spinner nunca fica sozinho: o rótulo vira o texto real do que
 * está acontecendo, e o check confirma por instantes.
 */
import type { ReactNode } from 'react';
import { Check, Loader2 } from 'lucide-react';

export type Variant = 'solid' | 'yellow';

const VARIANT = { solid: 'brutal-btn', yellow: 'brutal-btn-yellow' };

export interface ActionButtonProps {
  /** Rótulo no estado parado. */
  label: ReactNode;
  /** Texto real enquanto a ação roda. Vazio mantém o rótulo. */
  pendingLabel?: string;
  onClick: () => void;
  variant?: Variant;
  pending?: boolean;
  /** Trava o clique durante a ação. */
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  testId?: string;
  title?: string;
}

export function ActionButton({
  label,
  pendingLabel,
  onClick,
  variant = 'yellow',
  pending = false,
  disabled = false,
  icon,
  className = '',
  testId,
  title,
}: ActionButtonProps) {
  const busy = pending || disabled;
  return (
    <button
      type="button"
      data-testid={testId}
      title={title}
      aria-busy={pending || undefined}
      onClick={onClick}
      disabled={busy}
      className={`${VARIANT[variant]} inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] ${className}`}
    >
      {pending ? (
        <Loader2 className="spin w-3.5 h-3.5 shrink-0" />
      ) : (
        icon ?? <Check className="w-3.5 h-3.5 shrink-0 opacity-0" />
      )}
      <span className="truncate">{pending && pendingLabel ? pendingLabel : label}</span>
    </button>
  );
}

/** Botão de texto: usado para escape hatches e links de ação. */
export function TextButton({
  children,
  onClick,
  className = '',
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  className?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`text-[11px] font-bold underline underline-offset-4 hover:bg-black hover:text-white px-1 py-0.5 transition-colors cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Estágio de carregamento com texto real. Substitui spinner genérico: diz o
 * que está acontecendo agora e qual a próxima etapa.
 */
export function Stage({ label, next, detail }: { label: string; next?: string; detail?: string }) {
  return (
    <div data-testid="stage" role="status" aria-live="polite" className="flex items-center gap-2">
      <Loader2 className="spin w-4 h-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] font-bold">{label}</p>
        {(next || detail) && (
          <p className="text-[10px] text-neutral-500">{detail ?? next}</p>
        )}
      </div>
    </div>
  );
}

/** Esqueleto no lugar do spinner grande do card de resultado. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div data-testid="skeleton" className="space-y-2" aria-hidden="true">
      <div className="skeleton h-5 w-2/3 rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-3 rounded" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}