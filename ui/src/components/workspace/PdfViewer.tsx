import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { X } from 'lucide-react';
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
  left: number;
  right: number;
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
    if (value != null) fields.push({ id, label, value: String(value) });
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
  });

  (profile.certifications || []).forEach((cert, i) => {
    push(`certifications.${i}`, `Certificação ${i + 1}`,
      typeof cert === 'string' ? cert : cert.name);
  });

  (profile.languages || []).forEach((lang, i) => {
    push(`languages.${i}.name`, `Idioma ${i + 1}`, lang.name);
  });

  return fields.filter((f) => f.value && f.value.trim().length > 1);
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
        left: it.left,
        right: it.left + it.width,
        fontSize: it.fontSize,
      };
      lines.push(line);
    } else {
      line.top = Math.min(line.top, it.top);
      line.bottom = Math.max(line.bottom, it.top + it.fontSize);
      line.left = Math.min(line.left, it.left);
      line.right = Math.max(line.right, it.left + it.width);
      line.fontSize = Math.max(line.fontSize, it.fontSize);
    }
    line.items.push(it);
  }
  for (const l of lines) {
    l.str = l.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
  }
  return lines;
}

export function PdfViewer({ pdfUrl, profile, onEditField, onOpenCode }: PdfViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void; promise: Promise<unknown> } | null>(null);
  const userZoomRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Field | null>(null);
  const [value, setValue] = useState('');
  const [items, setItems] = useState<RawItem[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 794, height: 1123 });
  const [scale, setScale] = useState(1);
  const [hovered, setHovered] = useState<string | null>(null);
  const fieldMap = buildFields(profile);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setSelected(null);

    const load = async () => {
      try {
        if (renderTaskRef.current) {
          try { renderTaskRef.current.cancel(); } catch { /* já terminou */ }
          renderTaskRef.current = null;
        }

        const task = pdfjs.getDocument({ url: pdfUrl });
        const pdf = await task.promise;
        const page = await pdf.getPage(1);

        // Encaixa a página na área visível antes de desenhar.
        const base = page.getViewport({ scale: 1 });
        let s = scale;
        if (!userZoomRef.current && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const availW = Math.max(240, rect.width - 48);
          const availH = Math.max(240, rect.height - 48);
          s = Math.min(availW / base.width, availH / base.height, 2.5);
          s = Math.max(0.35, Math.round(s * 100) / 100);
          if (Math.abs(s - scale) > 0.001) setScale(s);
        }
        const viewport = page.getViewport({ scale: s });

        // Canvas novo a cada render: evita o erro de reusar o mesmo canvas
        // enquanto uma operação anterior ainda está ativa.
        const host = hostRef.current;
        if (!host) return;
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.display = 'block';
        host.replaceChildren(canvas);
        setCanvasSize({ width: canvas.width, height: canvas.height });

        const context = canvas.getContext('2d');
        if (!context) return;

        const rt = page.render({ canvas, canvasContext: context, viewport });
        renderTaskRef.current = rt;
        await rt.promise;
        if (renderTaskRef.current === rt) renderTaskRef.current = null;
        if (cancelled) return;

        const textContent = await page.getTextContent();
        const fields = buildFields(profile);

        // 1) tenta casar item a item
        const raw: RawItem[] = [];
        for (const r of textContent.items) {
          if (!('str' in r) || !('transform' in r) || !('width' in r)) continue;
          const item = r as { str: string; transform: number[]; width: number };
          if (!item.str || !item.str.trim()) continue;
          const tx = pdfjs.Util.transform(viewport.transform, item.transform);
          const fontSize = Math.hypot(tx[2], tx[3]) || 12;
          const left = tx[4];
          const top = tx[5] - fontSize;
          const width = item.width * (Math.hypot(tx[0], tx[1]) || s);
          const f = bestField(item.str, fields);
          raw.push({ str: item.str, left, top, fontSize, width, fieldId: f?.id });
        }

        // 2) agrupa linhas e propaga o campo para fragmentos
        const lines = groupLines(raw);

        // heurística do nome: maior fonte da página
        let largest: Line | null = null;
        for (const l of lines) {
          if (!largest || l.fontSize > largest.fontSize) largest = l;
        }
        const name = (profile.personal || {}).name || '';
        if (largest && name) {
          const score = fieldScore(largest.str, name);
          if (score >= 0.45) {
            largest.items.forEach((it) => { it.fieldId = 'personal.name'; });
          }
        }

        for (const l of lines) {
          const withField = l.items.find((it) => it.fieldId);
          if (withField) {
            l.items.forEach((it) => { if (!it.fieldId) it.fieldId = withField.fieldId; });
          } else {
            const f = bestField(l.str, fields);
            if (f) l.items.forEach((it) => { if (!it.fieldId) it.fieldId = f.id; });
          }
        }

        if (!cancelled) {
          setItems(raw);
          setLoading(false);
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
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* já terminou */ }
        renderTaskRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl, scale, profile]);

  const openField = (item: RawItem) => {
    if (!item.fieldId) return;
    const field = fieldMap.find((f) => f.id === item.fieldId);
    if (!field) return;
    setSelected(field);
    setValue(field.value);
  };

  const save = () => {
    if (!selected) return;
    onEditField(selected.id, value, selected.value);
    setSelected(null);
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-auto bg-wash p-6">
      <div className="mx-auto w-fit bg-white shadow-mac">
        <div className="relative" style={{ width: canvasSize.width, height: canvasSize.height }}>
          <div ref={hostRef} />
          <div className="absolute inset-0">
            {items.map((item, index) =>
              item.fieldId ? (
                <button
                  key={index}
                  type="button"
                  onClick={() => openField(item)}
                  onMouseEnter={() => setHovered(item.fieldId || null)}
                  onMouseLeave={() => setHovered(null)}
                  title={`Editar: ${fieldMap.find((f) => f.id === item.fieldId)?.label || ''}`}
                  aria-label="Editar campo do currículo"
                  className={`absolute whitespace-pre text-left ${
                    hovered === item.fieldId ? 'bg-brand/30' : 'bg-transparent hover:bg-brand/30'
                  }`}
                  style={{
                    left: item.left,
                    top: item.top,
                    width: Math.max(8, item.width),
                    height: Math.max(8, item.fontSize),
                    fontSize: item.fontSize,
                    lineHeight: 1,
                    color: 'transparent',
                    padding: 0,
                    margin: 0,
                    border: 0,
                  }}
                >
                  {item.str}
                </button>
              ) : (
                <span
                  key={index}
                  className="absolute whitespace-pre"
                  style={{
                    left: item.left,
                    top: item.top,
                    fontSize: item.fontSize,
                    lineHeight: 1,
                    color: 'transparent',
                    pointerEvents: 'none',
                  }}
                >
                  {item.str}
                </span>
              ),
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white text-xs text-muted">
          Carregando PDF…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white p-6 text-center text-xs text-danger">
          {error}
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border border-line bg-white px-2 py-1 shadow-mac">
        <button
          type="button"
          onClick={() => {
            userZoomRef.current = true;
            setScale((s) => Math.max(0.35, Number((s - 0.1).toFixed(2))));
          }}
          className="rounded-full px-2 text-xs text-muted hover:text-black"
        >
          −
        </button>
        <span className="text-2xs text-muted">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          onClick={() => {
            userZoomRef.current = true;
            setScale((s) => Math.min(2.5, Number((s + 0.1).toFixed(2))));
          }}
          className="rounded-full px-2 text-xs text-muted hover:text-black"
        >
          +
        </button>
      </div>

      {selected && (
        <div className="fixed bottom-4 left-1/2 z-30 w-full max-w-md -translate-x-1/2 rounded-xl border border-line bg-white p-4 shadow-mac">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-2xs font-semibold uppercase tracking-wide text-muted">
              {selected.label}
            </span>
            <button
              type="button"
              aria-label="Fechar editor"
              onClick={() => setSelected(null)}
              className="text-muted hover:text-black"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            rows={3}
            className="brutal-input leading-relaxed"
          />
          <div className="mt-2 flex justify-end gap-2">
            {onOpenCode && (
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  onOpenCode();
                }}
                className="brutal-btn mr-auto px-3 py-1.5 text-2xs"
              >
                Ver código
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="brutal-btn px-3 py-1.5 text-2xs"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              className="brutal-btn-yellow px-3 py-1.5 text-2xs"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}