import { useState, type ReactNode } from 'react';
import {
  Download,
  History,
  Layers,
  MoreHorizontal,
  Redo2,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react';

export type WorkspaceView = 'document' | 'latex' | 'fields';

interface CommandBarProps {
  title: string;
  company: string;
  saveStatus: 'saved' | 'saving' | 'error';
  savedAgo: string;
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  onDownload: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  fitScore: number | null;
  atsCoverage: number | null;
  leftSheet: 'history' | 'structure' | null;
  rightSheet: 'metrics' | 'chat' | null;
  onOpenHistory: () => void;
  onOpenStructure: () => void;
  onOpenMetrics: () => void;
  onToggleChat: () => void;
  onClose: () => void;
}

const VIEWS: { id: WorkspaceView; label: string; short: string }[] = [
  { id: 'document', label: 'Documento', short: 'Doc' },
  { id: 'latex', label: 'LaTeX', short: 'TeX' },
  { id: 'fields', label: 'Campos', short: 'Campos' },
];

const tone = (value: number | null) => {
  if (value == null) return 'muted';
  if (value >= 70) return 'ok';
  if (value >= 45) return 'warn';
  return 'danger';
};

/**
 * Uma linha só. O documento ocupa o resto. Tudo que não é edição vive em
 * folha lateral, aberta por um clique.
 */
export function CommandBar({
  title,
  company,
  saveStatus,
  savedAgo,
  view,
  onViewChange,
  onDownload,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  fitScore,
  atsCoverage,
  leftSheet,
  rightSheet,
  onOpenHistory,
  onOpenStructure,
  onOpenMetrics,
  onToggleChat,
  onClose,
}: CommandBarProps) {
  const saveLabel =
    saveStatus === 'saving' ? 'Salvando…' : saveStatus === 'error' ? 'Não salvou' : 'Salvo';
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="ws-bar gap-1.5 sm:gap-2">
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar workspace"
        title="Fechar"
        className="ws-icon-btn"
      >
        <X className="h-4 w-4" />
      </button>

      <span className="hidden shrink-0 pr-1 text-sm font-semibold tracking-tight text-ink sm:inline">
        resuMe
      </span>

      <div className="hidden min-w-0 flex-1 sm:block">
        <div className="truncate text-xs font-semibold leading-tight text-ink">{title}</div>
        <div className="truncate text-2xs leading-tight text-muted">{company}</div>
      </div>
      <div className="min-w-0 flex-1 sm:hidden">
        <div className="truncate text-xs font-semibold leading-tight text-ink">{title}</div>
      </div>

      <div
        className="flex shrink-0 items-center gap-1.5 text-2xs"
        aria-live="polite"
        data-testid="save-status"
      >
        <span
          className={`ws-dot ${
            saveStatus === 'saving'
              ? 'text-mac-yellow ws-dot-pulse'
              : saveStatus === 'error'
                ? 'text-danger'
                : 'text-ok'
          }`}
        />
        <span
          className={`hidden md:inline ${
            saveStatus === 'error'
              ? 'font-semibold text-danger'
              : saveStatus === 'saving'
                ? 'text-muted'
                : 'text-ok'
          }`}
        >
          {saveLabel}
        </span>
        {saveStatus === 'saved' && <span className="hidden text-subtle lg:inline">{savedAgo}</span>}
      </div>

      <div className="hidden shrink-0 items-center gap-0.5 lg:flex">
        <button
          type="button"
          aria-label="Desfazer"
          title="Desfazer"
          onClick={onUndo}
          disabled={!canUndo}
          className="ws-icon-btn disabled:opacity-30"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Refazer"
          title="Refazer"
          onClick={onRedo}
          disabled={!canRedo}
          className="ws-icon-btn disabled:opacity-30"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="ws-tabs shrink-0" role="tablist" aria-label="Modo de edição">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={view === item.id}
            onClick={() => onViewChange(item.id)}
            className="ws-tab"
            data-active={view === item.id ? 'true' : 'false'}
            title={item.label}
          >
            <span className="hidden md:inline">{item.label}</span>
            <span className="md:hidden">{item.short}</span>
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onOpenHistory}
          aria-label="Candidaturas"
          title="Candidaturas"
          aria-pressed={leftSheet === 'history'}
          className={`ws-icon-btn hidden sm:inline-flex ${
            leftSheet === 'history' ? 'bg-wash text-ink' : ''
          }`}
        >
          <History className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onOpenStructure}
          aria-label="Estrutura"
          title="Estrutura: arrastar seções"
          aria-pressed={leftSheet === 'structure'}
          className={`ws-icon-btn hidden sm:inline-flex ${
            leftSheet === 'structure' ? 'bg-wash text-ink' : ''
          }`}
        >
          <Layers className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onOpenMetrics}
          aria-label="Métricas"
          title="Métricas explicadas"
          aria-pressed={rightSheet === 'metrics'}
          className="ws-chip hidden sm:inline-flex"
          data-tone={tone(atsCoverage)}
          data-testid="metrics-chip"
        >
          <span className="hidden text-subtle md:inline">ATS</span>
          <span>{atsCoverage == null ? '—' : `${Math.round(atsCoverage)}%`}</span>
          {fitScore != null && fitScore > 0 && (
            <span className="hidden text-subtle lg:inline">· {Math.round(fitScore)}% vaga</span>
          )}
        </button>

        <button
          type="button"
          onClick={onDownload}
          className="ws-btn ws-btn-brand"
          aria-label="Baixar PDF"
          title="Baixar PDF"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Baixar PDF</span>
        </button>

        <button
          type="button"
          onClick={onToggleChat}
          aria-label="Ajustar com IA"
          title="Ajustar com IA"
          aria-pressed={rightSheet === 'chat'}
          className={`ws-btn ${rightSheet === 'chat' ? 'ws-btn-primary' : ''}`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Ajustar com IA</span>
        </button>

        <div className="relative sm:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Mais ações"
            title="Mais ações"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className={`ws-icon-btn ${menuOpen ? 'bg-wash text-ink' : ''}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Fechar menu"
                tabIndex={-1}
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div
                role="menu"
                className="absolute right-0 top-9 z-50 w-52 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]"
              >
                <div className="px-3 py-1.5 text-2xs text-muted">
                  ATS {atsCoverage == null ? '—' : `${Math.round(atsCoverage)}%`}
                  {fitScore != null && fitScore > 0 ? ` · ${Math.round(fitScore)}% vaga` : ''}
                </div>
                <MenuAction
                  icon={<History className="h-3.5 w-3.5" />}
                  label="Candidaturas"
                  active={leftSheet === 'history'}
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenHistory();
                  }}
                />
                <MenuAction
                  icon={<Layers className="h-3.5 w-3.5" />}
                  label="Estrutura"
                  active={leftSheet === 'structure'}
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenStructure();
                  }}
                />
                <MenuAction
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  label="Métricas"
                  active={rightSheet === 'metrics'}
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenMetrics();
                  }}
                />
                <div className="my-1 border-t border-line" />
                <MenuAction
                  icon={<Undo2 className="h-3.5 w-3.5" />}
                  label="Desfazer"
                  disabled={!canUndo}
                  onClick={() => {
                    setMenuOpen(false);
                    onUndo();
                  }}
                />
                <MenuAction
                  icon={<Redo2 className="h-3.5 w-3.5" />}
                  label="Refazer"
                  disabled={!canRedo}
                  onClick={() => {
                    setMenuOpen(false);
                    onRedo();
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuAction({
  icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-ink hover:bg-wash disabled:opacity-40 ${
        active ? 'bg-wash' : ''
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
