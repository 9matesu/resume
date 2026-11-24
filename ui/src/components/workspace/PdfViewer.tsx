import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Check, Minus, Plus, SquareArrowOutUpRight } from 'lucide-react';
import type { CandidateProfile } from '../../services/api';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

interface Field {
  id: string;
  label: string;
  value: string;
}

interface PdfViewerProps {
  pdfUrl: string;
  profile: CandidateProfile;
  onEditField: (fieldId: string, value: string, previous: string) => void;
  onOpenCode?: () => void;
  onPages?: (pages: number) => void;
}

interface RawItem {
  str: string;
  left: number;
  top: number;
  fontSize: number;
  width: number;
  fieldId?: string;
}

interface Line {
  items: RawItem[];
  str: string;
  top: number;
  bottom: number;
  fontSize: number;
}

interface PageBox {
  width: number;
  height: number;
}

interface Editing {
  page: number;
  fieldId: string;
  label: string;
  previous: string;
  value: string;
  left: number;
  top: number;
  width: number;
  fontSize: number;
}

const normalize = (value: string) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function buildFields(profile: CandidateProfile): Field[] {
  const fields: Field[] = [];
  const p = profile.personal || ({} as CandidateProfile['personal']);
  const push = (id: string, label: string, value?: string) => {
    if (value != null && String(value).trim()) fields.push({ id, label, value: String(value) });
  };

  push('personal.name', 'Nome', p.name);
  push('personal.email', 'E-mail', p.email);
  push('personal.phone', 'Telefone', p.phone);
  push('personal.location', 'Localização', p.location);
  push('personal.linkedin', 'LinkedIn', p.linkedin);
  push('personal.github', 'GitHub', p.github);
  push('personal.portfolio', 'Portfólio', p.portfolio);
  push('summary', 'Resumo', profile.summary);

  (profile.experience || []).forEach((exp, i) => {
    push(`experience.${i}.title`, `Experiência ${i + 1}: cargo`, exp.title);
    push(`experience.${i}.company`, `Experiência ${i + 1}: empresa`, exp.company);
    push(`experience.${i}.period`, `Experiência ${i + 1}: período`, exp.period);
    push(`experience.${i}.location`, `Experiência ${i + 1}: local`, exp.location);
    (exp.description || []).forEach((bullet, j) => {
      push(`experience.${i}.description.${j}`, `Experiência ${i + 1}: item ${j + 1}`, bullet);
    });
  });

  (profile.leadership || []).forEach((lead, i) => {
    push(`leadership.${i}.title`, `Liderança ${i + 1}: cargo`, lead.title);
    push(`leadership.${i}.company`, `Liderança ${i + 1}: organização`, lead.company);
    push(`leadership.${i}.period`, `Liderança ${i + 1}: período`, lead.period);
    push(`leadership.${i}.location`, `Liderança ${i + 1}: local`, lead.location);
    (lead.description || []).forEach((bullet, j) => {
      push(`leadership.${i}.description.${j}`, `Liderança ${i + 1}: item ${j + 1}`, bullet);
    });
  });

  (profile.education || []).forEach((edu, i) => {
    push(`education.${i}.institution`, `Formação ${i + 1}: instituição`, edu.institution);
    push(`education.${i}.degree`, `Formação ${i + 1}: curso`, edu.degree);
    push(`education.${i}.year`, `Formação ${i + 1}: ano`, edu.year);
    push(`education.${i}.location`, `Formação ${i + 1}: local`, edu.location);
  });

  (profile.skills || []).forEach((skill, i) => {
    push(`skills.${i}`, `Habilidade ${i + 1}`, skill);
  });

  (profile.projects || []).forEach((project, i) => {
    push(`projects.${i}.name`, `Projeto ${i + 1}`, project.name);
    push(`projects.${i}.role`, `Projeto ${i + 1}: papel`, project.role);
    push(`projects.${i}.period`, `Projeto ${i + 1}: período`, project.period);
    const description = project.description;
    const bullets = Array.isArray(description) ? description : description ? [description] : [];
    bullets.forEach((bullet, j) => {
      push(`projects.${i}.description.${j}`, `Projeto ${i + 1}: item ${j + 1}`, bullet);
    });
  });

  (profile.certifications || []).forEach((cert, i) => {
    push(`certifications.${i}`, `Certificação ${i + 1}`,
      typeof cert === 'string' ? cert : cert.name);
  });

  (profile.languages || []).forEach((lang, i) => {
    push(`languages.${i}.name`, `Idioma ${i + 1}`, lang.name);
  });

  return fields.filter((f) => f.value.trim().length > 1);
}

/** Score 0..1 do quanto um trecho do PDF corresponde a um campo. */
function fieldScore(chunk: string, fieldValue: string): number {
  const a = normalize(chunk);
  const b = normalize(fieldValue);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const min = Math.min(a.length, b.length);
  const max = Math.max(a.length, b.length);
  if (min >= 3 && min / max >= 0.5 && (a.includes(b) || b.includes(a))) {
    return 0.6 + 0.4 * (min / max);
  }

  const ta = new Set(a.split(' ').filter(Boolean));
  const tb = new Set(b.split(' ').filter(Boolean));
  if (ta.size && tb.size) {
    let inter = 0;
    ta.forEach((t) => {
      if (tb.has(t)) inter += 1;
    });
    if (inter > 0) return 0.55 * (inter / Math.max(ta.size, tb.size));
  }
  return 0;
}

function bestField(chunk: string, fields: Field[]): Field | undefined {
  const text = normalize(chunk);
  if (text.length < 2) return undefined;
  let best: Field | undefined;
  let bestScore = 0;
  for (const field of fields) {
    const score = fieldScore(chunk, field.value);
    if (score > bestScore) {
      bestScore = score;
      best = field;
    }
  }
  return bestScore >= 0.55 ? best : undefined;
}

/** Agrupa itens de texto que estão na mesma linha visual. */
function groupLines(items: RawItem[]): Line[] {
  const lines: Line[] = [];
  for (const it of items) {
    const cy = it.top + it.fontSize / 2;
    let line = lines.find((l) => {
      const lcy = (l.top + l.bottom) / 2;
      return Math.abs(lcy - cy) < Math.max(4, it.fontSize * 0.45);
    });
    if (!line) {
      line = {
        items: [],
        str: '',
        top: it.top,
        bottom: it.top + it.fontSize,
        fontSize: it.fontSize,
      };
      lines.push(line);
    } else {
      line.top = Math.min(line.top, it.top);
      line.bottom = Math.max(line.bottom, it.top + it.fontSize);
      line.fontSize = Math.max(line.fontSize, it.fontSize);
    }
    line.items.push(it);
  }
  for (const l of lines) {
    l.str = l.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
  }
  return lines;
}

/**
 * Documento editável por cima do PDF.
 *
 * O PDF é a verdade visual: cada linha vira uma área clicável. O clique abre o
 * campo no lugar, e a edição volta para o .tex pelo Workspace. Nada de modal,
 * nada de formulário paralelo.
 */
export function PdfViewer({ pdfUrl, profile, onEditField, onOpenCode, onPages }: PdfViewerProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  const tokenRef = useRef(0);
  const userZoomRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1);
  const [baseSizes, setBaseSizes] = useState<PageBox[]>([]);
  const [itemsByPage, setItemsByPage] = useState<Record<number, RawItem[]>>({});
  const [editing, setEditing] = useState<Editing | null>(null);
  const [hovered, setHovered] = useState<{ page: number; fieldId: string } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const fieldMap = useMemo(() => buildFields(profile), [profile]);
  const pageCount = baseSizes.length;

  useEffect(() => {
    let cancelled = false;
    ++tokenRef.current;
    setLoading(true);
    setError('');
    setEditing(null);
    setItemsByPage({});

    const load = async () => {
      try {
        const task = pdfjs.getDocument({ url: pdfUrl });
        const pdf = await task.promise;
        if (cancelled) return;
        docRef.current = pdf;
        const sizes: PageBox[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          sizes.push({ width: viewport.width, height: viewport.height });
        }
        if (cancelled) return;
        setBaseSizes(sizes);
        onPages?.(pdf.numPages);

        // Encaixa na área visível antes de desenhar.
        const stage = stageRef.current;
        if (stage && sizes[0] && !userZoomRef.current) {
          const rect = stage.getBoundingClientRect();
          const availW = Math.max(240, rect.width - 32);
          const availH = Math.max(240, rect.height - 32);
          const byWidth = availW / sizes[0].width;
          const byHeight = availH / sizes[0].height;
          const next = pdf.numPages === 1 ? Math.min(byWidth, byHeight, 1.8) : Math.min(byWidth, 1.8);
          setScale(Math.max(0.35, Math.round(next * 100) / 100));
        }
      } catch (err) {
        const name = (err as { name?: string })?.name;
        if (!cancelled && name !== 'RenderingCancelledException') {
          setError(err instanceof Error ? err.message : 'Não abri o PDF.');
          setLoading(false);
        }
      }
    };
    void load();

    return () => {
      cancelled = true;
      tokenRef.current += 1;
      const doc = docRef.current as unknown as { destroy?: () => Promise<void> } | null;
      void doc?.destroy?.().catch(() => {});
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl]);

  useEffect(() => {
    const pdf = docRef.current;
    const stage = stageRef.current;
    if (!pdf || !stage || !baseSizes.length) return;
    const token = tokenRef.current;
    const fields = buildFields(profile);

    const draw = async () => {
      const next: Record<number, RawItem[]> = {};
      for (let i = 1; i <= baseSizes.length; i++) {
        if (tokenRef.current !== token) return;
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const host = stage.querySelector<HTMLDivElement>(`[data-page-host="${i}"]`);
        if (!host) continue;
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.display = 'block';
        host.replaceChildren(canvas);
        const context = canvas.getContext('2d');
        if (!context) continue;
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (tokenRef.current !== token) return;

        const textContent = await page.getTextContent();
        const raw: RawItem[] = [];
        for (const r of textContent.items) {
          if (!('str' in r) || !('transform' in r) || !('width' in r)) continue;
          const item = r as { str: string; transform: number[]; width: number };
          if (!item.str || !item.str.trim()) continue;
          const tx = pdfjs.Util.transform(viewport.transform, item.transform);
          const fontSize = Math.hypot(tx[2], tx[3]) || 12;
          const left = tx[4];
          const top = tx[5] - fontSize;
          const width = item.width * (Math.hypot(tx[0], tx[1]) || scale);
          const field = bestField(item.str, fields);
          raw.push({ str: item.str, left, top, fontSize, width, fieldId: field?.id });
        }

        const lines = groupLines(raw);
        if (i === 1) {
          // Heurística do nome: maior fonte da primeira página.
          let largest: Line | null = null;
          for (const line of lines) {
            if (!largest || line.fontSize > largest.fontSize) largest = line;
          }
          const name = (profile.personal || {}).name || '';
          if (largest && name && fieldScore(largest.str, name) >= 0.45) {
            largest.items.forEach((it) => { it.fieldId = 'personal.name'; });
          }
        }

        for (const line of lines) {
          const withField = line.items.find((it) => it.fieldId);
          if (withField) {
            line.items.forEach((it) => { if (!it.fieldId) it.fieldId = withField.fieldId; });
          } else {
            const field = bestField(line.str, fields);
            if (field) line.items.forEach((it) => { if (!it.fieldId) it.fieldId = field.id; });
          }
        }

        next[i] = raw;
      }
      if (tokenRef.current !== token) return;
      setItemsByPage(next);
      setLoading(false);
    };
    void draw().catch((err) => {
      if ((err as { name?: string })?.name === 'RenderingCancelledException') return;
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Não desenhei o PDF.');
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseSizes, scale, pdfUrl]);

  const openField = useCallback(
    (page: number, item: RawItem) => {
      if (!item.fieldId) return;
      const field = fieldMap.find((f) => f.id === item.fieldId);
      if (!field) return;
      setEditing({
        page,
        fieldId: field.id,
        label: field.label,
        previous: field.value,
        value: field.value,
        left: item.left,
        top: item.top,
        width: Math.max(item.width, 160),
        fontSize: item.fontSize,
      });
    },
    [fieldMap],
  );

  const commit = useCallback(() => {
    if (!editing) return;
    const next = editing.value;
    const previous = editing.previous;
    setEditing(null);
    if (normalize(next) === normalize(previous)) return;
    onEditField(editing.fieldId, next, previous);
    setFlash(editing.fieldId);
    window.setTimeout(() => setFlash(null), 700);
  }, [editing, onEditField]);

  const cancel = useCallback(() => setEditing(null), []);

  const zoom = (delta: number) => {
    userZoomRef.current = true;
    setScale((s) => Math.max(0.35, Math.min(2.6, Number((s + delta).toFixed(2)))));
  };

  const fit = () => {
    userZoomRef.current = false;
    const stage = stageRef.current;
    if (!stage || !baseSizes[0]) return;
    const rect = stage.getBoundingClientRect();
    const byWidth = (rect.width - 32) / baseSizes[0].width;
    const byHeight = (rect.height - 32) / baseSizes[0].height;
    const next = pageCount === 1 ? Math.min(byWidth, byHeight, 1.8) : Math.min(byWidth, 1.8);
    setScale(Math.max(0.35, Math.round(next * 100) / 100));
  };

  const hoveredLabel = hovered
    ? fieldMap.find((f) => f.id === hovered.fieldId)?.label
    : undefined;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-[#ececec]">
      {loading && (
        <div className="ws-progress" aria-hidden="true">
          <span />
        </div>
      )}

      <div ref={stageRef} className="ws-stage ws-scroll-thin" data-testid="pdf-stage">
        {loading && baseSizes.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            Montando a página…
          </div>
        )}
        {error ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-xs text-danger">
            {error}
          </div>
        ) : (
          baseSizes.map((size, index) => {
            const page = index + 1;
            const width = Math.floor(size.width * scale);
            const height = Math.floor(size.height * scale);
            const items = itemsByPage[page] || [];
            return (
              <div
                key={page}
                className="ws-page"
                data-testid={`pdf-page-${page}`}
                style={{ width, height }}
              >
                <div data-page-host={page} />
                <div className="absolute inset-0">
                  {items.map((item, itemIndex) =>
                    item.fieldId ? (
                      <button
                        key={itemIndex}
                        type="button"
                        onClick={() => openField(page, item)}
                        onMouseEnter={() => setHovered({ page, fieldId: item.fieldId as string })}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setHovered({ page, fieldId: item.fieldId as string })}
                        onBlur={() => setHovered(null)}
                        aria-label={`Editar: ${
                          fieldMap.find((f) => f.id === item.fieldId)?.label || 'campo'
                        }`}
                        data-field={item.fieldId}
                        data-active={editing?.fieldId === item.fieldId ? 'true' : 'false'}
                        className={`ws-hit ${
                          flash === item.fieldId ? 'ws-flash' : ''
                        }`}
                        style={{
                          left: item.left,
                          top: item.top,
                          width: Math.max(8, item.width),
                          height: Math.max(8, item.fontSize),
                          fontSize: item.fontSize,
                          lineHeight: 1,
                        }}
                      >
                        {item.str}
                      </button>
                    ) : (
                      <span
                        key={itemIndex}
                        className="pointer-events-none absolute whitespace-pre"
                        style={{
                          left: item.left,
                          top: item.top,
                          fontSize: item.fontSize,
                          lineHeight: 1,
                          color: 'transparent',
                        }}
                      >
                        {item.str}
                      </span>
                    ),
                  )}

                  {editing && editing.page === page && (
                    <textarea
                      autoFocus
                      value={editing.value}
                      onChange={(event) =>
                        setEditing((current) =>
                          current ? { ...current, value: event.target.value } : current,
                        )
                      }
                      onBlur={commit}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          cancel();
                        }
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          commit();
                        }
                      }}
                      rows={1}
                      aria-label={editing.label}
                      data-testid="pdf-inline-input"
                      className="ws-inline-input"
                      style={{
                        left: editing.left,
                        top: editing.top,
                        width: Math.max(editing.width, 180),
                        fontSize: Math.max(11, editing.fontSize),
                        lineHeight: 1.25,
                        height: Math.max(24, editing.fontSize * 1.9),
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {!error && (
        <div className="ws-hud bottom-3 left-1/2 -translate-x-1/2">
          {editing ? (
            <>
              <span className="font-semibold text-ink">{editing.label}</span>
              <span className="text-subtle">Enter salva · Esc sai</span>
              <button
                type="button"
                onClick={commit}
                className="ml-1 inline-flex items-center gap-1 rounded-md bg-black px-2 py-0.5 text-2xs font-semibold text-white"
              >
                <Check className="h-3 w-3" />
                Aplicar
              </button>
            </>
          ) : hoveredLabel ? (
            <span>
              Clique para editar: <strong className="text-ink">{hoveredLabel}</strong>
            </span>
          ) : (
            <span>Clique em qualquer linha para editar no lugar.</span>
          )}
        </div>
      )}

      {!error && (
        <div className="ws-hud bottom-3 right-3 gap-1">
          <button
            type="button"
            onClick={() => zoom(-0.1)}
            aria-label="Diminuir zoom"
            className="ws-icon-btn h-6 w-6"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={fit}
            title="Ajustar à tela"
            className="min-w-9 text-2xs font-semibold text-ink"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={() => zoom(0.1)}
            aria-label="Aumentar zoom"
            className="ws-icon-btn h-6 w-6"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {pageCount > 1 && (
            <span className="border-l border-line pl-2 text-2xs text-muted">{pageCount} páginas</span>
          )}
          {onOpenCode && (
            <button
              type="button"
              onClick={onOpenCode}
              title="Ver o código LaTeX"
              aria-label="Ver o código LaTeX"
              className="ws-icon-btn h-6 w-6"
            >
              <SquareArrowOutUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
