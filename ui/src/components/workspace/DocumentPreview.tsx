import { useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent } from 'react';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import type { CandidateProfile, ResumeLayoutSection } from '../../services/api';
import {
  getLayout,
  reorderSection,
  sectionTitle,
  type Selection,
} from './document';

interface DocumentPreviewProps {
  profile: CandidateProfile;
  zoom: number;
  selected: Selection | null;
  onSelect: (selection: Selection | null) => void;
  onChange: (profile: CandidateProfile) => void;
}

function commitText(
  current: string,
  apply: (value: string) => void,
  onDone?: () => void,
) {
  return (event: FocusEvent<HTMLElement>) => {
    const value = event.currentTarget.innerText.trim();
    if (value === current) return;
    apply(value);
    onDone?.();
  };
}

export function DocumentPreview({
  profile,
  zoom,
  selected,
  onSelect,
  onChange,
}: DocumentPreviewProps) {
  const layout = getLayout(profile);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [dragged, setDragged] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggedExp, setDraggedExp] = useState<number | null>(null);
  const [dragOverExp, setDragOverExp] = useState<number | null>(null);
  const [draggedEdu, setDraggedEdu] = useState<number | null>(null);
  const [dragOverEdu, setDragOverEdu] = useState<number | null>(null);
  const [draggedSkill, setDraggedSkill] = useState<number | null>(null);
  const [dragOverSkill, setDragOverSkill] = useState<number | null>(null);
  const [pageBreaks, setPageBreaks] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const pages = pageBreaks.length + 1;

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const measure = () => {
      const contentTop = content.getBoundingClientRect().top;
      const pageHeight = 1011; // 1123 - 2 * 56
      let pageStart = 0;
      const breaks: number[] = [];

      for (const section of layout.sections.filter((s) => s.visible)) {
        const element = sectionRefs.current[section.id];
        if (!element) continue;
        const top = element.getBoundingClientRect().top - contentTop;
        const height = element.offsetHeight;
        if (top + height > pageStart + pageHeight && top > pageStart) {
          breaks.push(top);
          pageStart = top;
        }
      }

      setPageBreaks(breaks);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [profile, layout]);

  const goToPage = (target: number) => {
    const next = Math.min(pages, Math.max(1, target));
    setPage(next);
    const top = next === 1 ? 0 : 24 + (56 + pageBreaks[next - 2]) * zoom;
    scrollRef.current?.scrollTo({ top, behavior: 'smooth' });
  };

  const onScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const top = (element.scrollTop - 24) / zoom - 56;
    let next = 1;
    pageBreaks.forEach((offset, index) => {
      if (top >= offset) next = index + 2;
    });
    if (next !== page) setPage(next);
  };

  const updatePersonal = (field: keyof CandidateProfile['personal'], value: string) => {
    onChange({ ...profile, personal: { ...profile.personal, [field]: value } });
  };

  const contactItems = [
    { key: 'email', value: profile.personal.email },
    { key: 'phone', value: profile.personal.phone },
    { key: 'location', value: profile.personal.location },
    { key: 'linkedin', value: profile.personal.linkedin },
    { key: 'github', value: profile.personal.github },
    { key: 'portfolio', value: profile.personal.portfolio },
  ].filter((item) => item.value);

  const updateSummary = (value: string) => onChange({ ...profile, summary: value });

  const updateExperience = (
    expIdx: number,
    patch: Partial<CandidateProfile['experience'][number]>,
  ) => {
    onChange({
      ...profile,
      experience: profile.experience.map((exp, i) => (i === expIdx ? { ...exp, ...patch } : exp)),
    });
  };

  const updateBullet = (expIdx: number, bulletIdx: number, value: string) => {
    const exp = profile.experience[expIdx];
    const description = exp.description.map((b, i) => (i === bulletIdx ? value : b));
    updateExperience(expIdx, { description });
  };

  const updateEducation = (
    eduIdx: number,
    patch: Partial<CandidateProfile['education'][number]>,
  ) => {
    onChange({
      ...profile,
      education: profile.education.map((edu, i) => (i === eduIdx ? { ...edu, ...patch } : edu)),
    });
  };

  const reorderExperience = (from: number, to: number) => {
    if (from === to) return;
    const list = [...profile.experience];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    onChange({ ...profile, experience: list });
  };

  const reorderEducation = (from: number, to: number) => {
    if (from === to) return;
    const list = [...profile.education];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    onChange({ ...profile, education: list });
  };

  const reorderSkill = (from: number, to: number) => {
    if (from === to) return;
    const list = [...profile.skills];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    onChange({ ...profile, skills: list });
  };

  const renderSection = (section: ResumeLayoutSection) => {
    const isSelected = selected?.sectionId === section.id;
    const ring = isSelected ? 'ring-1 ring-brand ring-offset-4 ring-offset-white' : '';
    const title = sectionTitle(section);
    const sectionStyle: CSSProperties = {
      textAlign: section.style?.align || 'left',
      fontSize:
        section.style?.fontSize === 'sm'
          ? '12px'
          : section.style?.fontSize === 'lg'
            ? '14px'
            : '13px',
      fontWeight: section.style?.weight === 'semibold' ? 600 : 400,
    };

    return (
      <section
        key={section.id}
        ref={(element) => {
          sectionRefs.current[section.id] = element;
        }}
        onClick={() => onSelect({ sectionId: section.id })}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(section.id);
        }}
        onDragLeave={() => setDragOver(null)}
        onDrop={(event) => {
          event.preventDefault();
          if (dragged) {
            onChange({ ...profile, layout: reorderSection(layout, dragged, section.id) });
          }
          setDragged(null);
          setDragOver(null);
        }}
        style={sectionStyle}
        className={`relative -mx-3 cursor-text px-3 py-2 transition-shadow ${
          dragOver === section.id ? 'ring-2 ring-brand' : ring
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-line pb-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                setDragged(section.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => setDragged(null)}
              aria-label="Arrastar seção"
              title="Arrastar seção"
              className="cursor-grab text-subtle hover:text-black"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <h2 className="text-[16px] font-bold text-ink">{title}</h2>
          </div>
        </div>

        {section.type === 'summary' && (
          <p
            contentEditable
            suppressContentEditableWarning
            onBlur={commitText(profile.summary, updateSummary)}
            className="min-h-10 whitespace-pre-wrap text-inherit leading-relaxed text-ink outline-none"
          >
            {profile.summary || 'Clique para escrever o resumo.'}
          </p>
        )}

        {section.type === 'experience' && (
          <div className="flex flex-col gap-3">
            {profile.experience.length === 0 && (
              <p className="text-[12px] text-subtle">Nenhuma experiência. Adicione no inspetor.</p>
            )}
            {profile.experience.map((exp, expIdx) => (
              <div
                key={expIdx}
                className={`break-inside-avoid ${dragOverExp === expIdx ? 'ring-1 ring-brand' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverExp(expIdx);
                }}
                onDragLeave={() => setDragOverExp(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedExp !== null) reorderExperience(draggedExp, expIdx);
                  setDraggedExp(null);
                  setDragOverExp(null);
                }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-2">
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        setDraggedExp(expIdx);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => setDraggedExp(null)}
                      aria-label="Arrastar experiência"
                      title="Arrastar experiência"
                      className="cursor-grab text-subtle hover:text-black"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>
                    <div className="text-inherit font-semibold text-ink">
                      <span
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={commitText(exp.title, (title) => updateExperience(expIdx, { title }))}
                        className="outline-none"
                      >
                        {exp.title || 'Cargo'}
                      </span>
                      {exp.company && (
                        <span className="font-normal italic text-muted"> · {exp.company}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-[11px] italic text-muted">
                    {exp.period}
                    {exp.location ? ` · ${exp.location}` : ''}
                  </div>
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-inherit leading-relaxed text-ink">
                  {exp.description.map((bullet, bulletIdx) => (
                    <li
                      key={bulletIdx}
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={commitText(bullet, (value) => updateBullet(expIdx, bulletIdx, value))}
                      className="outline-none"
                    >
                      {bullet || 'Descreva o resultado.'}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {section.type === 'leadership' && (
          <div className="flex flex-col gap-2">
            {(profile.leadership || []).map((lead, leadIdx) => (
              <div key={leadIdx} className="text-inherit leading-relaxed">
                <div className="font-semibold">{lead.title || 'Liderança'}</div>
                <div className="text-muted">
                  {lead.company}
                  {lead.period ? ` · ${lead.period}` : ''}
                </div>
                <ul className="mt-1 list-disc pl-5">
                  {lead.description.map((bullet, i) => (
                    <li key={i}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {section.type === 'projects' && (
          <div className="flex flex-col gap-2">
            {(profile.projects || []).map((project, projectIdx) => (
              <div key={projectIdx} className="text-inherit leading-relaxed">
                <div className="font-semibold">{project.name || 'Projeto'}</div>
                <div className="text-muted">
                  {project.role}
                  {project.period ? ` · ${project.period}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {section.type === 'education' && (
          <div className="flex flex-col gap-2">
            {profile.education.length === 0 && (
              <p className="text-[12px] text-subtle">Nenhuma formação. Adicione no inspetor.</p>
            )}
            {profile.education.map((edu, eduIdx) => (
              <div
                key={eduIdx}
                className={`text-inherit leading-relaxed ${
                  dragOverEdu === eduIdx ? 'ring-1 ring-brand' : ''
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverEdu(eduIdx);
                }}
                onDragLeave={() => setDragOverEdu(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedEdu !== null) reorderEducation(draggedEdu, eduIdx);
                  setDraggedEdu(null);
                  setDragOverEdu(null);
                }}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      setDraggedEdu(eduIdx);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => setDraggedEdu(null)}
                    aria-label="Arrastar formação"
                    title="Arrastar formação"
                    className="cursor-grab text-subtle hover:text-black"
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                  <div className="font-semibold">
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={commitText(edu.institution, (institution) =>
                        updateEducation(eduIdx, { institution }),
                      )}
                      className="outline-none"
                    >
                      {edu.institution || 'Instituição'}
                    </span>
                  </div>
                </div>
                <div className="text-muted">
                  {edu.degree}
                  {edu.year ? ` · ${edu.year}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {section.type === 'skills' && (
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((skill, skillIdx) => (
              <span
                key={`${skill}-${skillIdx}`}
                draggable
                onDragStart={(event) => {
                  setDraggedSkill(skillIdx);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => setDraggedSkill(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOverSkill(skillIdx);
                }}
                onDragLeave={() => setDragOverSkill(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedSkill !== null) reorderSkill(draggedSkill, skillIdx);
                  setDraggedSkill(null);
                  setDragOverSkill(null);
                }}
                className={`brutal-tag cursor-grab ${
                  dragOverSkill === skillIdx ? 'ring-1 ring-brand' : ''
                }`}
              >
                {skill}
              </span>
            ))}
            {profile.skills.length === 0 && (
              <p className="text-[12px] text-subtle">Nenhuma habilidade.</p>
            )}
          </div>
        )}

        {section.type === 'certifications' && (
          <div className="flex flex-col gap-1 text-inherit">
            {(profile.certifications || []).map((cert, i) => (
              <div key={i}>{typeof cert === 'string' ? cert : cert.name}</div>
            ))}
          </div>
        )}

        {section.type === 'languages' && (
          <div className="flex flex-col gap-1 text-inherit">
            {(profile.languages || []).map((lang, i) => (
              <div key={i}>
                {lang.name}
                {lang.level ? ` · ${lang.level}` : ''}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="h-full min-h-0 overflow-auto bg-wash px-6 py-6"
    >
      <div
        className="relative mx-auto bg-white shadow-mac"
        style={{
          width: 794,
          minHeight: 1123,
          transform: `scale(${zoom})`,
          transformOrigin: 'top center',
          padding: 56,
          marginBottom: 64,
        }}
      >
        {pageBreaks.map((offset, index) => (
          <div
            key={index}
            className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-line"
            style={{ top: 56 + offset }}
            aria-hidden="true"
          />
        ))}

        <header
          className="mb-8 cursor-text border-b border-line pb-4"
          onClick={() => onSelect({ sectionId: 'header' })}
        >
          <h1
            contentEditable
            suppressContentEditableWarning
            onBlur={commitText(profile.personal.name, (name) => updatePersonal('name', name))}
            className="text-[24px] font-bold leading-tight tracking-tight text-ink outline-none"
          >
            {profile.personal.name || 'Seu nome'}
          </h1>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            {contactItems.length === 0 && 'email · telefone · cidade · linkedin'}
            {contactItems.map((item, index) => (
              <span key={item.key}>
                {index > 0 && ' · '}
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={commitText(item.value, (value) =>
                    updatePersonal(item.key as keyof CandidateProfile['personal'], value),
                  )}
                  className="outline-none"
                >
                  {item.value}
                </span>
              </span>
            ))}
          </p>
        </header>

        <div ref={contentRef} className="flex flex-col gap-6">
          {layout.sections.filter((s) => s.visible).map(renderSection)}
        </div>
      </div>

      <div
        className="fixed bottom-4 z-30 flex items-center gap-1 rounded-full border border-line bg-white px-2 py-1 shadow-mac"
        style={{ right: 'var(--panel-offset, 16px)' }}
      >
        <button
          type="button"
          aria-label="Página anterior"
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1}
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-wash hover:text-black disabled:opacity-30"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-10 text-center text-2xs text-muted">
          {page} / {pages}
        </span>
        <button
          type="button"
          aria-label="Próxima página"
          onClick={() => goToPage(page + 1)}
          disabled={page >= pages}
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-wash hover:text-black disabled:opacity-30"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}