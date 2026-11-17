import type { CSSProperties, FocusEvent } from 'react';
import type { CandidateProfile, ResumeLayoutSection } from '../../services/api';
import {
  getLayout,
  sectionTitle,
  type Selection,
} from './document';

interface DocumentPreviewProps {
  profile: CandidateProfile;
  jobTitle: string;
  company: string;
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
  jobTitle,
  company,
  zoom,
  selected,
  onSelect,
  onChange,
}: DocumentPreviewProps) {
  const layout = getLayout(profile);

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
        onClick={() => onSelect({ sectionId: section.id })}
        style={sectionStyle}
        className={`relative -mx-3 cursor-text px-3 py-2 transition-shadow ${ring}`}
      >
        <h2 className="mb-2 border-b border-line pb-1 text-[15px] font-bold text-ink">
          {title}
        </h2>

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
              <div key={expIdx} className="break-inside-avoid">
                <div className="flex items-baseline justify-between gap-3">
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
                      <span className="font-normal text-muted"> · {exp.company}</span>
                    )}
                  </div>
                  <div className="shrink-0 text-[11px] text-muted">
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
              <div key={eduIdx} className="text-inherit leading-relaxed">
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
            {profile.skills.map((skill) => (
              <span key={skill} className="brutal-tag">
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
    <div className="h-full min-h-0 overflow-auto bg-wash px-6 py-6">
      <div
        className="mx-auto bg-white shadow-mac"
        style={{
          width: 794,
          minHeight: 1123,
          transform: `scale(${zoom})`,
          transformOrigin: 'top center',
          padding: 56,
          marginBottom: 64,
        }}
      >
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
          <div className="mt-2 text-[10px] uppercase tracking-wide text-subtle">
            {jobTitle}
            {company ? ` · ${company}` : ''}
          </div>
        </header>

        <div className="flex flex-col gap-6">
          {layout.sections.filter((s) => s.visible).map(renderSection)}
        </div>
      </div>
    </div>
  );
}