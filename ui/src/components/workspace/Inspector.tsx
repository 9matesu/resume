import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { CandidateProfile } from '../../services/api';
import {
  addEducation,
  addExperience,
  addSkill,
  getLayout,
  moveSection,
  sectionTitle,
  updateSection,
  type ResumeVersion,
  type Selection,
} from './document';

interface InspectorProps {
  profile: CandidateProfile;
  selected: Selection | null;
  onChange: (profile: CandidateProfile) => void;
  versions: ResumeVersion[];
  onRestore: (version: ResumeVersion) => void;
  saveStatus: 'saved' | 'saving' | 'error';
}

export function Inspector({
  profile,
  selected,
  onChange,
  versions,
  onRestore,
  saveStatus,
}: InspectorProps) {
  const [newSkill, setNewSkill] = useState('');
  const layout = getLayout(profile);
  const section = selected ? layout.sections.find((s) => s.id === selected?.sectionId) : null;

  const updatePersonal = (field: keyof CandidateProfile['personal'], value: string) => {
    onChange({ ...profile, personal: { ...profile.personal, [field]: value } });
  };

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
    updateExperience(expIdx, {
      description: exp.description.map((b, i) => (i === bulletIdx ? value : b)),
    });
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

  const addBullet = (expIdx: number) => {
    const exp = profile.experience[expIdx];
    updateExperience(expIdx, { description: [...exp.description, ''] });
  };

  const removeBullet = (expIdx: number, bulletIdx: number) => {
    const exp = profile.experience[expIdx];
    updateExperience(expIdx, {
      description: exp.description.filter((_, i) => i !== bulletIdx),
    });
  };

  const addSkillValue = () => {
    const next = addSkill(profile, newSkill);
    if (next !== profile) {
      onChange(next);
      setNewSkill('');
    }
  };

  const renderSection = () => {
    if (!section) {
      return (
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted">
              Documento
            </div>
            <div className="flex flex-col gap-3">
              {(
                [
                  ['name', 'Nome'],
                  ['email', 'E-mail'],
                  ['phone', 'Telefone'],
                  ['location', 'Localização'],
                  ['linkedin', 'LinkedIn'],
                  ['github', 'GitHub'],
                  ['portfolio', 'Portfólio'],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="flex flex-col gap-1">
                  <span className="text-2xs text-muted">{label}</span>
                  <input
                    value={profile.personal[field]}
                    onChange={(e) => updatePersonal(field, e.target.value)}
                    className="brutal-input"
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted">
              Resumo
            </div>
            <textarea
              value={profile.summary}
              onChange={(e) => onChange({ ...profile, summary: e.target.value })}
              rows={5}
              className="brutal-input leading-relaxed"
            />
          </div>

          <Versions versions={versions} onRestore={onRestore} />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-5">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-2xs font-semibold uppercase tracking-wide text-muted">
              Seção
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Mover seção para cima"
                onClick={() =>
                  onChange({ ...profile, layout: moveSection(layout, section.id, -1) })
                }
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-wash hover:text-black"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Mover seção para baixo"
                onClick={() =>
                  onChange({ ...profile, layout: moveSection(layout, section.id, 1) })
                }
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-wash hover:text-black"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-2xs text-muted">Título</span>
            <input
              value={sectionTitle(section)}
              onChange={(e) =>
                onChange({
                  ...profile,
                  layout: updateSection(layout, section.id, { title: e.target.value }),
                })
              }
              className="brutal-input"
            />
          </label>

          <label className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted">Visível no documento</span>
            <input
              type="checkbox"
              checked={section.visible}
              onChange={(e) =>
                onChange({
                  ...profile,
                  layout: updateSection(layout, section.id, { visible: e.target.checked }),
                })
              }
              className="h-4 w-4 accent-black"
            />
          </label>

          <div className="mt-4">
            <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted">
              Formatação
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xs text-muted">Alinhamento</span>
                <div className="flex items-center gap-1">
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...profile,
                          layout: updateSection(layout, section.id, {
                            style: { ...section.style, align },
                          }),
                        })
                      }
                      className={`rounded-md px-2 py-1 text-2xs ${
                        (section.style?.align || 'left') === align
                          ? 'bg-black text-white'
                          : 'bg-wash text-muted hover:text-black'
                      }`}
                    >
                      {align === 'left' ? 'Esq' : align === 'center' ? 'Centro' : 'Dir'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-2xs text-muted">Tamanho</span>
                <div className="flex items-center gap-1">
                  {(['sm', 'md', 'lg'] as const).map((fontSize) => (
                    <button
                      key={fontSize}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...profile,
                          layout: updateSection(layout, section.id, {
                            style: { ...section.style, fontSize },
                          }),
                        })
                      }
                      className={`rounded-md px-2 py-1 text-2xs ${
                        (section.style?.fontSize || 'md') === fontSize
                          ? 'bg-black text-white'
                          : 'bg-wash text-muted hover:text-black'
                      }`}
                    >
                      {fontSize === 'sm' ? 'P' : fontSize === 'md' ? 'M' : 'G'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-2xs text-muted">Peso</span>
                <div className="flex items-center gap-1">
                  {(['normal', 'semibold'] as const).map((weight) => (
                    <button
                      key={weight}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...profile,
                          layout: updateSection(layout, section.id, {
                            style: { ...section.style, weight },
                          }),
                        })
                      }
                      className={`rounded-md px-2 py-1 text-2xs ${
                        (section.style?.weight || 'normal') === weight
                          ? 'bg-black text-white'
                          : 'bg-wash text-muted hover:text-black'
                      }`}
                    >
                      {weight === 'normal' ? 'Normal' : 'Semibold'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {section.type === 'summary' && (
          <textarea
            value={profile.summary}
            onChange={(e) => onChange({ ...profile, summary: e.target.value })}
            rows={7}
            className="brutal-input leading-relaxed"
          />
        )}

        {section.type === 'experience' && (
          <div className="flex flex-col gap-4">
            {profile.experience.map((exp, expIdx) => (
              <div key={expIdx} className="flex flex-col gap-2 border-b border-line pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-semibold uppercase tracking-wide text-muted">
                    Experiência {expIdx + 1}
                  </span>
                  <button
                    type="button"
                    aria-label="Remover experiência"
                    onClick={() =>
                      onChange({
                        ...profile,
                        experience: profile.experience.filter((_, i) => i !== expIdx),
                      })
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-wash hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  value={exp.title}
                  onChange={(e) => updateExperience(expIdx, { title: e.target.value })}
                  placeholder="Cargo"
                  className="brutal-input"
                />
                <input
                  value={exp.company}
                  onChange={(e) => updateExperience(expIdx, { company: e.target.value })}
                  placeholder="Empresa"
                  className="brutal-input"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={exp.period}
                    onChange={(e) => updateExperience(expIdx, { period: e.target.value })}
                    placeholder="Período"
                    className="brutal-input"
                  />
                  <input
                    value={exp.location || ''}
                    onChange={(e) => updateExperience(expIdx, { location: e.target.value })}
                    placeholder="Local"
                    className="brutal-input"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  {exp.description.map((bullet, bulletIdx) => (
                    <div key={bulletIdx} className="flex items-start gap-1.5">
                      <textarea
                        value={bullet}
                        onChange={(e) => updateBullet(expIdx, bulletIdx, e.target.value)}
                        rows={2}
                        className="brutal-input leading-relaxed"
                      />
                      <button
                        type="button"
                        aria-label="Remover bullet"
                        onClick={() => removeBullet(expIdx, bulletIdx)}
                        className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-wash hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addBullet(expIdx)}
                    className="brutal-btn mt-1 px-2 py-1 text-2xs"
                  >
                    Adicionar bullet
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange(addExperience(profile))}
              className="brutal-btn-yellow inline-flex items-center justify-center gap-1.5 px-3 py-2 text-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar experiência
            </button>
          </div>
        )}

        {section.type === 'education' && (
          <div className="flex flex-col gap-4">
            {profile.education.map((edu, eduIdx) => (
              <div key={eduIdx} className="flex flex-col gap-2 border-b border-line pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-semibold uppercase tracking-wide text-muted">
                    Formação {eduIdx + 1}
                  </span>
                  <button
                    type="button"
                    aria-label="Remover formação"
                    onClick={() =>
                      onChange({
                        ...profile,
                        education: profile.education.filter((_, i) => i !== eduIdx),
                      })
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-wash hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  value={edu.institution}
                  onChange={(e) => updateEducation(eduIdx, { institution: e.target.value })}
                  placeholder="Instituição"
                  className="brutal-input"
                />
                <input
                  value={edu.degree || ''}
                  onChange={(e) => updateEducation(eduIdx, { degree: e.target.value })}
                  placeholder="Curso"
                  className="brutal-input"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={edu.year || ''}
                    onChange={(e) => updateEducation(eduIdx, { year: e.target.value })}
                    placeholder="Ano"
                    className="brutal-input"
                  />
                  <input
                    value={edu.location || ''}
                    onChange={(e) => updateEducation(eduIdx, { location: e.target.value })}
                    placeholder="Local"
                    className="brutal-input"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange(addEducation(profile))}
              className="brutal-btn-yellow inline-flex items-center justify-center gap-1.5 px-3 py-2 text-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar formação
            </button>
          </div>
        )}

        {section.type === 'skills' && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...profile,
                      skills: profile.skills.filter((s) => s !== skill),
                    })
                  }
                  className="brutal-tag hover:border-danger hover:text-danger"
                  title="Remover habilidade"
                >
                  {skill}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkillValue();
                  }
                }}
                placeholder="Nova habilidade"
                className="brutal-input"
              />
              <button
                type="button"
                onClick={addSkillValue}
                className="brutal-btn px-3 py-2 text-2xs"
              >
                Add
              </button>
            </div>
          </div>
        )}

        <Versions versions={versions} onRestore={onRestore} />
      </div>
    );
  };

  return (
    <aside className="hidden h-full w-[320px] shrink-0 flex-col border-l border-line bg-white lg:flex">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted">
          Inspetor
        </span>
        <span className="text-2xs text-subtle">
          {saveStatus === 'saved' ? 'Salvo' : saveStatus === 'saving' ? 'Salvando…' : 'Erro'}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{renderSection()}</div>
    </aside>
  );
}

function Versions({
  versions,
  onRestore,
}: {
  versions: ResumeVersion[];
  onRestore: (version: ResumeVersion) => void;
}) {
  if (versions.length === 0) {
    return (
      <div>
        <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted">
          Versões
        </div>
        <p className="text-2xs text-subtle">Nenhuma versão salva ainda.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted">
        Versões
      </div>
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
    </div>
  );
}