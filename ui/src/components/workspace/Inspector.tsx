import { Clock, FileCode } from 'lucide-react';
import type { ResumeVersion } from './document';

interface InspectorProps {
  versions: ResumeVersion[];
  onRestore: (version: ResumeVersion) => void;
  saveStatus: 'saved' | 'saving' | 'error';
  onClose: () => void;
}

export function Inspector({ versions, onRestore, saveStatus, onClose }: InspectorProps) {
  return (
    <aside className="hidden h-full w-[300px] shrink-0 flex-col border-l border-line bg-white lg:flex">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted">Inspetor</span>
        <span
          className={`text-2xs ${
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

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-2">
            <FileCode className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <div>
              <div className="text-xs font-semibold text-ink">Editor LaTeX</div>
              <p className="mt-1 text-2xs leading-relaxed text-muted">
                Edite o código à esquerda como se estivesse dentro do arquivo.
                O PDF ao lado atualiza sozinho depois de você parar de digitar.
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted">
              Atalhos
            </div>
            <div className="flex flex-col gap-1 text-2xs text-muted">
              <div className="flex items-center justify-between">
                <span>Salvar / compilar</span>
                <kbd className="rounded border border-line bg-wash px-1.5 py-0.5">Ctrl S</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Buscar</span>
                <kbd className="rounded border border-line bg-wash px-1.5 py-0.5">Ctrl F</kbd>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-muted">
              <Clock className="h-3.5 w-3.5" />
              Versões
            </div>
            {versions.length === 0 ? (
              <p className="text-2xs text-subtle">Nenhuma versão salva ainda.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {versions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => onRestore(version)}
                    className="flex items-center justify-between rounded-md border border-line px-2 py-1.5 text-left text-2xs hover:bg-wash"
                  >
                    <span>{new Date(version.at).toLocaleString('pt-BR')}</span>
                    <span className="text-subtle">Restaurar</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted">
              Fonte
            </div>
            <p className="text-2xs leading-relaxed text-muted">
              A fonte do PDF fica em <strong>Ajustes → Documento</strong>. Padrão:
              Latin Modern.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="brutal-btn mt-2 w-full px-3 py-2 text-2xs"
            >
              Fechar workspace
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}