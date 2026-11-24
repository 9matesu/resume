import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import {
  Download,
  FileCode,
  Sliders,
  Trash2,
  Loader2,
  Wand2,
  Save,
  Sparkles,
  ExternalLink,
  X,
  Copy,
  RefreshCw,
} from 'lucide-react';
import {
  saveResumeEdit,
  polishBullet,
  fetchResumeDetail,
  resumePdfUrl,
} from '../../services/api';
import { cvFilename } from '../../cvFilename';
import { ActionButton, Stage } from '../ActionButton';
import { ToastStack, useToasts } from '../Toast';
import { ChatPanel } from './ChatPanel';

const LatexEditor = lazy(() =>
  import('./LatexEditor').then((m) => ({ default: m.LatexEditor })),
);
import type {
  AdaptedResult,
  CandidateProfile,
} from '../../services/api';

interface StudioWorkspaceProps {
  adaptedData: AdaptedResult;
  onBackToOverlay?: () => void;
  onClose?: () => void;
  onDetach?: () => void;
}

const inlinePdfUrl = (url: string) => `${url}${url.includes('?') ? '&' : '?'}inline=1`;

export const StudioWorkspace: React.FC<StudioWorkspaceProps> = ({ adaptedData, onClose, onDetach }) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'latex' | 'chat'>('visual');
  const [profile, setProfile] = useState<CandidateProfile>(() => {
    const coerceBullets = (d: unknown): string[] =>
      Array.isArray(d)
        ? d.map((x) => String(x))
        : typeof d === 'string' && d.trim()
          ? d.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
          : [];
    const base = adaptedData.adaptation.tailored_profile;
    const fixEntries = (list: any[] | undefined) =>
      (list || []).map((e) => ({ ...e, description: coerceBullets(e?.description) }));
    return {
      ...base,
      leadership: fixEntries(base.leadership),
      experience: fixEntries(base.experience),
      education: base.education || [],
      projects: base.projects || [],
      certifications: base.certifications || [],
      languages: base.languages || [],
    };
  });
  const [rawTex, setRawTex] = useState(adaptedData.adaptation.tex_code);
  const [pdfUrl, setPdfUrl] = useState(adaptedData.adaptation.pdf_url);
  const [matchScore] = useState(adaptedData.adaptation.match_score ?? 0);

  const [compiling, setCompiling] = useState(false);
  const [polishingIndex, setPolishingIndex] = useState<{ expIdx: number; bIdx: number } | null>(null);
  const [newSkill, setNewSkill] = useState('');
  const [pdfStatus, setPdfStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pdfKey, setPdfKey] = useState(0);
  const [expired, setExpired] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { items: toasts, push: toast, dismiss } = useToasts();
  // Último estado salvo: define se o botão principal salva ou só baixa.
  const savedSnapshot = useRef<{ tex: string; profile: CandidateProfile } | null>(null);
  // Snapshot inicial = o que veio do histórico, ou seja, estado salvo.
  if (savedSnapshot.current === null) {
    savedSnapshot.current = { tex: adaptedData.adaptation.tex_code, profile };
  }

  // Revalida o snapshot do chrome.storage contra o backend. Usamos o detalhe
  // do proprio registro: o historico e limitado a 50 e um registro antigo
  // pareceria expirado sem motivo.
  useEffect(() => {
    let alive = true;
    fetchResumeDetail(adaptedData.adaptation.id)
      .then((detail) => {
        if (!alive) return;
        setPdfUrl(detail.adaptation.pdf_url || resumePdfUrl(adaptedData.adaptation.id));
      })
      .catch((err) => {
        if (String((err as Error)?.message || '').includes('não existe')) {
          setExpired(true);
        }
        // Falha de rede: mantem a URL guardada.
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Uma ação só: compila e baixa. O botão diz o que está fazendo enquanto roda
  // e confirma quando termina. Dirty tracking decide o rótulo: com alteração
  // ele salva; sem alteração ele só baixa o PDF que já existe.
  const dirty =
    savedSnapshot.current == null ||
    savedSnapshot.current.tex !== rawTex ||
    JSON.stringify(savedSnapshot.current.profile) !== JSON.stringify(profile);

  const compilePdf = async (download = true) => {
    setCompiling(true);
    setPdfStatus('loading');
    setSaveError('');
    try {
      let url = pdfUrl;
      if (dirty) {
        const res =
          activeTab === 'latex'
            ? await saveResumeEdit(adaptedData.adaptation.id, { tex_code: rawTex })
            : await saveResumeEdit(adaptedData.adaptation.id, { profile });
        setRawTex(res.tex);
        url = `${res.pdf_url}?t=${Date.now()}`;
        setPdfUrl(url);
        savedSnapshot.current = { tex: res.tex, profile };
        toast('PDF atualizado.', 'ok');
      }
      if (download) {
        const a = document.createElement('a');
        a.href = url;
        a.download =
          adaptedData.adaptation.pdf_filename ||
          cvFilename(
            adaptedData.adaptation.tailored_profile?.personal?.name || '',
            adaptedData.job.title,
            adaptedData.job.company,
          );
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast('PDF baixado.', 'ok');
      } else {
        toast('Prévia atualizada.', 'ok');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Não salvou.');
      setPdfStatus('error');
      toast(err.message || 'Não consegui gerar o PDF.', 'error');
    } finally {
      setCompiling(false);
    }
  };

  const compileAndDownload = () => compilePdf(true);
  const recompile = () => compilePdf(false);

  // AI Polish single bullet (experience or leadership)
  const handlePolishBullet = async (section: 'experience' | 'leadership', expIdx: number, bIdx: number) => {
    setPolishingIndex({ expIdx, bIdx });
    try {
      const list = section === 'experience' ? profile.experience : (profile.leadership || []);
      const currentBullet = list[expIdx].description[bIdx];
      const roleContext = `${adaptedData.job.title} at ${adaptedData.job.company}`;
      const polished = await polishBullet(currentBullet, roleContext);

      const updated = { ...profile };
      const target = (section === 'experience' ? updated.experience : (updated.leadership || [])) as typeof list;
      target[expIdx].description[bIdx] = polished;
      if (section === 'leadership') updated.leadership = target;
      setProfile(updated);
    } catch (err: any) {
      console.error('Polish error:', err);
    } finally {
      setPolishingIndex(null);
    }
  };

  const handleAddSkill = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newSkill.trim() && !profile.skills.includes(newSkill.trim())) {
      setProfile({ ...profile, skills: [...profile.skills, newSkill.trim()] });
      setNewSkill('');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-dvh w-full bg-white text-black overflow-hidden select-none">
      {/* LEFT PANE: Editor (empilha no estreito) */}
      <div className="w-full h-1/2 lg:h-full lg:w-[55%] flex flex-col bg-white overflow-hidden border-b lg:border-b-0 lg:border-r border-line">
        {/* Top Job Context Bar */}
        <div className="min-h-14 p-4 hairline-b bg-white flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold normal-case leading-tight break-words">{adaptedData.job.title}</h2>
              <span className="text-xs text-muted font-medium">na {adaptedData.job.company}</span>
            </div>
            {adaptedData.job.location && (
              <span className="text-11 text-subtle mt-0.5 block font-mono">{adaptedData.job.location}</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {matchScore > 0 && (
              <span className="brutal-tag brutal-tag-yellow">
                {matchScore.toFixed(0)}% Compatibilidade
              </span>
            )}

            {/* Mode Toggle */}
            <div className="flex rounded-lg border border-line bg-wash p-0.5 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('visual')}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 cursor-pointer transition-colors ${activeTab === 'visual' ? 'bg-white text-black shadow-mac' : 'text-muted hover:text-black'}`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Visual
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 cursor-pointer transition-colors ${activeTab === 'chat' ? 'bg-white text-black shadow-mac' : 'text-muted hover:text-black'}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Chat
              </button>
              <button
                onClick={() => setActiveTab('latex')}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 cursor-pointer transition-colors ${activeTab === 'latex' ? 'bg-white text-black shadow-mac' : 'text-muted hover:text-black'}`}
              >
                <FileCode className="w-3.5 h-3.5" />
                Código
              </button>
            </div>

            {onDetach && (
              <button
                type="button"
                aria-label="Abrir Estúdio em janela separada"
                title="Abrir em janela separada"
                onClick={onDetach}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-muted transition-colors hover:bg-wash hover:text-black"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                aria-label="Fechar Estúdio"
                title="Fechar"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-muted transition-colors hover:bg-wash hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className={`flex-1 p-6 space-y-6 ${activeTab === 'chat' ? 'min-h-0 overflow-hidden' : 'overflow-y-auto'}`}>
          {activeTab === 'chat' ? (
            <div className="h-full min-h-0 -m-6">
              <ChatPanel
                resumeId={adaptedData.adaptation.id}
                job={adaptedData.job}
                profile={profile}
                onProfileChange={setProfile}
                onToast={toast}
                onClose={() => {}}
                matchScore={matchScore}
                atsCoverage={adaptedData.adaptation.ats?.coverage ?? null}
              />
            </div>
          ) : activeTab === 'visual' ? (
            <>
              {/* Summary Section */}
              <div className="space-y-2">
                <label htmlFor="field-1" className="text-2xs font-bold uppercase tracking-wider block">
                  Resumo Profissional Adaptado
                </label>
                <textarea id="field-1"
                  rows={3}
                  value={profile.summary}
                  onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
                  className="brutal-input leading-relaxed"
                />
              </div>

              {/* Experience Section */}
              <div className="space-y-4">
                <div className="text-2xs font-bold uppercase tracking-wider block">
                  Experiências e Conquistas Adaptadas
                </div>

                {profile.experience.map((exp, expIdx) => (
                  <div key={expIdx} className="brutal-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-xs uppercase">{exp.title}</span>
                        <span className="text-xs text-muted ml-2 font-medium">na {exp.company}</span>
                      </div>
                      <span className="text-11 text-subtle font-mono">{exp.period}</span>
                    </div>

                    {/* Bullets */}
                    <div className="space-y-2">
                      {exp.description.map((bullet, bIdx) => (
                        <div key={bIdx} className="flex items-start gap-2 group">
                          <span className="mt-2.5 text-xs font-bold">•</span>
                          <textarea
                            rows={2}
                            value={bullet}
                            onChange={(e) => {
                              const updated = { ...profile };
                              updated.experience[expIdx].description[bIdx] = e.target.value;
                              setProfile(updated);
                            }}
                            className="brutal-input flex-1 leading-relaxed"
                          />
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => handlePolishBullet('experience', expIdx, bIdx)}
                              disabled={polishingIndex?.expIdx === expIdx && polishingIndex?.bIdx === bIdx}
                              title="Aprimorar este item com IA"
                              className="brutal-btn p-2 cursor-pointer"
                            >
                              {polishingIndex?.expIdx === expIdx && polishingIndex?.bIdx === bIdx ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Wand2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = { ...profile };
                                updated.experience[expIdx].description = updated.experience[expIdx].description.filter((_, i) => i !== bIdx);
                                setProfile(updated);
                              }}
                              className="brutal-btn p-2 cursor-pointer"
                              title="Remover item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...profile };
                          updated.experience[expIdx].description.push('Nova conquista sob medida com métrica...');
                          setProfile(updated);
                        }}
                        className="text-11 font-bold underline underline-offset-4 inline-flex items-center gap-1 cursor-pointer hover:bg-black hover:text-white px-1 py-0.5 transition-colors"
                      >
                        + Adicionar item de realização
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Leadership Section (espelha o template) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-2xs font-bold uppercase tracking-wider block">
                    Atividades de Liderança
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfile({
                        ...profile,
                        leadership: [
                          ...(profile.leadership || []),
                          { title: '', company: '', location: '', period: '', description: [] },
                        ],
                      });
                    }}
                    className="text-11 font-bold underline underline-offset-4 inline-flex items-center gap-1 cursor-pointer hover:bg-black hover:text-white px-1 py-0.5 transition-colors"
                  >
                    + Adicionar atividade
                  </button>
                </div>

                {(profile.leadership || []).map((lead, leadIdx) => (
                  <div key={leadIdx} className="brutal-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-xs uppercase">{lead.title || 'Nova atividade'}</span>
                        {lead.company && (
                          <span className="text-xs text-muted ml-2 font-medium">na {lead.company}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-11 text-subtle font-mono">{lead.period}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setProfile({
                              ...profile,
                              leadership: (profile.leadership || []).filter((_, i) => i !== leadIdx),
                            });
                          }}
                          className="brutal-btn p-1.5 cursor-pointer"
                          title="Remover atividade"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={lead.title}
                        onChange={(e) => {
                          const updated = [...(profile.leadership || [])];
                          updated[leadIdx] = { ...updated[leadIdx], title: e.target.value };
                          setProfile({ ...profile, leadership: updated });
                        }}
                        placeholder="Cargo / Posição"
                        className="brutal-input text-xs"
                      />
                      <input
                        type="text"
                        value={lead.company}
                        onChange={(e) => {
                          const updated = [...(profile.leadership || [])];
                          updated[leadIdx] = { ...updated[leadIdx], company: e.target.value };
                          setProfile({ ...profile, leadership: updated });
                        }}
                        placeholder="Organização"
                        className="brutal-input text-xs"
                      />
                      <input
                        type="text"
                        value={lead.location || ''}
                        onChange={(e) => {
                          const updated = [...(profile.leadership || [])];
                          updated[leadIdx] = { ...updated[leadIdx], location: e.target.value };
                          setProfile({ ...profile, leadership: updated });
                        }}
                        placeholder="Local"
                        className="brutal-input text-xs"
                      />
                      <input
                        type="text"
                        value={lead.period || ''}
                        onChange={(e) => {
                          const updated = [...(profile.leadership || [])];
                          updated[leadIdx] = { ...updated[leadIdx], period: e.target.value };
                          setProfile({ ...profile, leadership: updated });
                        }}
                        placeholder="Período"
                        className="brutal-input text-xs"
                      />
                    </div>

                    {/* Bullets */}
                    <div className="space-y-2">
                      {(lead.description || []).map((bullet, bIdx) => (
                        <div key={bIdx} className="flex items-start gap-2 group">
                          <span className="mt-2.5 text-xs font-bold">•</span>
                          <textarea
                            rows={2}
                            value={bullet}
                            onChange={(e) => {
                              const updated = [...(profile.leadership || [])];
                              updated[leadIdx].description[bIdx] = e.target.value;
                              setProfile({ ...profile, leadership: updated });
                            }}
                            className="brutal-input flex-1 leading-relaxed"
                          />
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => handlePolishBullet('leadership', leadIdx, bIdx)}
                              disabled={polishingIndex?.expIdx === leadIdx && polishingIndex?.bIdx === bIdx}
                              title="Aprimorar este item com IA"
                              className="brutal-btn p-2 cursor-pointer"
                            >
                              {polishingIndex?.expIdx === leadIdx && polishingIndex?.bIdx === bIdx ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Wand2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...(profile.leadership || [])];
                                updated[leadIdx].description = updated[leadIdx].description.filter((_, i) => i !== bIdx);
                                setProfile({ ...profile, leadership: updated });
                              }}
                              className="brutal-btn p-2 cursor-pointer"
                              title="Remover item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...(profile.leadership || [])];
                          updated[leadIdx].description.push('Novo item de impacto...');
                          setProfile({ ...profile, leadership: updated });
                        }}
                        className="text-11 font-bold underline underline-offset-4 inline-flex items-center gap-1 cursor-pointer hover:bg-black hover:text-white px-1 py-0.5 transition-colors"
                      >
                        + Adicionar item de impacto
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Highlighted Skills */}
              <div className="space-y-2">
                <div className="text-2xs font-bold uppercase tracking-wider block">
                  Habilidades em Destaque
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.map((skill) => (
                    <span key={skill} className="brutal-tag">
                      {skill}
                      <button
                        onClick={() => setProfile({ ...profile, skills: profile.skills.filter((s) => s !== skill) })}
                        className="font-bold ml-1 hover:bg-black hover:text-white px-0.5 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={handleAddSkill}
                  placeholder="Digite uma habilidade e pressione Enter..."
                  className="brutal-input"
                />
              </div>

              {/* Education Section (espelha o template) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-2xs font-bold uppercase tracking-wider block">
                    Formação Acadêmica
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfile({
                        ...profile,
                        education: [
                          ...profile.education,
                          { institution: '', degree: '', year: '', location: '' },
                        ],
                      });
                    }}
                    className="text-11 font-bold underline underline-offset-4 inline-flex items-center gap-1 cursor-pointer hover:bg-black hover:text-white px-1 py-0.5 transition-colors"
                  >
                    + Adicionar formação
                  </button>
                </div>

                {profile.education.map((edu, eduIdx) => (
                  <div key={eduIdx} className="brutal-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs uppercase">{edu.institution || 'Nova formação'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setProfile({
                            ...profile,
                            education: profile.education.filter((_, i) => i !== eduIdx),
                          });
                        }}
                        className="brutal-btn p-1.5 cursor-pointer"
                        title="Remover formação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={edu.institution}
                        onChange={(e) => {
                          const updated = [...profile.education];
                          updated[eduIdx] = { ...updated[eduIdx], institution: e.target.value };
                          setProfile({ ...profile, education: updated });
                        }}
                        placeholder="Instituição"
                        className="brutal-input text-xs"
                      />
                      <input
                        type="text"
                        value={edu.degree || ''}
                        onChange={(e) => {
                          const updated = [...profile.education];
                          updated[eduIdx] = { ...updated[eduIdx], degree: e.target.value };
                          setProfile({ ...profile, education: updated });
                        }}
                        placeholder="Curso / Grau"
                        className="brutal-input text-xs"
                      />
                      <input
                        type="text"
                        value={edu.location || ''}
                        onChange={(e) => {
                          const updated = [...profile.education];
                          updated[eduIdx] = { ...updated[eduIdx], location: e.target.value };
                          setProfile({ ...profile, education: updated });
                        }}
                        placeholder="Local"
                        className="brutal-input text-xs"
                      />
                      <input
                        type="text"
                        value={edu.year || ''}
                        onChange={(e) => {
                          const updated = [...profile.education];
                          updated[eduIdx] = { ...updated[eduIdx], year: e.target.value };
                          setProfile({ ...profile, education: updated });
                        }}
                        placeholder="Ano / Período"
                        className="brutal-input text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {(profile.projects || []).length > 0 && (
                <div className="space-y-2">
                  <div className="text-2xs font-bold uppercase tracking-wider block">
                    Projetos
                  </div>
                  {(profile.projects || []).map((p, pIdx) => (
                    <div key={pIdx} className="brutal-card p-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold">{p.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setProfile({
                            ...profile,
                            projects: (profile.projects || []).filter((_, i) => i !== pIdx),
                          });
                        }}
                        className="brutal-btn p-1.5 cursor-pointer"
                        title="Remover projeto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {(profile.certifications || []).length > 0 && (
                <div className="space-y-2">
                  <div className="text-2xs font-bold uppercase tracking-wider block">
                    Certificações
                  </div>
                  {(profile.certifications || []).map((c, cIdx) => (
                    <div key={cIdx} className="brutal-card p-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold">{typeof c === 'string' ? c : c.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setProfile({
                            ...profile,
                            certifications: (profile.certifications || []).filter((_, i) => i !== cIdx),
                          });
                        }}
                        className="brutal-btn p-1.5 cursor-pointer"
                        title="Remover certificação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Raw LaTeX Source Tab */
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-line bg-wash px-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-mac-red" />
                    <span className="h-2.5 w-2.5 rounded-full bg-mac-yellow" />
                    <span className="h-2.5 w-2.5 rounded-full bg-mac-green" />
                  </span>
                  <span className="text-2xs font-semibold">currículo.tex</span>
                  {dirty && <span className="h-1.5 w-1.5 rounded-full bg-brand" title="Alterações não salvas" />}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Copiar LaTeX"
                    title="Copiar"
                    onClick={() => {
                      void navigator.clipboard.writeText(rawTex);
                      toast('LaTeX copiado.', 'ok');
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-white hover:text-black"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Baixar arquivo .tex"
                    title="Baixar .tex"
                    onClick={() => {
                      const blob = new Blob([rawTex], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'curriculo.tex';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-white hover:text-black"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Recompilar PDF"
                    title="Recompilar"
                    onClick={() => void recompile()}
                    disabled={compiling}
                    className="flex h-7 items-center gap-1 rounded-md px-2 text-2xs font-semibold text-muted transition-colors hover:bg-white hover:text-black disabled:opacity-40"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${compiling ? 'spin' : ''}`} />
                    Recompilar
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center bg-white text-xs text-muted">
                      Carregando editor…
                    </div>
                  }
                >
                  <LatexEditor
                    value={rawTex}
                    onChange={setRawTex}
                    onSave={() => void compilePdf(false)}
                    errorMessage={saveError || undefined}
                  />
                </Suspense>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Footer: uma ação só */}
        <div className="p-4 hairline-t bg-white flex flex-wrap items-center justify-between gap-3">
          {saveError ? (
            <span className="text-xs text-danger">{saveError}</span>
          ) : compiling ? (
            <Stage label="Gerando seu PDF" detail="Pode levar alguns segundos" />
          ) : (
            <span className="text-xs text-muted-strong">
              {dirty ? 'Tem alteração na mão' : 'Tudo salvo'}
            </span>
          )}
          <ActionButton
            label={dirty ? 'Salvar e baixar PDF' : 'Baixar PDF'}
            pendingLabel="Gerando PDF…"
            pending={compiling}
            onClick={compileAndDownload}
            icon={dirty ? <Save className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
            className="px-5 py-2.5 text-xs tracking-wider shrink-0"
            testId="save-download"
          />
        </div>
      </div>

      {/* RIGHT PANE: Live PDF Viewer */}
      <div className="w-full h-1/2 lg:h-full lg:w-[45%] flex flex-col bg-wash">
        {/* Viewer Toolbar */}
        <div className="min-h-14 p-4 hairline-b bg-white flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold flex items-center gap-2">
            <span className="uppercase">Prévia do PDF</span>
          </span>

          <span className="text-2xs text-muted">
            {compiling ? 'Atualizando…' : 'O PDF sai no botão Baixar PDF.'}
          </span>
        </div>

        {/* Embedded PDF iframe */}
        <div className="flex-1 w-full h-full bg-wash-strong p-5">
          <div className="w-full h-full overflow-hidden border border-line-strong bg-white shadow-brutal-md relative">
            {expired ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="brutal-tag brutal-tag-black">Resultado expirado</span>
                <p className="text-xs font-mono text-muted-strong max-w-xs">
                  Este registro não existe mais no motor.
                </p>
                <button onClick={() => window.close()} className="brutal-btn px-4 py-2 text-11">
                  Fechar aba
                </button>
              </div>
            ) : (
              <>
                {pdfStatus === 'loading' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-11 font-mono uppercase">Carregando PDF...</span>
                  </div>
                )}
                {pdfStatus === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-white">
                    <span className="brutal-tag brutal-tag-black">Não abriu</span>
                    <p className="text-xs font-mono text-muted-strong max-w-xs">
                      Não abriu. Confira se o motor está rodando.
                    </p>
                    <div className="flex items-center gap-2">
                      <ActionButton
                        label="Tentar de novo"
                        onClick={() => {
                          setPdfStatus('loading');
                          setPdfKey((k) => k + 1);
                        }}
                        variant="solid"
                      />
                      <ActionButton
                        label="Baixar PDF"
                        icon={<Download className="w-3.5 h-3.5" />}
                        onClick={compileAndDownload}
                      />
                    </div>
                  </div>
                )}
                <iframe
                  key={pdfKey}
                  src={inlinePdfUrl(pdfUrl)}
                  title="Pré-visualização do Currículo"
                  className="w-full h-full border-none"
                  onLoad={() => setPdfStatus('ready')}
                  onError={() => setPdfStatus('error')}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <ToastStack items={toasts} onDismiss={dismiss} />
    </div>
  );
};
