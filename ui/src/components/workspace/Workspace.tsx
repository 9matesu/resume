import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { KeyRound } from 'lucide-react';
import type {
  AdaptedResult,
  CandidateProfile,
  HistoryItem,
} from '../../services/api';
import {
  absUrl,
  fetchHealth,
  fetchHistory,
  fetchResumeDetail,
  saveResumeEdit,
} from '../../services/api';
import {
  isExtension,
  onCaptureResult,
  startAutoCapture,
} from '../../chrome';
import { cvFilename } from '../../cvFilename';
import { CommandBar, type WorkspaceView } from './CommandBar';
import { NavPane } from './NavPane';
import { Inspector } from './Inspector';
import { ChatPanel } from '../studio/ChatPanel';
import { ToastStack, useToasts } from '../Toast';
import type { ResumeVersion } from './document';
import { parseLatexToProfile, escapeLatex } from './latexProfile';

const LatexEditor = lazy(() =>
  import('../studio/LatexEditor').then((m) => ({ default: m.LatexEditor })),
);

const PdfViewer = lazy(() =>
  import('./PdfViewer').then((m) => ({ default: m.PdfViewer })),
);

const VisualEditor = lazy(() =>
  import('./VisualEditor').then((m) => ({ default: m.VisualEditor })),
);

interface WorkspaceProps {
  initialData: AdaptedResult;
  onClose: () => void;
}

const versionsKey = (id: string) => `resume_versions_${id}`;

async function readVersions(id: string): Promise<ResumeVersion[]> {
  const key = versionsKey(id);
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get(key);
      return (stored[key] as ResumeVersion[]) || [];
    } catch {
      return [];
    }
  }
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ResumeVersion[]) : [];
  } catch {
    return [];
  }
}

async function writeVersions(id: string, versions: ResumeVersion[]): Promise<void> {
  const key = versionsKey(id);
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      await chrome.storage.local.set({ [key]: versions });
      return;
    } catch {
      // cai no localStorage
    }
  }
  localStorage.setItem(key, JSON.stringify(versions));
}

function newHistoryItem(data: AdaptedResult): HistoryItem {
  return {
    id: data.adaptation.id,
    title: data.job.title,
    company: data.job.company,
    location: data.job.location,
    url: data.job.url,
    match_score: data.adaptation.match_score ?? 0,
    pdf_path: data.adaptation.pdf_url,
    recruiter_pitch: '',
    created_at: new Date().toISOString(),
  };
}

/** Trecho do .tex onde um campo vive, para não substituir o texto errado. */
function scopeFor(tex: string, fieldId: string): string {
  const key = fieldId.split('.')[0];
  if (key === 'personal') {
    const a = tex.indexOf('\\begin{center}');
    const b = tex.indexOf('\\end{center}');
    if (a >= 0 && b > a) return tex.slice(a, b);
    return tex;
  }
  if (key === 'summary') {
    const m = /\\section\{[^}]*(?:resumo|summary)[^}]*\}/i.exec(tex);
    if (!m) return tex;
    const next = /\\section\{/g;
    next.lastIndex = m.index + m[0].length;
    const n = next.exec(tex);
    return tex.slice(m.index, n ? n.index : tex.length);
  }
  const map: Record<string, string> = {
    experience: 'experi',
    leadership: 'lideran',
    education: 'educa',
    projects: 'projeto',
    certifications: 'certific',
    skills: 'habilidade',
    languages: 'habilidade',
  };
  const needle = map[key];
  if (!needle) return tex;
  const re = new RegExp(`\\\\section\\{[^}]*${needle}[^}]*\\}`, 'i');
  const m = re.exec(tex);
  if (!m) return tex;
  const next = /\\section\{/g;
  next.lastIndex = m.index + m[0].length;
  const n = next.exec(tex);
  return tex.slice(m.index, n ? n.index : tex.length);
}

export function Workspace({ initialData, onClose }: WorkspaceProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [current, setCurrent] = useState<AdaptedResult>(initialData);
  const [profile, setProfile] = useState<CandidateProfile>(
    initialData.adaptation.tailored_profile,
  );
  const [pdfUrl, setPdfUrl] = useState(absUrl(initialData.adaptation.pdf_url));
  const [rawTex, setRawTex] = useState(initialData.adaptation.tex_code);
  const [view, setView] = useState<WorkspaceView>('pdf');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [capturing, setCapturing] = useState(false);
  const [showAiSetup, setShowAiSetup] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [undoStack, setUndoStack] = useState<CandidateProfile[]>([]);
  const [redoStack, setRedoStack] = useState<CandidateProfile[]>([]);
  const skipSave = useRef(true);
  const lastCompiledTex = useRef(initialData.adaptation.tex_code);
  const fromTexRef = useRef(false);
  const savedSnapshot = useRef<{ tex: string; profile: CandidateProfile } | null>(null);
  if (savedSnapshot.current === null) {
    savedSnapshot.current = { tex: initialData.adaptation.tex_code, profile };
  }
  const pdfProfile = useMemo(() => parseLatexToProfile(rawTex, profile), [rawTex, profile]);
  const { items: toasts, push: toast, dismiss } = useToasts();

  const loadHistory = async () => {
    try {
      setHistory(await fetchHistory());
    } catch {
      // mantém o histórico vazio
    }
  };

  useEffect(() => {
    void loadHistory();
    void readVersions(initialData.adaptation.id).then(setVersions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void readVersions(current.adaptation.id).then(setVersions);
  }, [current.adaptation.id]);

  useEffect(() => {
    let alive = true;
    fetchResumeDetail(current.adaptation.id)
      .then((detail) => {
        if (!alive) return;
        setPdfUrl(detail.adaptation.pdf_url);
        setRawTex(detail.adaptation.tex_code);
        lastCompiledTex.current = detail.adaptation.tex_code;
      })
      .catch(() => {
        // mantém a URL inicial
      });
    return () => {
      alive = false;
    };
  }, [current.adaptation.id]);

  const applyProfile = (next: CandidateProfile) => {
    if (JSON.stringify(next) === JSON.stringify(profile)) return;
    setUndoStack((prev) => [...prev.slice(-49), profile]);
    setRedoStack([]);
    setProfile(next);
  };

  const editField = (fieldId: string, value: string) => {
    const next = JSON.parse(JSON.stringify(profile)) as CandidateProfile;
    const parts = fieldId.split('.');
    if (parts[0] === 'personal') {
      (next.personal as unknown as Record<string, string>)[parts[1]] = value;
    } else if (parts[0] === 'summary') {
      next.summary = value;
    } else if (parts[0] === 'experience') {
      const index = Number(parts[1]);
      if (parts[2] === 'description') {
        next.experience[index].description[Number(parts[3])] = value;
      } else {
        (next.experience[index] as unknown as Record<string, string>)[parts[2]] = value;
      }
    } else if (parts[0] === 'leadership') {
      const index = Number(parts[1]);
      const list = [...(next.leadership || [])];
      if (parts[2] === 'description') {
        list[index].description[Number(parts[3])] = value;
      } else {
        (list[index] as unknown as Record<string, string>)[parts[2]] = value;
      }
      next.leadership = list;
    } else if (parts[0] === 'education') {
      const index = Number(parts[1]);
      (next.education[index] as unknown as Record<string, string>)[parts[2]] = value;
    } else if (parts[0] === 'skills') {
      next.skills[Number(parts[1])] = value;
    } else if (parts[0] === 'projects') {
      const list = [...(next.projects || [])];
      (list[Number(parts[1])] as unknown as Record<string, string>)[parts[2]] = value;
      next.projects = list;
    } else if (parts[0] === 'certifications') {
      const list = [...(next.certifications || [])];
      const index = Number(parts[1]);
      if (typeof list[index] === 'string') list[index] = { name: value } as never;
      else (list[index] as unknown as Record<string, string>).name = value;
      next.certifications = list;
    } else if (parts[0] === 'languages') {
      const list = [...(next.languages || [])];
      (list[Number(parts[1])] as unknown as Record<string, string>).name = value;
      next.languages = list;
    }
    applyProfile(next);
  };

  // Clique no PDF: reescreve o trecho no .tex (preserva o resto do arquivo).
  const editPdfField = (fieldId: string, value: string, previous: string) => {
    const oldEsc = escapeLatex(previous || '');
    const newEsc = escapeLatex(value || '');
    let nextTex = rawTex;

    if (fieldId === 'personal.name') {
      nextTex = rawTex.replace(
        /(\\LARGE\s*\\textbf\{)[\s\S]*?(\})/,
        (_m: string, a: string, b: string) => a + newEsc + b,
      );
    } else if (oldEsc) {
      const scope = scopeFor(rawTex, fieldId);
      const idx = scope.indexOf(oldEsc);
      if (idx >= 0) {
        const abs = rawTex.indexOf(scope) + idx;
        nextTex = rawTex.slice(0, abs) + newEsc + rawTex.slice(abs + oldEsc.length);
      }
    }

    if (nextTex === rawTex) {
      // não achou o texto exato no .tex: cai no perfil
      editField(fieldId, value);
      return;
    }
    setRawTex(nextTex);
    fromTexRef.current = true;
    setProfile(parseLatexToProfile(nextTex, profile));
    toast('Campo atualizado no LaTeX.', 'ok');
  };

  const undo = () => {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setRedoStack((prev) => [...prev, profile]);
    setUndoStack((prev) => prev.slice(0, -1));
    setProfile(previous);
  };

  const redo = () => {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setUndoStack((prev) => [...prev, profile]);
    setRedoStack((prev) => prev.slice(0, -1));
    setProfile(next);
  };

  const bustPdf = (url: string) =>
    `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;

  const saveProfile = async (profileToSave: CandidateProfile) => {
    setSaveStatus('saving');
    try {
      const res = await saveResumeEdit(current.adaptation.id, { profile: profileToSave });
      setPdfUrl(bustPdf(res.pdf_url));
      setRawTex(res.tex);
      lastCompiledTex.current = res.tex;
      setSaveStatus('saved');
      const list = [
        { id: Date.now(), at: Date.now(), profile: profileToSave },
        ...versions,
      ].slice(0, 20);
      setVersions(list);
      void writeVersions(current.adaptation.id, list);
      setHistory((prev) =>
        prev.map((item) =>
          item.id === current.adaptation.id
            ? { ...item, match_score: current.adaptation.match_score ?? item.match_score }
            : item,
        ),
      );
    } catch (err: unknown) {
      setSaveStatus('error');
      const message = err instanceof Error ? err.message : 'Não salvou.';
      toast(message, 'error');
    }
  };

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (fromTexRef.current) {
      fromTexRef.current = false;
      return;
    }
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      void saveProfile(profile);
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, current.adaptation.id]);

  // LaTeX → perfil: mantém o visual e o chat coerentes quando o .tex é editado
  // direto. Não persiste o perfil; quem manda é o .tex.
  useEffect(() => {
    if (view !== 'latex') return;
    const timer = setTimeout(() => {
      const parsed = parseLatexToProfile(rawTex, profile);
      if (JSON.stringify(parsed) !== JSON.stringify(profile)) {
        fromTexRef.current = true;
        setProfile(parsed);
      }
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTex, view]);

  useEffect(() => {
    return onCaptureResult(
      (result) => {
        const data = result as AdaptedResult;
        if (isExtension) {
          try {
            void chrome.storage.local.remove('resume_capture_result');
          } catch {}
        }
        skipSave.current = true;
        setCurrent(data);
        setProfile(data.adaptation.tailored_profile);
        setPdfUrl(data.adaptation.pdf_url);
        setRawTex(data.adaptation.tex_code);
        lastCompiledTex.current = data.adaptation.tex_code;
        setUndoStack([]);
        setRedoStack([]);
        setHistory((prev) => [newHistoryItem(data), ...prev.filter((i) => i.id !== data.adaptation.id)]);
        setCapturing(false);
        toast('Currículo pronto.', 'ok');
      },
      (message) => {
        setCapturing(false);
        toast(message, 'error');
      },
      () => setCapturing(false),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectItem = async (item: HistoryItem) => {
    try {
      const detail = await fetchResumeDetail(item.id);
      skipSave.current = true;
      setCurrent(detail);
      setProfile(detail.adaptation.tailored_profile);
      setPdfUrl(detail.adaptation.pdf_url);
      setRawTex(detail.adaptation.tex_code);
      lastCompiledTex.current = detail.adaptation.tex_code;
      setUndoStack([]);
      setRedoStack([]);
      void readVersions(detail.adaptation.id).then(setVersions);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não abri essa candidatura.';
      toast(message, 'error');
    }
  };

  const capture = async () => {
    if (!isExtension) {
      toast('Captura só funciona dentro da extensão.', 'error');
      return;
    }
    setCapturing(true);
    try {
      try {
        const health = await fetchHealth();
        if (!health.has_api_key) {
          setShowAiSetup(true);
          setCapturing(false);
          return;
        }
      } catch {
        // Sem health, segue e deixa o pipeline decidir.
      }
      const url = current.job.url;
      if (!url) {
        await startAutoCapture();
        return;
      }
      const tabs = await chrome.tabs.query({ url });
      let tab = tabs[0];
      if (!tab?.id) {
        tab = await chrome.tabs.create({ url });
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      if (!tab.id) throw new Error('Não encontrei a aba da vaga.');
      const ack = await chrome.tabs.sendMessage(tab.id, { type: 'resume-capture-auto' });
      if (!ack?.ok) {
        const error = new Error(ack?.error || 'Não achei a vaga sozinho.');
        (error as Error & { fallback?: string }).fallback = ack?.fallback;
        throw error;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'A captura falhou.';
      toast(message, 'error');
      setCapturing(false);
    }
  };

  const downloadPdf = async () => {
    try {
      const res = await saveResumeEdit(current.adaptation.id, { tex_code: rawTex });
      setPdfUrl(res.pdf_url);
      setRawTex(res.tex);
      const anchor = document.createElement('a');
      anchor.href = res.pdf_url;
      anchor.download =
        current.adaptation.pdf_filename ||
        cvFilename(profile.personal.name, current.job.title, current.job.company);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      toast('PDF baixado.', 'ok');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não consegui gerar o PDF.';
      toast(message, 'error');
    }
  };

  const compileLatex = async (silent = false) => {
    try {
      const res = await saveResumeEdit(current.adaptation.id, { tex_code: rawTex });
      setPdfUrl(bustPdf(res.pdf_url));
      setRawTex(res.tex);
      lastCompiledTex.current = res.tex;
      savedSnapshot.current = { tex: res.tex, profile };
      if (!silent) toast('PDF atualizado.', 'ok');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não compilei o PDF.';
      if (!silent) toast(message, 'error');
    }
  };

  useEffect(() => {
    if (view !== 'latex') return;
    if (rawTex === lastCompiledTex.current) return;
    const timer = setTimeout(() => {
      void compileLatex(true);
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTex, view]);

  const restoreVersion = (version: ResumeVersion) => {
    applyProfile(version.profile);
    toast('Versão restaurada.', 'ok');
  };

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-wash text-ink">
      <CommandBar
        title={current.job.title}
        company={current.job.company}
        saveStatus={saveStatus}
        view={view}
        onViewChange={setView}
        onCapture={() => void capture()}
        onDownload={() => void downloadPdf()}
        onUndo={undo}
        onRedo={redo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((open) => !open)}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((open) => !open)}
        onClose={onClose}
      />

      <div className="flex min-h-0 flex-1">
        <NavPane
          history={history}
          currentId={current.adaptation.id}
          capturing={capturing}
          onSelect={(item) => void selectItem(item)}
          onCapture={() => void capture()}
        />

        {inspectorOpen && (
          <div className="hidden h-full w-[300px] shrink-0 border-r border-line bg-white lg:block">
            <Inspector
              versions={versions}
              onRestore={restoreVersion}
              saveStatus={saveStatus}
            />
          </div>
        )}

        <main className="relative min-w-0 flex-1 overflow-hidden">
          {view === 'visual' && (
            <div className="h-full">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center bg-white text-xs text-muted">
                    Carregando editor visual…
                  </div>
                }
              >
                <VisualEditor profile={profile} onChange={applyProfile} />
              </Suspense>
            </div>
          )}

          {view === 'latex' && (
            <div className="h-full p-4">
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
                  onSave={() => void compileLatex()}
                  errorMessage={saveStatus === 'error' ? 'Não salvou. Tente de novo.' : undefined}
                />
              </Suspense>
            </div>
          )}

          {view === 'pdf' && (
            <div className="h-full overflow-hidden bg-wash">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center bg-white text-xs text-muted">
                    Carregando PDF…
                  </div>
                }
              >
                <PdfViewer
                  pdfUrl={pdfUrl}
                  profile={pdfProfile}
                  onEditField={editPdfField}
                  onOpenCode={() => setView('latex')}
                />
              </Suspense>
            </div>
          )}

          {showAiSetup && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/95 p-6">
              <div className="w-full max-w-md rounded-xl border border-line bg-white p-6 shadow-mac">
                <div className="mb-3 flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted" />
                  <h2 className="text-lg font-semibold">Configure a IA primeiro</h2>
                </div>
                <p className="mb-4 text-2xs leading-relaxed text-muted">
                  Sem IA, o currículo não é adaptado. Faça:
                </p>
                <ol className="mb-5 list-decimal space-y-1 pl-5 text-2xs text-muted-strong">
                  <li>Abra Ajustes no painel lateral.</li>
                  <li>Escolha o provedor e o modelo.</li>
                  <li>Cole a chave de API e teste.</li>
                  <li>Volte para Capturar.</li>
                </ol>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAiSetup(false)}
                    className="brutal-btn px-3 py-2 text-2xs"
                  >
                    Agora não
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAiSetup(false);
                      onClose();
                    }}
                    className="brutal-btn-yellow px-3 py-2 text-2xs"
                  >
                    Abrir ajustes
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {chatOpen && (
          <div className="hidden h-full w-[360px] shrink-0 border-l border-line bg-white lg:block">
            <ChatPanel
              resumeId={current.adaptation.id}
              job={current.job}
              profile={profile}
              onProfileChange={applyProfile}
              onToast={toast}
              matchScore={current.adaptation.match_score ?? 0}
              atsCoverage={current.adaptation.ats?.coverage ?? null}
            />
          </div>
        )}
      </div>

      <ToastStack items={toasts} onDismiss={dismiss} />
    </div>
  );
}