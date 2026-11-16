import {
  Camera,
  Download,
  PanelRight,
  Redo2,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react';

export type WorkspaceView = 'document' | 'latex' | 'pdf';

interface CommandBarProps {
  title: string;
  company: string;
  saveStatus: 'saved' | 'saving' | 'error';
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  onCapture: () => void;
  onDownload: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
  onClose: () => void;
}

const VIEWS: { id: WorkspaceView; label: string }[] = [
  { id: 'document', label: 'Documento' },
  { id: 'latex', label: 'LaTeX' },
  { id: 'pdf', label: 'PDF' },
];

export function CommandBar({
  title,
  company,
  saveStatus,
  view,
  onViewChange,
  onCapture,
  onDownload,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  inspectorOpen,
  onToggleInspector,
  chatOpen,
  onToggleChat,
  onClose,
}: CommandBarProps) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-3 overflow-x-auto border-b border-line bg-white px-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-sm font-semibold tracking-tight">resuMe</span>
        <span className="h-4 w-px bg-line" />
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-ink">{title}</div>
          <div className="truncate text-2xs text-muted">{company}</div>
        </div>
        <span
          className={`shrink-0 text-2xs ${
            saveStatus === 'saved'
              ? 'text-ok'
              : saveStatus === 'saving'
                ? 'text-muted'
                : 'text-danger'
          }`}
        >
          {saveStatus === 'saved' ? 'Salvo' : saveStatus === 'saving' ? 'Salvando…' : 'Erro'}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <div className="hidden items-center gap-1 md:flex">
          <button
            type="button"
            aria-label="Desfazer"
            title="Desfazer"
            onClick={onUndo}
            disabled={!canUndo}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-wash hover:text-black disabled:opacity-30"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Refazer"
            title="Refazer"
            onClick={onRedo}
            disabled={!canRedo}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-wash hover:text-black disabled:opacity-30"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <span className="mx-1 h-4 w-px bg-line" />
        </div>

        <div className="hidden items-center rounded-lg border border-line bg-wash p-0.5 md:flex">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              className={`rounded-md px-2.5 py-1 text-2xs font-semibold transition-colors ${
                view === item.id ? 'bg-white text-ink shadow-mac' : 'text-muted hover:text-black'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCapture}
          className="brutal-btn ml-1 hidden items-center gap-1.5 px-3 py-1.5 text-2xs md:flex"
        >
          <Camera className="h-3.5 w-3.5" />
          Capturar vaga
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="brutal-btn-yellow hidden items-center gap-1.5 px-3 py-1.5 text-2xs md:flex"
        >
          <Download className="h-3.5 w-3.5" />
          Baixar PDF
        </button>

        <span className="mx-1 hidden h-4 w-px bg-line md:block" />

        <button
          type="button"
          aria-label="Chat com IA"
          title="Chat com IA"
          onClick={onToggleChat}
          className={`hidden h-7 w-7 items-center justify-center rounded-md hover:bg-wash hover:text-black lg:flex ${
            chatOpen ? 'text-ink' : 'text-muted'
          }`}
        >
          <Sparkles className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={inspectorOpen ? 'Ocultar inspetor' : 'Mostrar inspetor'}
          title={inspectorOpen ? 'Ocultar inspetor' : 'Mostrar inspetor'}
          onClick={onToggleInspector}
          className={`hidden h-7 w-7 items-center justify-center rounded-md hover:bg-wash hover:text-black lg:flex ${
            inspectorOpen ? 'text-ink' : 'text-muted'
          }`}
        >
          <PanelRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Fechar workspace"
          title="Fechar"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-wash hover:text-black"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}