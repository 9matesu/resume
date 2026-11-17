import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { KeyRound } from 'lucide-react';
import type {
  AdaptedResult,
  CandidateProfile,
  HistoryItem,
} from '../../services/api';
import {
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

const LatexEditor = lazy(() =>
  import('../studio/LatexEditor').then((m) => ({ default: m.LatexEditor })),
);

interface WorkspaceProps {
  initialData: AdaptedResult;
  onClose: () => void;
}

const inlinePdfUrl = (url: string) => `${url}${url.includes('?') ? '&' : '?'}inline=1`;

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

export function Workspace({ initialData, onClose }: WorkspaceProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [current, setCurrent] = useState<AdaptedResult>(initialData);
  const [profile, setProfile] = useState<CandidateProfile>(
    initialData.adaptation.tailored_profile,
  );
  const [pdfUrl, setPdfUrl] = useState(initialData.adaptation.pdf_url);
  const [rawTex, setRawTex] = useState(initialData.adaptation.tex_code);
  const [view, setView] = useState<WorkspaceView>('latex');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [capturing, setCapturing] = useState(false);
  const [showAiSetup, setShowAiSetup] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [undoStack, setUndoStack] = useState<CandidateProfile[]>([]);
  const [redoStack, setRedoStack] = useState<CandidateProfile[]>([]);
  const skipSave = useRef(true);
  const lastCompiledTex = useRef(initialData.adaptation.tex_code);
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

  const saveProfile = async (profileToSave: CandidateProfile) => {
    setSaveStatus('saving');
    try {
      const res = await saveResumeEdit(current.adaptation.id, { profile: profileToSave });
      setPdfUrl(res.pdf_url);
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
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      void saveProfile(profile);
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, current.adaptation.id]);

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
      const res = await saveResumeEdit(current.adaptation.id, { profile });
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
      setPdfUrl(res.pdf_url);
      setRawTex(res.tex);
      lastCompiledTex.current = res.tex;
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
    <div
      className="flex h-dvh w-full flex-col overflow-hidden bg-wash text-ink"
      style={
        {
          '--panel-offset': chatOpen ? '376px' : inspectorOpen ? '336px' : '16px',
        } as CSSProperties
      }
    >
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
        onToggleInspector={() => {
          setChatOpen(false);
          setInspectorOpen((open) => !open);
        }}
        chatOpen={chatOpen}
        onToggleChat={() => {
          setInspectorOpen(false);
          setChatOpen((open) => !open);
        }}
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

        <main className="relative min-w-0 flex-1 overflow-hidden">
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
            <div className="h-full overflow-auto bg-wash p-6">
              <div className="mx-auto h-full max-w-4xl overflow-hidden rounded-lg border border-line bg-white shadow-mac">
                {pdfUrl ? (
                  <iframe
                    src={inlinePdfUrl(pdfUrl)}
                    title="Prévia do PDF"
                    className="h-full w-full border-none"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">
                    Nenhum PDF gerado.
                  </div>
                )}
              </div>
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

        {chatOpen ? (
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
        ) : inspectorOpen ? (
          <Inspector
            versions={versions}
            onRestore={restoreVersion}
            saveStatus={saveStatus}
            onClose={onClose}
          />
        ) : null}
      </div>

      <ToastStack items={toasts} onDismiss={dismiss} />
    </div>
  );
}