import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  X,
} from 'lucide-react';
import type { CandidateProfile, ResumeSectionType } from '../../services/api';
import type { ResumeVersion } from './document';
import {
  SECTION_LABEL,
  countFor,
  ensureLayout,
  itemsFor,
  reorderItems,
  reorderSections,
  toggleSection,
} from './layout';

interface StructurePanelProps {
  profile: CandidateProfile;
  onChange: (profile: CandidateProfile) => void;
  onClose: () => void;
  onEditSection: (type: ResumeSectionType) => void;
  versions: ResumeVersion[];
  onRestore: (version: ResumeVersion) => void;
}

type Drag =
  | { kind: 'section'; index: number }
  | { kind: 'item'; type: ResumeSectionType; index: number };

/**
 * Estrutura do currículo: arrastar seção muda a ordem no PDF, arrastar item
 * muda a ordem dentro da seção. Tudo passa pelo mesmo perfil que o editor
 * visual e o chat usam, e o autosave recompila.
 */
export function StructurePanel({
  profile,
  onChange,
  onClose,
  onEditSection,
  versions,
  onRestore,
}: StructurePanelProps) {
  const layout = ensureLayout(profile);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<Drag | null>(null);

  const isOpen = (type: string) => expanded[type] !== false;

  const toggle = (type: string) =>
    setExpanded((prev) => ({ ...prev, [type]: !isOpen(type) }));

  const drop = () => {
    if (drag && over) {
      if (drag.kind === 'section' && over.kind === 'section' && drag.index !== over.index) {
        onChange(reorderSections(profile, drag.index, over.index));
      }
      if (
        drag.kind === 'item' &&
        over.kind === 'item' &&
        drag.type === over.type &&
        drag.index !== over.index
      ) {
        onChange(reorderItems(profile, drag.type, drag.index, over.index));
      }
    }
    setDrag(null);
    setOver(null);
  };

  return (
    <div
      className="ws-sheet ws-sheet-left w-[320px] max-w-[92vw]"
      role="dialog"
      aria-label="Estrutura do currículo"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">Estrutura</h2>
          <p className="mt-0.5 text-2xs leading-relaxed text-muted">
            Arraste para mudar a ordem. O PDF acompanha.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar estrutura"
          className="ws-icon-btn"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 ws-scroll-thin">
        <ul className="flex flex-col gap-0.5">
          {layout.sections.map((section, index) => {
            const type = section.type as ResumeSectionType;
            const label = SECTION_LABEL[type] || type;
            const count = countFor(profile, type);
            const items = itemsFor(profile, type);
            const open = isOpen(type) && items.length > 0;
            const visible = section.visible !== false;

            return (
              <li key={type}>
                <div
                  className="ws-row"
                  draggable
                  data-dragging={drag?.kind === 'section' && drag.index === index ? 'true' : 'false'}
                  data-over={over?.kind === 'section' && over.index === index ? 'true' : 'false'}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', `section:${index}`);
                    setDrag({ kind: 'section', index });
                  }}
                  onDragOver={(event) => {
                    if (!drag) return;
                    event.preventDefault();
                    setOver({ kind: 'section', index });
                  }}
                  onDragEnd={() => {
                    setDrag(null);
                    setOver(null);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    drop();
                  }}
                >
                  <span className="ws-grip" aria-hidden="true">
                    <GripVertical className="h-3.5 w-3.5" />
                  </span>

                  <button
                    type="button"
                    onClick={() => toggle(type)}
                    disabled={items.length === 0}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left disabled:cursor-default"
                    aria-expanded={open}
                  >
                    {items.length > 0 ? (
                      open ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-subtle" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-subtle" />
                      )
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    <span
                      className={`truncate font-semibold ${
                        visible ? 'text-ink' : 'text-subtle line-through'
                      }`}
                    >
                      {label}
                    </span>
                    <span className="shrink-0 text-2xs text-subtle">{count}</span>
                  </button>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onEditSection(type)}
                      title={`Editar ${label}`}
                      aria-label={`Editar ${label}`}
                      className="ws-icon-btn h-6 w-6"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(toggleSection(profile, type))}
                      title={visible ? `Ocultar ${label} do PDF` : `Mostrar ${label} no PDF`}
                      aria-label={visible ? `Ocultar ${label} do PDF` : `Mostrar ${label} no PDF`}
                      aria-pressed={visible}
                      className="ws-icon-btn h-6 w-6"
                    >
                      {visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(reorderSections(profile, index, index - 1))}
                      disabled={index === 0}
                      title="Mover para cima"
                      aria-label={`Mover ${label} para cima`}
                      className="ws-icon-btn h-6 w-6 disabled:opacity-30"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(reorderSections(profile, index, index + 1))}
                      disabled={index === layout.sections.length - 1}
                      title="Mover para baixo"
                      aria-label={`Mover ${label} para baixo`}
                      className="ws-icon-btn h-6 w-6 disabled:opacity-30"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {open && (
                  <ul className="mb-1 ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-line pl-2">
                    {items.map((item) => (
                      <li
                        key={`${type}-${item.index}`}
                        className="ws-row py-1"
                        draggable
                        data-dragging={
                          drag?.kind === 'item' && drag.type === type && drag.index === item.index
                            ? 'true'
                            : 'false'
                        }
                        data-over={
                          over?.kind === 'item' && over.type === type && over.index === item.index
                            ? 'true'
                            : 'false'
                        }
                        onDragStart={(event) => {
                          event.stopPropagation();
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', `${type}:${item.index}`);
                          setDrag({ kind: 'item', type, index: item.index });
                        }}
                        onDragOver={(event) => {
                          if (drag?.kind !== 'item' || drag.type !== type) return;
                          event.preventDefault();
                          event.stopPropagation();
                          setOver({ kind: 'item', type, index: item.index });
                        }}
                        onDragEnd={() => {
                          setDrag(null);
                          setOver(null);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          drop();
                        }}
                      >
                        <span className="ws-grip" aria-hidden="true">
                          <GripVertical className="h-3 w-3" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-2xs font-medium text-ink">
                            {item.label}
                          </span>
                          {item.sub && (
                            <span className="block truncate text-2xs text-subtle">{item.sub}</span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onChange(reorderItems(profile, type, item.index, item.index - 1))
                          }
                          disabled={item.index === 0}
                          title="Mover para cima"
                          aria-label={`Mover ${item.label} para cima`}
                          className="ws-icon-btn h-5 w-5 disabled:opacity-30"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onChange(reorderItems(profile, type, item.index, item.index + 1))
                          }
                          disabled={item.index === items.length - 1}
                          title="Mover para baixo"
                          aria-label={`Mover ${item.label} para baixo`}
                          className="ws-icon-btn h-5 w-5 disabled:opacity-30"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-4 border-t border-line px-2 pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted">
            <Clock className="h-3 w-3" />
            Versões
          </div>
          {versions.length === 0 ? (
            <p className="text-2xs leading-relaxed text-subtle">
              Cada salvamento cria uma versão. Nenhuma ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
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
      </div>

      <footer className="shrink-0 border-t border-line px-4 py-2.5">
        <p className="text-2xs leading-relaxed text-muted">
          Olho riscado tira a seção do PDF, não do seu perfil. O que você esconde volta com um
          clique.
        </p>
      </footer>
    </div>
  );
}
