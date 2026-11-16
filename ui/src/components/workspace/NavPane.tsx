import { useMemo, useState } from 'react';
import { Camera, Search } from 'lucide-react';
import type { HistoryItem } from '../../services/api';

interface NavPaneProps {
  history: HistoryItem[];
  currentId?: string;
  capturing: boolean;
  onSelect: (item: HistoryItem) => void;
  onCapture: () => void;
}

function statusColor(score: number): string {
  if (score >= 70) return 'bg-ok';
  if (score >= 40) return 'bg-mac-yellow';
  return 'bg-danger';
}

export function NavPane({ history, currentId, capturing, onSelect, onCapture }: NavPaneProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter((item) =>
      `${item.title} ${item.company} ${item.location || ''}`.toLowerCase().includes(q),
    );
  }, [history, query]);

  return (
    <aside className="hidden h-full w-[248px] shrink-0 flex-col border-r border-line bg-wash lg:flex">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-white px-3">
        <Search className="h-3.5 w-3.5 text-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar candidatura"
          className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-subtle"
        />
      </div>

      <div className="shrink-0 border-b border-line p-3">
        <button
          type="button"
          onClick={onCapture}
          disabled={capturing}
          className="brutal-btn-yellow flex w-full items-center justify-center gap-1.5 px-3 py-2 text-2xs disabled:opacity-50"
        >
          <Camera className="h-3.5 w-3.5" />
          {capturing ? 'Capturando…' : 'Capturar vaga'}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-muted">
          Candidaturas
        </div>
        {filtered.length === 0 && (
          <p className="px-3 py-2 text-2xs text-subtle">Nenhuma candidatura encontrada.</p>
        )}
        <div className="flex flex-col">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={`flex w-full items-start gap-2 border-b border-line px-3 py-2.5 text-left transition-colors hover:bg-white ${
                item.id === currentId ? 'bg-white' : ''
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
    </aside>
  );
}