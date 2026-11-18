import React, { useState, useRef, useEffect } from 'react';
import {
  Loader2,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import {
  parseResumeFile,
  saveMasterProfile,
  saveSettings,
  testAiConnection,
  fetchProviders,
  type ProviderInfo,
} from '../../services/api';
import type { CandidateProfile, AppHealth } from '../../services/api';
import { AiProviderFields } from '../settings/AiProviderFields';

interface OnboardingWizardProps {
  onComplete: () => void;
  health: AppHealth;
}

const STEPS = [
  { n: 1, label: '1. Seu currículo' },
  { n: 2, label: '2. Seu perfil' },
  { n: 3, label: '3. IA e PDF' },
];

const SectionLabel = ({ index, title }: { index: string; title: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="brutal-tag brutal-tag-black">{index}</span>
    <h2 className="text-xs font-bold uppercase tracking-wider">{title}</h2>
  </div>
);

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, health }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<CandidateProfile>({
    personal: {
      name: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      portfolio: '',
    },
    summary: '',
    experience: [],
    leadership: [],
    education: [],
    skills: [],
  });

  const [aiProvider, setAiProvider] = useState(health.ai_provider || 'gemini');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState(health.ai_model || '');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [catalog, setCatalog] = useState<ProviderInfo[]>([]);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    fetchProviders().then(setCatalog).catch(() => {});
  }, []);

  const processFile = async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const res = await parseResumeFile(file);
      setProfile((prev) => ({
        ...prev,
        ...res.profile,
        personal: { ...prev.personal, ...res.profile.personal },
      }));
      setStep(2);
    } catch (err: any) {
      setUploadError(err.message || 'Não consegui ler esse currículo.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFile(e.target.files[0]);
    }
  };

  const handleTestAi = async () => {
    const entry = catalog.find((p) => p.id === aiProvider);
    const needsKey = entry ? entry.needs_key : aiProvider !== 'ollama';
    if (!aiApiKey && needsKey && !health.has_api_key) {
      setAiTestResult({ ok: false, message: 'Insira uma chave de API primeiro' });
      return;
    }
    setTestingAi(true);
    setAiTestResult(null);
    try {
      const ent = catalog.find((p) => p.id === aiProvider);
      await testAiConnection({
        ai_provider: aiProvider,
        ai_api_key: aiApiKey,
        ai_model: aiModel,
        ai_base_url: aiBaseUrl || ent?.default_base_url || '',
      });
      setAiTestResult({ ok: true, message: aiModel ? 'Conectou com ' + aiModel + '.' : 'Conectou.' });
    } catch (err: any) {
      setAiTestResult({ ok: false, message: err.message || 'A IA não respondeu.' });
    } finally {
      setTestingAi(false);
    }
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !profile.skills.includes(newSkill.trim())) {
      setProfile({ ...profile, skills: [...profile.skills, newSkill.trim()] });
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setProfile({ ...profile, skills: profile.skills.filter((s) => s !== skillToRemove) });
  };

  const handleAddExperience = () => {
    setProfile({
      ...profile,
      experience: [
        ...profile.experience,
        {
          title: '',
          company: '',
          period: '',
          description: [''],
        },
      ],
    });
  };

  const handleAddEducation = () => {
    setProfile({
      ...profile,
      education: [
        ...profile.education,
        {
          institution: '',
          degree: '',
          year: '',
          location: '',
        },
      ],
    });
  };

  const handleAddLeadership = () => {
    setProfile({
      ...profile,
      leadership: [
        ...(profile.leadership || []),
        {
          title: '',
          company: '',
          location: '',
          period: '',
          description: [],
        },
      ],
    });
  };

  const handleAddProject = () => {
    setProfile({
      ...profile,
      projects: [
        ...(profile.projects || []),
        { name: '', description: '' },
      ],
    });
  };

  const handleAddLanguage = () => {
    setProfile({
      ...profile,
      languages: [...(profile.languages || []), { name: '' }],
    });
  };

  const handleAddCertification = () => {
    setProfile({
      ...profile,
      certifications: [...(profile.certifications || []), { name: '' }],
    });
  };
  const handleFinish = async () => {
    try {
      await saveMasterProfile(profile);
      const ent = catalog.find((p) => p.id === aiProvider);
      await saveSettings({
        ai_provider: aiProvider,
        ai_model: aiModel,
        ai_base_url: aiBaseUrl || ent?.default_base_url || '',
        ...(aiApiKey ? { ai_api_key: aiApiKey, provider_for_key: aiProvider } : {}),
      });
      onComplete();
    } catch (err: any) {
      setUploadError('Não salvei o perfil: ' + err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full select-none">
      {/* Stepper */}
      <section className="w-full hairline-b bg-white">
        <div className="w-full grid grid-cols-1 md:grid-cols-3 text-xs md:text-sm divide-y md:divide-y-0 md:divide-x divide-black">
          {STEPS.map((s) => {
            const active = step === s.n;
            const done = step > s.n;
            return (
              <div
                key={s.n}
                className={`p-3 md:px-6 md:py-3 flex items-center gap-2 font-bold ${
                  active ? 'bg-wash text-black' : done ? 'bg-white text-black' : 'bg-white text-subtle'
                }`}
              >
                <span
                  className={`inline-block w-4 h-4 rounded-full text-2xs text-center leading-4 font-mono shrink-0 ${
                    active || done ? 'bg-black text-white' : 'border border-line-strong text-subtle'
                  }`}
                >
                  {done ? '✓' : s.n}
                </span>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Step 1: Upload Resume */}
      {step === 1 && (
        <main className="flex-grow overflow-y-auto flex items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-xl">
            <div className="mb-4 font-mono text-11 text-ink leading-relaxed">
              Importe seu currículo uma única vez. O resuMe usa ele como{' '}
              <strong className="text-black underline underline-offset-2">base</strong>{' '}
              para montar currículos sob medida para cada vaga.
            </div>
            <div
              role="button"
              tabIndex={0}
              aria-label="Selecionar currículo"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="w-full bg-brutal-yellow border border-line-strong p-8 sm:p-12 text-center shadow-brutal-lg cursor-pointer"
            >
              <h1 className="font-editorial text-4xl sm:text-5xl text-black font-normal leading-105 tracking-tight mb-4">
                {uploading ? 'Lendo o currículo…' : 'Arraste seu currículo para cá'}
              </h1>
              <p className="font-mono text-xs sm:text-sm text-ink mb-6 max-w-lg mx-auto font-medium">
                Compatível com{' '}
                {['PDF', 'DOCX', 'TXT', 'Markdown', 'LaTeX (.tex)'].map((f, i) => (
                  <React.Fragment key={f}>
                    {i > 0 && (i === 4 ? ' ou ' : ', ')}
                    <span className="underline font-bold">{f}</span>
                  </React.Fragment>
                ))}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.tex"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                <span className="brutal-btn inline-block py-2.5 px-6 text-xs sm:text-sm tracking-wider">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Escolher arquivo'}
                </span>
              </div>
              {uploadError && (
                <div className="mb-6 bg-white border border-line-strong p-3 text-xs font-mono text-left flex items-center gap-2">
                  <span className="brutal-tag brutal-tag-black shrink-0">Erro</span>
                  <span>{uploadError}</span>
                </div>
              )}
              <div className="pt-4 border-t border-black/40 flex flex-wrap items-center justify-end gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setStep(2); }}
                  className="text-ink hover:underline font-bold hover:bg-black hover:text-white px-1 py-0.5 transition-colors cursor-pointer"
                >
                  Preencher à mão
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Step 2: Master Profile Review */}
      {step === 2 && (
        <main className="flex-grow overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto space-y-8">
            <section>
              <SectionLabel index="01" title="Informações pessoais & contato" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="field-1" className="text-2xs font-bold uppercase tracking-wider block mb-1">Nome Completo</label>
                  <input id="field-1"
                    type="text"
                    value={profile.personal.name}
                    onChange={(e) => setProfile({ ...profile, personal: { ...profile.personal, name: e.target.value } })}
                    placeholder="Ex: Matheus Costa"
                    className="brutal-input"
                  />
                </div>
                <div>
                  <label htmlFor="field-2" className="text-2xs font-bold uppercase tracking-wider block mb-1">E-mail</label>
                  <input id="field-2"
                    type="email"
                    value={profile.personal.email}
                    onChange={(e) => setProfile({ ...profile, personal: { ...profile.personal, email: e.target.value } })}
                    placeholder="seu.email@exemplo.com"
                    className="brutal-input"
                  />
                </div>
                <div>
                  <label htmlFor="field-3" className="text-2xs font-bold uppercase tracking-wider block mb-1">Telefone / WhatsApp</label>
                  <input id="field-3"
                    type="text"
                    value={profile.personal.phone}
                    onChange={(e) => setProfile({ ...profile, personal: { ...profile.personal, phone: e.target.value } })}
                    placeholder="+55 (11) 98765-4321"
                    className="brutal-input"
                  />
                </div>
                <div>
                  <label htmlFor="field-4" className="text-2xs font-bold uppercase tracking-wider block mb-1">Localização</label>
                  <input id="field-4"
                    type="text"
                    value={profile.personal.location}
                    onChange={(e) => setProfile({ ...profile, personal: { ...profile.personal, location: e.target.value } })}
                    placeholder="São Paulo, SP - Brasil"
                    className="brutal-input"
                  />
                </div>
                <div>
                  <label htmlFor="field-5" className="text-2xs font-bold uppercase tracking-wider block mb-1">Perfil do LinkedIn</label>
                  <input id="field-5"
                    type="text"
                    value={profile.personal.linkedin}
                    onChange={(e) => setProfile({ ...profile, personal: { ...profile.personal, linkedin: e.target.value } })}
                    placeholder="https://linkedin.com/in/usuario"
                    className="brutal-input"
                  />
                </div>
                <div>
                  <label htmlFor="field-6" className="text-2xs font-bold uppercase tracking-wider block mb-1">GitHub ou Portfolio</label>
                  <input id="field-6"
                    type="text"
                    value={profile.personal.github}
                    onChange={(e) => setProfile({ ...profile, personal: { ...profile.personal, github: e.target.value } })}
                    placeholder="https://github.com/usuario"
                    className="brutal-input"
                  />
                </div>
              </div>
            </section>

            <section>
              <SectionLabel index="02" title="Resumo profissional" />
              <textarea
                rows={3}
                value={profile.summary}
                onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
                placeholder="Descreva sua trajetória de base, anos de experiência, especialidades tecnicas e principais realizações..."
                className="brutal-input"
              />
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel index="03" title={`Experiência profissional (${profile.experience.length})`} />
                <button type="button" onClick={handleAddExperience} className="brutal-btn flex items-center gap-1.5 px-3 py-1.5 text-2xs">
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Cargo
                </button>
              </div>

              <div className="space-y-4">
                {profile.experience.map((exp, idx) => (
                  <div key={idx} className="brutal-card p-4 relative">
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, experience: profile.experience.filter((_, i) => i !== idx) })}
                      className="absolute top-4 right-4 text-muted hover:bg-black hover:text-white transition-colors cursor-pointer p-1"
                      title="Remover cargo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 pr-8">
                      <div>
                        <label htmlFor="field-7" className="text-2xs font-bold uppercase text-muted-strong block mb-0.5">Cargo / Título</label>
                        <input id="field-7"
                          type="text"
                          value={exp.title}
                          onChange={(e) => {
                            const updated = [...profile.experience];
                            updated[idx].title = e.target.value;
                            setProfile({ ...profile, experience: updated });
                          }}
                          placeholder="Ex: Engenheiro de Software Sênior"
                          className="brutal-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="field-8" className="text-2xs font-bold uppercase text-muted-strong block mb-0.5">Empresa</label>
                        <input id="field-8"
                          type="text"
                          value={exp.company}
                          onChange={(e) => {
                            const updated = [...profile.experience];
                            updated[idx].company = e.target.value;
                            setProfile({ ...profile, experience: updated });
                          }}
                          placeholder="Ex: Nubank"
                          className="brutal-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="field-9" className="text-2xs font-bold uppercase text-muted-strong block mb-0.5">Período / Datas</label>
                        <input id="field-9"
                          type="text"
                          value={exp.period || ''}
                          onChange={(e) => {
                            const updated = [...profile.experience];
                            updated[idx].period = e.target.value;
                            setProfile({ ...profile, experience: updated });
                          }}
                          placeholder="Ex: 2022 - Atual"
                          className="brutal-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="field-10" className="text-2xs font-bold uppercase text-muted-strong block mb-0.5">Local</label>
                        <input id="field-10"
                          type="text"
                          value={exp.location || ''}
                          onChange={(e) => {
                            const updated = [...profile.experience];
                            updated[idx].location = e.target.value;
                            setProfile({ ...profile, experience: updated });
                          }}
                          placeholder="Ex: São Paulo, SP / Remoto"
                          className="brutal-input"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 mt-2">
                      <div className="text-2xs font-bold uppercase text-muted-strong">
                        Conquistas e Responsabilidades (Bullets):
                      </div>
                      {exp.description.map((bullet, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-2">
                          <span className="font-bold">•</span>
                          <input
                            type="text"
                            value={bullet}
                            onChange={(e) => {
                              const updated = [...profile.experience];
                              updated[idx].description[bIdx] = e.target.value;
                              setProfile({ ...profile, experience: updated });
                            }}
                            className="brutal-input flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...profile.experience];
                              updated[idx].description = updated[idx].description.filter((_, i) => i !== bIdx);
                              setProfile({ ...profile, experience: updated });
                            }}
                            className="text-muted hover:bg-black hover:text-white cursor-pointer p-1.5 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...profile.experience];
                          updated[idx].description.push('Nova realização com impacto mensuravel...');
                          setProfile({ ...profile, experience: updated });
                        }}
                        className="text-xs font-bold underline underline-offset-4 mt-1 inline-flex items-center gap-1 cursor-pointer hover:bg-black hover:text-white transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar item de conquista
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel index="04" title={`Atividades de liderança (${(profile.leadership || []).length})`} />
                <button type="button" onClick={handleAddLeadership} className="brutal-btn flex items-center gap-1.5 px-3 py-1.5 text-2xs">
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Atividade
                </button>
              </div>

              <div className="space-y-4">
                {(profile.leadership || []).map((lead, idx) => (
                  <div key={idx} className="brutal-card p-4 relative">
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, leadership: (profile.leadership || []).filter((_, i) => i !== idx) })}
                      className="absolute top-4 right-4 text-muted hover:bg-black hover:text-white transition-colors cursor-pointer p-1"
                      title="Remover atividade"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 pr-8">
                      <div>
                        <label htmlFor="field-11" className="text-2xs font-bold uppercase text-muted-strong block mb-0.5">Cargo / Posição</label>
                        <input id="field-11"
                          type="text"
                          value={lead.title}
                          onChange={(e) => {
                            const updated = [...(profile.leadership || [])];
                            updated[idx].title = e.target.value;
                            setProfile({ ...profile, leadership: updated });
                          }}
                          placeholder="Ex: Líder de Capítulo"
                          className="brutal-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="field-12" className="text-2xs font-bold uppercase text-muted-strong block mb-0.5">Organização</label>
                        <input id="field-12"
                          type="text"
                          value={lead.company}
                          onChange={(e) => {
                            const updated = [...(profile.leadership || [])];
                            updated[idx].company = e.target.value;
                            setProfile({ ...profile, leadership: updated });
                          }}
                          placeholder="Ex: Liga de IA"
                          className="brutal-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="field-13" className="text-2xs font-bold uppercase text-muted-strong block mb-0.5">Período / Datas</label>
                        <input id="field-13"
                          type="text"
                          value={lead.period || ''}
                          onChange={(e) => {
                            const updated = [...(profile.leadership || [])];
                            updated[idx].period = e.target.value;
                            setProfile({ ...profile, leadership: updated });
                          }}
                          placeholder="Ex: 2023 - Atual"
                          className="brutal-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="field-14" className="text-2xs font-bold uppercase text-muted-strong block mb-0.5">Local</label>
                        <input id="field-14"
                          type="text"
                          value={lead.location || ''}
                          onChange={(e) => {
                            const updated = [...(profile.leadership || [])];
                            updated[idx].location = e.target.value;
                            setProfile({ ...profile, leadership: updated });
                          }}
                          placeholder="Ex: Remoto"
                          className="brutal-input"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 mt-2">
                      <div className="text-2xs font-bold uppercase text-muted-strong">
                        Impacto e Responsabilidades (Bullets):
                      </div>
                      {lead.description.map((bullet, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-2">
                          <span className="font-bold">•</span>
                          <input
                            type="text"
                            value={bullet}
                            onChange={(e) => {
                              const updated = [...(profile.leadership || [])];
                              updated[idx].description[bIdx] = e.target.value;
                              setProfile({ ...profile, leadership: updated });
                            }}
                            className="brutal-input flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...(profile.leadership || [])];
                              updated[idx].description = updated[idx].description.filter((_, i) => i !== bIdx);
                              setProfile({ ...profile, leadership: updated });
                            }}
                            className="text-muted hover:bg-black hover:text-white cursor-pointer p-1.5 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...(profile.leadership || [])];
                          updated[idx].description.push('Novo item de impacto...');
                          setProfile({ ...profile, leadership: updated });
                        }}
                        className="text-xs font-bold underline underline-offset-4 mt-1 inline-flex items-center gap-1 cursor-pointer hover:bg-black hover:text-white transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar item de impacto
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel index="05" title={`Formação acadêmica (${profile.education.length})`} />
                <button type="button" onClick={handleAddEducation} className="brutal-btn flex items-center gap-1.5 px-3 py-1.5 text-2xs">
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Formação
                </button>
              </div>

              <div className="space-y-3">
                {profile.education.map((edu, idx) => (
                  <div key={idx} className="brutal-card p-3.5 relative">
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, education: profile.education.filter((_, i) => i !== idx) })}
                      className="absolute top-3 right-3 text-muted hover:bg-black hover:text-white transition-colors cursor-pointer p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-6">
                      <div>
                        <label htmlFor="field-15" className="text-2xs font-bold uppercase text-muted-strong block mb-0.5">Instituição</label>
                        <input id="field-15"
                          type="text"
                          value={edu.institution}
                          onChange={(e) => {
                            const updated = [...profile.education];
                            updated[idx].institution = e.target.value;
                            setProfile({ ...profile, education: updated });
                          }}
                          placeholder="Ex: USP"
                          className="brutal-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="field-16" className="text-2xs font-bold uppercase text-muted-strong block mb-0.5">Curso / Grau</label>
                        <input id="field-16"
                          type="text"
                          value={edu.degree}
                          onChange={(e) => {
                            const updated = [...profile.education];
                            updated[idx].degree = e.target.value;
                            setProfile({ ...profile, education: updated });
                          }}
                          placeholder="Ex: Bacharelado em Ciência da Computação"
                          className="brutal-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="field-17" className="text-2xs font-bold uppercase text-muted-strong block mb-0.5">Ano de Conclusão</label>
                        <input id="field-17"
                          type="text"
                          value={edu.year}
                          onChange={(e) => {
                            const updated = [...profile.education];
                            updated[idx].year = e.target.value;
                            setProfile({ ...profile, education: updated });
                          }}
                          placeholder="Ex: 2019"
                          className="brutal-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="field-18" className="text-2xs font-bold uppercase text-muted-strong block mb-0.5">Local</label>
                        <input id="field-18"
                          type="text"
                          value={edu.location || ''}
                          onChange={(e) => {
                            const updated = [...profile.education];
                            updated[idx].location = e.target.value;
                            setProfile({ ...profile, education: updated });
                          }}
                          placeholder="Ex: São Paulo, SP"
                          className="brutal-input"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <SectionLabel index="06" title={`Habilidades (${profile.skills.length})`} />
              <div className="flex flex-wrap gap-2 mb-3">
                {profile.skills.map((skill) => (
                  <span key={skill} className="brutal-tag">
                    {skill}
                    <button
                      onClick={() => handleRemoveSkill(skill)}
                      className="font-bold ml-1 hover:bg-black hover:text-white px-0.5 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                  placeholder="Digite uma habilidade (Ex: Python, Docker, React)..."
                  className="brutal-input flex-1"
                />
                <button type="button" onClick={handleAddSkill} className="brutal-btn-yellow px-4 py-2 text-xs">
                  Adicionar
                </button>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel index="07" title={`Projetos (${(profile.projects || []).length})`} />
                <button type="button" onClick={handleAddProject} className="brutal-btn flex items-center gap-1.5 px-3 py-1.5 text-2xs">
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Projeto
                </button>
              </div>

              <div className="space-y-3">
                {(profile.projects || []).map((proj, idx) => (
                  <div key={idx} className="brutal-card p-3.5 relative">
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, projects: (profile.projects || []).filter((_, i) => i !== idx) })}
                      className="absolute top-3 right-3 text-muted hover:bg-black hover:text-white transition-colors cursor-pointer p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-6">
                      <div>
                        <label htmlFor="field-19" className="text-2xs font-bold uppercase text-muted-strong block mb-0.5">Nome</label>
                        <input id="field-19"
                          type="text"
                          value={proj.name}
                          onChange={(e) => {
                            const updated = [...(profile.projects || [])];
                            updated[idx] = { ...updated[idx], name: e.target.value };
                            setProfile({ ...profile, projects: updated });
                          }}
                          placeholder="Ex: digiPat"
                          className="brutal-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="field-20" className="text-2xs font-bold uppercase text-muted-strong block mb-0.5">Período</label>
                        <input id="field-20"
                          type="text"
                          value={proj.period || ''}
                          onChange={(e) => {
                            const updated = [...(profile.projects || [])];
                            updated[idx] = { ...updated[idx], period: e.target.value };
                            setProfile({ ...profile, projects: updated });
                          }}
                          placeholder="Ex: 2025"
                          className="brutal-input"
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <label htmlFor="field-21" className="text-2xs font-bold uppercase text-muted-strong block mb-0.5">Descrição / destaques</label>
                      <textarea id="field-21"
                        rows={2}
                        value={Array.isArray(proj.description) ? proj.description.join('\n') : proj.description || ''}
                        onChange={(e) => {
                          const updated = [...(profile.projects || [])];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          setProfile({ ...profile, projects: updated });
                        }}
                        className="brutal-input"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel index="08" title={`Idiomas (${(profile.languages || []).length})`} />
                <button type="button" onClick={handleAddLanguage} className="brutal-btn flex items-center gap-1.5 px-3 py-1.5 text-2xs">
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Idioma
                </button>
              </div>
              <div className="space-y-2">
                {(profile.languages || []).map((lang, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={lang.name}
                      onChange={(e) => {
                        const updated = [...(profile.languages || [])];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setProfile({ ...profile, languages: updated });
                      }}
                      placeholder="Idioma (Ex: Inglês)"
                      className="brutal-input flex-1"
                    />
                    <input
                      type="text"
                      value={lang.level || ''}
                      onChange={(e) => {
                        const updated = [...(profile.languages || [])];
                        updated[idx] = { ...updated[idx], level: e.target.value };
                        setProfile({ ...profile, languages: updated });
                      }}
                      placeholder="Nível (Ex: fluente)"
                      className="brutal-input flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, languages: (profile.languages || []).filter((_, i) => i !== idx) })}
                      className="text-muted hover:bg-black hover:text-white cursor-pointer p-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionLabel index="09" title={`Certificações (${(profile.certifications || []).length})`} />
                <button type="button" onClick={handleAddCertification} className="brutal-btn flex items-center gap-1.5 px-3 py-1.5 text-2xs">
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Certificação
                </button>
              </div>
              <div className="space-y-2">
                {(profile.certifications || []).map((cert, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={cert.name}
                      onChange={(e) => {
                        const updated = [...(profile.certifications || [])];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setProfile({ ...profile, certifications: updated });
                      }}
                      placeholder="Nome da certificação"
                      className="brutal-input flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, certifications: (profile.certifications || []).filter((_, i) => i !== idx) })}
                      className="text-muted hover:bg-black hover:text-white cursor-pointer p-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex items-center justify-between pt-5 hairline-t">
              <button onClick={() => setStep(1)} className="brutal-btn flex items-center gap-1.5 px-4 py-2 text-xs">
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
              <button onClick={() => setStep(3)} className="brutal-btn-yellow flex items-center gap-1.5 px-6 py-2.5 text-xs tracking-wider">
                Avançar para IA
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      )}

      {/* Step 3: AI & Compiler Setup */}
      {step === 3 && (
        <main className="flex-grow overflow-y-auto px-4 py-6">
          <div className="max-w-xl mx-auto space-y-6">
            <section>
              <SectionLabel index="10" title="Provedor de IA" />
              <p className="text-xs text-muted-strong font-mono -mt-1 mb-3">
                Escolha o modelo que vai ler as vagas e ajustar os currículos.
              </p>

              <div className="space-y-4">
                <AiProviderFields
                  catalog={catalog}
                  provider={aiProvider}
                  model={aiModel}
                  apiKey={aiApiKey}
                  baseUrl={aiBaseUrl}
                  onProviderChange={setAiProvider}
                  onModelChange={setAiModel}
                  onApiKeyChange={setAiApiKey}
                  onBaseUrlChange={setAiBaseUrl}
                  keyHint={
                    <span className="text-muted normal-case tracking-normal">
                      (guardada só no seu computador)
                    </span>
                  }
                />

                <button
                  type="button"
                  onClick={handleTestAi}
                  disabled={testingAi}
                  className="brutal-btn w-full py-2 text-xs flex items-center justify-center gap-2"
                >
                  {testingAi && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{testingAi ? 'Testando...' : 'Testar IA'}</span>
                </button>

                {aiTestResult && (
                  <div className={`p-3 text-xs flex items-center gap-2 border border-line-strong ${aiTestResult.ok ? 'bg-brutal-yellow' : 'bg-white'}`}>
                    <span className="brutal-tag brutal-tag-black shrink-0">{aiTestResult.ok ? 'OK' : 'Falha'}</span>
                    <span>{aiTestResult.message}</span>
                  </div>
                )}
              </div>
            </section>

            <div className="hairline-b py-3 flex items-center justify-between text-xs font-mono">
              <span className="text-muted">Gerador de PDF:</span>
              <strong>{health.compiler_type || 'Tectonic'} (local)</strong>
            </div>

            <div className="flex items-center justify-between pt-4">
              <button onClick={() => setStep(2)} className="brutal-btn flex items-center gap-1.5 px-4 py-2 text-xs">
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
              <button onClick={handleFinish} className="brutal-btn-yellow flex items-center gap-1.5 px-6 py-2.5 text-xs tracking-wider">
                Concluir
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>
      )}
    </div>
  );
};
