import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { CandidateProfile } from '../../services/api';

interface VisualEditorProps {
  profile: CandidateProfile;
  onChange: (profile: CandidateProfile) => void;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-2xs font-bold uppercase tracking-wider text-muted">{label}</span>
      {rows ? (
        <textarea
          rows={rows}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="brutal-input leading-relaxed"
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="brutal-input"
        />
      )}
    </label>
  );
}

function Section({
  title,
  count,
  onAdd,
  addLabel,
  children,
  id,
}: {
  title: string;
  count?: number;
  onAdd?: () => void;
  addLabel?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="space-y-3 scroll-mt-4" id={id} data-section={id}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-2xs font-bold uppercase tracking-wider text-muted">
          {title}
          {count != null && <span className="ml-2 text-subtle">({count})</span>}
        </h3>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 text-11 font-bold underline underline-offset-4 hover:bg-black hover:text-white"
          >
            <Plus className="h-3 w-3" />
            {addLabel || 'adicionar'}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Bullets({
  bullets,
  onChange,
  placeholder,
}: {
  bullets: string[];
  onChange: (bullets: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      {bullets.map((bullet, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="mt-2.5 text-xs font-bold">•</span>
          <textarea
            rows={2}
            value={bullet}
            onChange={(e) => {
              const next = [...bullets];
              next[index] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
            className="brutal-input flex-1 leading-relaxed"
          />
          <button
            type="button"
            title="Remover item"
            onClick={() => onChange(bullets.filter((_, i) => i !== index))}
            className="brutal-btn p-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...bullets, ''])}
        className="text-11 font-bold underline underline-offset-4 hover:bg-black hover:text-white"
      >
        + adicionar item
      </button>
    </div>
  );
}

export function VisualEditor({ profile, onChange }: VisualEditorProps) {
  const set = (patch: Partial<CandidateProfile>) => onChange({ ...profile, ...patch });
  const personal = profile.personal || ({} as CandidateProfile['personal']);
  const setPersonal = (key: keyof CandidateProfile['personal'], value: string) =>
    set({ personal: { ...personal, [key]: value } });

  const experience = profile.experience || [];
  const leadership = profile.leadership || [];
  const education = profile.education || [];
  const projects = profile.projects || [];
  const certifications = profile.certifications || [];
  const languages = profile.languages || [];

  const updateExperience = (index: number, patch: Partial<Experience>) => {
    const next = experience.map((exp, i) => (i === index ? { ...exp, ...patch } : exp));
    set({ experience: next });
  };
  const updateLeadership = (index: number, patch: Partial<Experience>) => {
    const next = leadership.map((lead, i) => (i === index ? { ...lead, ...patch } : lead));
    set({ leadership: next });
  };

  return (
    <div className="h-full overflow-y-auto bg-white p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-8 pb-10">
        <div className="space-y-2" id="section-personal" data-section="personal">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted">Dados pessoais</span>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Nome" value={personal.name} onChange={(v) => setPersonal('name', v)} />
            <Field label="E-mail" value={personal.email} onChange={(v) => setPersonal('email', v)} />
            <Field label="Telefone" value={personal.phone} onChange={(v) => setPersonal('phone', v)} />
            <Field label="Localização" value={personal.location} onChange={(v) => setPersonal('location', v)} />
            <Field label="LinkedIn" value={personal.linkedin} onChange={(v) => setPersonal('linkedin', v)} />
            <Field label="GitHub" value={personal.github} onChange={(v) => setPersonal('github', v)} />
            <div className="md:col-span-2">
              <Field label="Portfólio" value={personal.portfolio} onChange={(v) => setPersonal('portfolio', v)} />
            </div>
          </div>
        </div>

        <div className="space-y-2" id="section-summary" data-section="summary">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted">Resumo</span>
          <Field label="Resumo profissional" value={profile.summary} onChange={(v) => set({ summary: v })} rows={4} />
        </div>

        <Section
          title="Experiência"
          id="section-experience"
          count={experience.length}
          onAdd={() =>
            set({
              experience: [...experience, { title: '', company: '', period: '', location: '', description: [''] }],
            })
          }
        >
          {experience.map((exp, index) => (
            <div key={index} className="brutal-card space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold">
                  {exp.title || 'Novo cargo'}
                  {exp.company && <span className="ml-2 font-medium text-muted">na {exp.company}</span>}
                </div>
                <button
                  type="button"
                  title="Remover experiência"
                  onClick={() => set({ experience: experience.filter((_, i) => i !== index) })}
                  className="brutal-btn p-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Field label="Cargo" value={exp.title} onChange={(v) => updateExperience(index, { title: v })} />
                <Field label="Empresa" value={exp.company} onChange={(v) => updateExperience(index, { company: v })} />
                <Field label="Período" value={exp.period || ''} onChange={(v) => updateExperience(index, { period: v })} />
                <Field label="Local" value={exp.location || ''} onChange={(v) => updateExperience(index, { location: v })} />
              </div>
              <Bullets
                bullets={exp.description || []}
                onChange={(description) => updateExperience(index, { description })}
                placeholder="O que você fez e o resultado"
              />
            </div>
          ))}
        </Section>

        <Section
          title="Liderança e atividades"
          id="section-leadership"
          count={leadership.length}
          onAdd={() =>
            set({
              leadership: [...leadership, { title: '', company: '', period: '', location: '', description: [''] }],
            })
          }
        >
          {leadership.map((lead, index) => (
            <div key={index} className="brutal-card space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold">
                  {lead.title || 'Nova atividade'}
                  {lead.company && <span className="ml-2 font-medium text-muted">na {lead.company}</span>}
                </div>
                <button
                  type="button"
                  title="Remover atividade"
                  onClick={() => set({ leadership: leadership.filter((_, i) => i !== index) })}
                  className="brutal-btn p-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Field label="Cargo" value={lead.title} onChange={(v) => updateLeadership(index, { title: v })} />
                <Field label="Organização" value={lead.company} onChange={(v) => updateLeadership(index, { company: v })} />
                <Field label="Período" value={lead.period || ''} onChange={(v) => updateLeadership(index, { period: v })} />
                <Field label="Local" value={lead.location || ''} onChange={(v) => updateLeadership(index, { location: v })} />
              </div>
              <Bullets
                bullets={lead.description || []}
                onChange={(description) => updateLeadership(index, { description })}
                placeholder="O que você organizou e o resultado"
              />
            </div>
          ))}
        </Section>

        <Section
          title="Formação"
          id="section-education"
          count={education.length}
          onAdd={() => set({ education: [...education, { institution: '', degree: '', year: '', location: '' }] })
          }
        >
          {education.map((edu, index) => (
            <div key={index} className="brutal-card space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold">{edu.institution || 'Nova formação'}</div>
                <button
                  type="button"
                  title="Remover formação"
                  onClick={() => set({ education: education.filter((_, i) => i !== index) })}
                  className="brutal-btn p-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Field
                  label="Instituição"
                  value={edu.institution}
                  onChange={(v) => {
                    const next = [...education];
                    next[index] = { ...next[index], institution: v };
                    set({ education: next });
                  }}
                />
                <Field
                  label="Curso"
                  value={edu.degree || ''}
                  onChange={(v) => {
                    const next = [...education];
                    next[index] = { ...next[index], degree: v };
                    set({ education: next });
                  }}
                />
                <Field
                  label="Ano"
                  value={edu.year || ''}
                  onChange={(v) => {
                    const next = [...education];
                    next[index] = { ...next[index], year: v };
                    set({ education: next });
                  }}
                />
                <Field
                  label="Local"
                  value={edu.location || ''}
                  onChange={(v) => {
                    const next = [...education];
                    next[index] = { ...next[index], location: v };
                    set({ education: next });
                  }}
                />
              </div>
            </div>
          ))}
        </Section>

        <div className="space-y-2" id="section-skills" data-section="skills">
          <span className="text-2xs font-bold uppercase tracking-wider text-muted">Habilidades</span>
          <div className="flex flex-wrap gap-1.5">
            {(profile.skills || []).map((skill, index) => (
              <span key={`${skill}-${index}`} className="brutal-tag">
                {skill}
                <button
                  type="button"
                  onClick={() =>
                    set({ skills: (profile.skills || []).filter((_, i) => i !== index) })
                  }
                  className="ml-1 font-bold hover:bg-black hover:text-white"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Digite uma habilidade e pressione Enter"
            className="brutal-input"
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              const value = (e.target as HTMLInputElement).value.trim();
              if (!value) return;
              if (!(profile.skills || []).includes(value)) {
                set({ skills: [...(profile.skills || []), value] });
              }
              (e.target as HTMLInputElement).value = '';
            }}
          />
        </div>

        <Section
          title="Projetos"
          id="section-projects"
          count={projects.length}
          onAdd={() =>
            set({
              projects: [...projects, { name: '', role: '', period: '', location: '', description: [''] }],
            })
          }
        >
          {projects.map((project, index) => (
            <div key={index} className="brutal-card space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold">{project.name || 'Novo projeto'}</div>
                <button
                  type="button"
                  title="Remover projeto"
                  onClick={() => set({ projects: projects.filter((_, i) => i !== index) })}
                  className="brutal-btn p-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Field
                  label="Nome"
                  value={project.name}
                  onChange={(v) => {
                    const next = [...projects];
                    next[index] = { ...next[index], name: v };
                    set({ projects: next });
                  }}
                />
                <Field
                  label="Papel"
                  value={project.role || ''}
                  onChange={(v) => {
                    const next = [...projects];
                    next[index] = { ...next[index], role: v };
                    set({ projects: next });
                  }}
                />
                <Field
                  label="Período"
                  value={project.period || ''}
                  onChange={(v) => {
                    const next = [...projects];
                    next[index] = { ...next[index], period: v };
                    set({ projects: next });
                  }}
                />
                <Field
                  label="Local"
                  value={project.location || ''}
                  onChange={(v) => {
                    const next = [...projects];
                    next[index] = { ...next[index], location: v };
                    set({ projects: next });
                  }}
                />
              </div>
              <Bullets
                bullets={
                  Array.isArray(project.description)
                    ? project.description.map(String)
                    : project.description
                      ? [String(project.description)]
                      : ['']
                }
                onChange={(description) => {
                  const next = [...projects];
                  next[index] = { ...next[index], description };
                  set({ projects: next });
                }}
                placeholder="O que o projeto faz e o resultado"
              />
            </div>
          ))}
        </Section>

        <Section
          title="Certificações"
          id="section-certifications"
          count={certifications.length}
          onAdd={() => set({ certifications: [...certifications, { name: '' }] })}
        >
          {certifications.map((cert, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={cert.name}
                onChange={(e) => {
                  const next = [...certifications];
                  next[index] = { name: e.target.value };
                  set({ certifications: next });
                }}
                placeholder="Nome da certificação"
                className="brutal-input"
              />
              <button
                type="button"
                title="Remover certificação"
                onClick={() => set({ certifications: certifications.filter((_, i) => i !== index) })}
                className="brutal-btn p-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </Section>

        <Section
          title="Idiomas"
          id="section-languages"
          count={languages.length}
          onAdd={() => set({ languages: [...languages, { name: '', level: '' }] })}
        >
          {languages.map((lang, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={lang.name}
                onChange={(e) => {
                  const next = [...languages];
                  next[index] = { ...next[index], name: e.target.value };
                  set({ languages: next });
                }}
                placeholder="Idioma"
                className="brutal-input"
              />
              <input
                type="text"
                value={lang.level || ''}
                onChange={(e) => {
                  const next = [...languages];
                  next[index] = { ...next[index], level: e.target.value };
                  set({ languages: next });
                }}
                placeholder="Nível"
                className="brutal-input"
              />
              <button
                type="button"
                title="Remover idioma"
                onClick={() => set({ languages: languages.filter((_, i) => i !== index) })}
                className="brutal-btn p-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </Section>
      </div>
    </div>
  );
}

interface Experience {
  title: string;
  company: string;
  period?: string;
  location?: string;
  description: string[];
}