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
  onEditField: (fieldId: string, value: string) => void;
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
  const p = profile.personal;
  fields.push(
    { id: 'personal.name', label: 'Nome', value: p.name },
    { id: 'personal.email', label: 'E-mail', value: p.email },
    { id: 'personal.phone', label: 'Telefone', value: p.phone },
    { id: 'personal.location', label: 'Localização', value: p.location },
    { id: 'personal.linkedin', label: 'LinkedIn', value: p.linkedin },
    { id: 'personal.github', label: 'GitHub', value: p.github },
    { id: 'personal.portfolio', label: 'Portfólio', value: p.portfolio },
    { id: 'summary', label: 'Resumo', value: profile.summary },
  );
  profile.experience.forEach((exp, i) => {
    fields.push(
      { id: `experience.${i}.title`, label: `Experiência ${i + 1}: cargo`, value: exp.title },
      { id: `experience.${i}.company`, label: `Experiência ${i + 1}: empresa`, value: exp.company },
      { id: `experience.${i}.period`, label: `Experiência ${i + 1}: período`, value: exp.period || '' },
      { id: `experience.${i}.location`, label: `Experiência ${i + 1}: local`, value: exp.location || '' },
    );
    exp.description.forEach((bullet, j) => {
      fields.push({
        id: `experience.${i}.description.${j}`,
        label: `Experiência ${i + 1}: bullet ${j + 1}`,
        value: bullet,
      });
    });
  });
  (profile.leadership || []).forEach((lead, i) => {
    fields.push(
      { id: `leadership.${i}.title`, label: `Liderança ${i + 1}: cargo`, value: lead.title },
      { id: `leadership.${i}.company`, label: `Liderança ${i + 1}: organização`, value: lead.company },
      { id: `leadership.${i}.period`, label: `Liderança ${i + 1}: período`, value: lead.period || '' },
    );
    lead.description.forEach((bullet, j) => {
      fields.push({
        id: `leadership.${i}.description.${j}`,
        label: `Liderança ${i + 1}: bullet ${j + 1}`,
        value: bullet,
      });
    });
  });
  profile.education.forEach((edu, i) => {
    fields.push(
      { id: `education.${i}.institution`, label: `Formação ${i + 1}: instituição`, value: edu.institution },
      { id: `education.${i}.degree`, label: `Formação ${i + 1}: curso`, value: edu.degree || '' },
      { id: `education.${i}.year`, label: `Formação ${i + 1}: ano`, value: edu.year || '' },
    );
  });
  profile.skills.forEach((skill, i) => {
    fields.push({ id: `skills.${i}`, label: `Habilidade ${i + 1}`, value: skill });
  });
  (profile.projects || []).forEach((project, i) => {
    fields.push({ id: `projects.${i}.name`, label: `Projeto ${i + 1}`, value: project.name });
  });
  (profile.certifications || []).forEach((cert, i) => {
    fields.push({
      id: `certifications.${i}`,
      label: `Certificação ${i + 1}`,
      value: typeof cert === 'string' ? cert : cert.name,
    });
  });
  (profile.languages || []).forEach((lang, i) => {
    fields.push({ id: `languages.${i}.name`, label: `Idioma ${i + 1}`, value: lang.name });
  });
  return fields.filter((field) => field.value && field.value.trim().length > 1);
}

export function PdfViewer({ pdfUrl, profile, onEditField }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Field | null>(null);
  const [value, setValue] = useState('');
  const [textItems, setTextItems] = useState<
    Array<{ str: string; left: number; top: number; fontSize: number; width: number; fieldId?: string }>
  >([]);
  const [scale, setScale] = useState(1.5);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setSelected(null);

    const load = async () => {
      try {
        const task = pdfjs.getDocument({ url: pdfUrl });
        const pdf = await task.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (cancelled) return;

        const textContent = await page.getTextContent();
        const fields = buildFields(profile);
        const items = textContent.items
          .filter(
            (item): item is typeof item & { str: string; transform: number[]; width: number } =>
              'str' in item && 'width' in item,
          )
          .map((item) => {
            const fontSize = Math.hypot(item.transform[0], item.transform[1]) || 12;
            const normalized = normalize(item.str);
            const match = fields
              .filter((field) => {
                const fieldNorm = normalize(field.value);
                return fieldNorm.length > 2 && normalized.length > 2
                  ? fieldNorm.includes(normalized) || normalized.includes(fieldNorm)
                  : false;
              })
                .sort((a, b) => b.value.length - a.value.length)[0];
            return {
              str: item.str,
              left: item.transform[4],
              top: item.transform[5] - fontSize,
              fontSize,
              width: item.width,
              fieldId: match?.id,
            };
          });
        setTextItems(items);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Não abri o PDF.');
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks react-hooks/exhaustive-deps
  }, [pdfUrl, scale, profile]);

  const save = () => {
    if (!selected) return;
    onEditField(selected.id, value);
    setSelected(null);
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-auto bg-wash p-6">
      <div className="mx-auto w-fit bg-white shadow-mac">
        <div className="relative" style={{ width: canvasRef.current?.width || 794 }}>
          <canvas ref={canvasRef} className="block" />
          <div className="absolute inset-0">
            {textItems.map((item, index) => (
              <span
                key={index}
                onClick={() => {
                  if (!item.fieldId) return;
                  const field = buildFields(profile).find((f) => f.id === item.fieldId);
                  if (field) {
                    setSelected(field);
                    setValue(field.value);
                  }
                }}
                className={`absolute whitespace-pre ${
                  item.fieldId ? 'cursor-pointer hover:bg-brand/40' : ''
                }`}
                style={{
                  left: item.left,
                  top: item.top,
                  fontSize: item.fontSize,
                  color: 'transparent',
                  lineHeight: 1,
                }}
              >
                {item.str}
              </span>
            ))}
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
          onClick={() => setScale((s) => Math.max(1, Number((s - 0.1).toFixed(1))))}
          className="rounded-full px-2 text-xs text-muted hover:text-black"
        >
          −
        </button>
        <span className="text-2xs text-muted">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(2.5, Number((s + 0.1).toFixed(1))))}
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