import { useMemo, useState } from 'react';
import { Camera, Search, X } from 'lucide-react';
import type { HistoryItem } from '../../services/api';

interface HistorySheetProps {
  history: HistoryItem[];
  currentId?: string;
  capturing: boolean;
  onSelect: (item: HistoryItem) => void;
  onCapture: () => void;
  onClose: () => void;
}

function statusColor(score: number): string {
  if (score >= 70) return 'bg-ok';
  if (score >= 40) return 'bg-mac-yellow';
  return 'bg-danger';
}

/**
 * Candidaturas em folha lateral. Trocar de vaga não fecha o documento: a folha
 * sai e a página continua no mesmo lugar.
 */
export function HistorySheet({
  history,
  currentId,
  capturing,
  onSelect,
  onCapture,
  onClose,
}: HistorySheetProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter((item) =>
      `${item.title} ${item.company} ${item.location || ''}`.toLowerCase().includes(q),
    );
  }, [history, query]);

  return (
    <div
      className="ws-sheet ws-sheet-left w-[320px] max-w-[92vw]"
      role="dialog"
      aria-label="Candidaturas"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">Candidaturas</h2>
          <p className="mt-0.5 text-2xs leading-relaxed text-muted">
            Cada vaga guarda o currículo que você enviou.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar candidaturas" className="ws-icon-btn">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2">
        <Search className="h-3.5 w-3.5 text-subtle" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar vaga ou empresa"
          className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-subtle"
        />
      </div>

      <div className="shrink-0 border-b border-line px-4 py-2.5">
        <button
          type="button"
          onClick={onCapture}
          disabled={capturing}
          className="ws-btn ws-btn-brand w-full justify-center disabled:opacity-50"
        >
          <Camera className="h-3.5 w-3.5" />
          {capturing ? 'Capturando…' : 'Capturar vaga'}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 ws-scroll-thin">
        {filtered.length === 0 && (
          <p className="px-2 py-3 text-2xs leading-relaxed text-subtle">
            Nenhuma candidatura encontrada.
          </p>
        )}
        <div className="flex flex-col gap-0.5">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              aria-current={item.id === currentId}
              className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-wash ${
                item.id === currentId ? 'bg-wash' : ''
              }`}
            >
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${statusColor(item.match_score)}`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-ink">{item.title}</span>
                <span className="block truncate text-2xs text-muted">{item.company}</span>
                <span className="block text-2xs text-subtle">
                  {new Date(item.created_at).toLocaleDateString('pt-BR')}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
