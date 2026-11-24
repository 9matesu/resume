import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { KeyRound } from 'lucide-react';
import type {
  AdaptedResult,
  CandidateProfile,
  HistoryItem,
  ResumeSectionType,
} from '../../services/api';
import {
  absUrl,
  fetchHealth,
  fetchHistory,
  fetchResumeDetail,
  saveResumeEdit,
} from '../../services/api';
import { isExtension, onCaptureResult, startAutoCapture } from '../../chrome';
import { cvFilename } from '../../cvFilename';
import { CommandBar } from './CommandBar';
import { HistorySheet } from './HistorySheet';
import { StructurePanel } from './StructurePanel';
import { MetricsPanel } from './MetricsPanel';
import { ChatPanel } from '../studio/ChatPanel';
import { ToastStack, useToasts } from '../Toast';
import type { ResumeVersion } from './document';
import { parseLatexToProfile, escapeLatex } from './latexProfile';
import {
  SENIORITY_LABEL,
  TONE_LABEL,
  atsPercent,
  readTarget,
  relativeTime,
  targetPrompt,
  writeTarget,
  type TargetProfile,
} from './layout';

const PdfViewer = lazy(() => import('./PdfViewer').then((m) => ({ default: m.PdfViewer })));

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

interface PendingSave {
  tex_code?: string;
  profile?: CandidateProfile;
}

export function Workspace({ initialData, onClose }: WorkspaceProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [current, setCurrent] = useState<AdaptedResult>(initialData);
  const [profile, setProfile] = useState<CandidateProfile>(initialData.adaptation.tailored_profile);
  const [pdfUrl, setPdfUrl] = useState(absUrl(initialData.adaptation.pdf_url));
  const [rawTex, setRawTex] = useState(initialData.adaptation.tex_code);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [pages, setPages] = useState(1);
  const [capturing, setCapturing] = useState(false);
  const [showAiSetup, setShowAiSetup] = useState(false);
  const [leftSheet, setLeftSheet] = useState<'history' | 'structure' | null>(null);
  const [rightSheet, setRightSheet] = useState<'metrics' | 'chat' | null>(null);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [undoStack, setUndoStack] = useState<CandidateProfile[]>([]);
  const [redoStack, setRedoStack] = useState<CandidateProfile[]>([]);
  const [target, setTarget] = useState<TargetProfile>(() =>
    readTarget(initialData.adaptation.id),
  );
  /** Pedido para abrir um campo no PDF, vindo da folha Estrutura. */
  const [focusRequest, setFocusRequest] = useState<{ fieldId: string; seq: number } | null>(null);

  const skipSave = useRef(true);
  const lastCompiledTex = useRef(initialData.adaptation.tex_code);
  const fromTexRef = useRef(false);
  const idRef = useRef(initialData.adaptation.id);
  const saveTimer = useRef<number | null>(null);
  const pending = useRef<PendingSave | null>(null);

  const pdfProfile = useMemo(() => parseLatexToProfile(rawTex, profile), [rawTex, profile]);
  const { items: toasts, push: toast, dismiss } = useToasts();
  const atsCoverage = atsPercent(current.adaptation.ats);
  const fitScore = current.adaptation.match_score ?? null;

  useEffect(() => {
    idRef.current = current.adaptation.id;
  }, [current.adaptation.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 20000);
    return () => window.clearInterval(timer);
  }, []);

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
    setTarget(readTarget(current.adaptation.id));
  }, [current.adaptation.id]);

  useEffect(() => {
    let alive = true;
    fetchResumeDetail(current.adaptation.id)
      .then((detail) => {
        if (!alive) return;
        setPdfUrl(detail.adaptation.pdf_url);
        setRawTex(detail.adaptation.tex_code);
        lastCompiledTex.current = detail.adaptation.tex_code;
        setCurrent((prev) => ({
          ...prev,
          adaptation: {
            ...prev.adaptation,
            ats: detail.adaptation.ats ?? prev.adaptation.ats,
            match_score: detail.adaptation.match_score ?? prev.adaptation.match_score,
          },
        }));
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
      const index = Number(parts[1]);
      if (parts[2] === 'description') {
        const description = list[index].description;
        const bullets = Array.isArray(description)
          ? [...description]
          : description
            ? [String(description)]
            : [];
        bullets[Number(parts[3])] = value;
        (list[index] as { description?: string[] }).description = bullets;
      } else {
        (list[index] as unknown as Record<string, string>)[parts[2]] = value;
      }
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

  const bustPdf = (url: string) => `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;

  const pushVersion = (saved: CandidateProfile) => {
    const id = idRef.current;
    setVersions((prev) => {
      const list = [{ id: Date.now(), at: Date.now(), profile: saved }, ...prev].slice(0, 20);
      void writeVersions(id, list);
      return list;
    });
  };

  const flushSave = async () => {
    const payload = pending.current;
    if (!payload) return;
    pending.current = null;
    setSaveStatus('saving');
    try {
      const res = await saveResumeEdit(idRef.current, payload);
      setPdfUrl(bustPdf(res.pdf_url));
      setRawTex(res.tex);
      lastCompiledTex.current = res.tex;
      setSaveStatus('saved');
      setSavedAt(Date.now());
      setCurrent((prev) => ({
        ...prev,
        adaptation: { ...prev.adaptation, ats: res.ats ?? prev.adaptation.ats },
      }));
      if (payload.profile) pushVersion(payload.profile);
    } catch (err: unknown) {
      setSaveStatus('error');
      const message = err instanceof Error ? err.message : 'Não salvou.';
      toast(message, 'error');
    }
  };

  const queueSave = (payload: PendingSave, delay = 800) => {
    pending.current = { ...(pending.current || {}), ...payload };
    setSaveStatus('saving');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void flushSave();
    }, delay);
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
    queueSave({ profile }, 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

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
    const nextProfile = parseLatexToProfile(nextTex, profile);
    setRawTex(nextTex);
    fromTexRef.current = true;
    setProfile(nextProfile);
    queueSave({ tex_code: nextTex, profile: nextProfile }, 500);
  };

  const undo = () => {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setRedoStack((prev) => [...prev, profile]);
    setUndoStack((prev) => prev.slice(0, -1));
    setProfile(previous);
    toast('Alteração desfeita.', 'info');
  };

  const redo = () => {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setUndoStack((prev) => [...prev, profile]);
    setRedoStack((prev) => prev.slice(0, -1));
    setProfile(next);
    toast('Alteração refeita.', 'info');
  };

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
        setPdfUrl(absUrl(data.adaptation.pdf_url));
        setRawTex(data.adaptation.tex_code);
        lastCompiledTex.current = data.adaptation.tex_code;
        setUndoStack([]);
        setRedoStack([]);
        setHistory((prev) => [
          newHistoryItem(data),
          ...prev.filter((item) => item.id !== data.adaptation.id),
        ]);
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
    if (item.id === current.adaptation.id) {
      setLeftSheet(null);
      return;
    }
    try {
      const detail = await fetchResumeDetail(item.id);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
      pending.current = null;
      skipSave.current = true;
      setCurrent(detail);
      setProfile(detail.adaptation.tailored_profile);
      setPdfUrl(bustPdf(detail.adaptation.pdf_url));
      setRawTex(detail.adaptation.tex_code);
      lastCompiledTex.current = detail.adaptation.tex_code;
      setUndoStack([]);
      setRedoStack([]);
      setLeftSheet(null);
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
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const queued = pending.current;
    pending.current = null;
    const payload: PendingSave = queued?.tex_code
      ? { tex_code: queued.tex_code, profile: queued.profile }
      : queued?.profile
        ? { profile: queued.profile }
        : { tex_code: rawTex };
    try {
      setSaveStatus('saving');
      const res = await saveResumeEdit(idRef.current, payload);
      setPdfUrl(bustPdf(res.pdf_url));
      setRawTex(res.tex);
      lastCompiledTex.current = res.tex;
      setSaveStatus('saved');
      setSavedAt(Date.now());
      if (payload.profile) pushVersion(payload.profile);
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
      setSaveStatus('error');
      const message = err instanceof Error ? err.message : 'Não consegui gerar o PDF.';
      toast(message, 'error');
    }
  };

  const restoreVersion = (version: ResumeVersion) => {
    applyProfile(version.profile);
    toast('Versão restaurada.', 'ok');
  };

  const confirmKeyword = (keyword: string) => {
    const clean = keyword.trim();
    if (!clean) return;
    const exists = (profile.skills || []).some(
      (skill) => String(skill).toLowerCase() === clean.toLowerCase(),
    );
    if (exists) {
      toast('Essa palavra já está em Habilidades.', 'info');
      return;
    }
    applyProfile({ ...profile, skills: [...(profile.skills || []), clean] });
    toast(`“${clean}” entrou em Habilidades.`, 'ok');
  };

  const changeTarget = (next: TargetProfile) => {
    setTarget(next);
    writeTarget(current.adaptation.id, next);
  };

  const openLeft = (sheet: 'history' | 'structure') => {
    setRightSheet(null);
    setLeftSheet((prev) => (prev === sheet ? null : sheet));
  };

  const openRight = (sheet: 'metrics' | 'chat') => {
    setLeftSheet(null);
    setRightSheet((prev) => (prev === sheet ? null : sheet));
  };

  /** Abre no PDF o primeiro campo da seção escolhida na folha Estrutura. */
  const editSection = (type: ResumeSectionType) => {
    const fieldId =
      type === 'summary'
        ? 'summary'
        : type === 'skills'
          ? 'skills.0'
          : type === 'certifications'
            ? 'certifications.0'
            : `${type}.0.title`;
    setLeftSheet(null);
    setFocusRequest({ fieldId, seq: Date.now() });
  };

  // Atalhos: ⌘K abre o chat, Esc fecha folha, ⌘Z/⇧⌘Z desfaz, ⌘S baixa.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (event.key === 'Escape') {
        setLeftSheet(null);
        setRightSheet(null);
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setLeftSheet(null);
        setRightSheet('chat');
        return;
      }
      if (typing) return;
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void downloadPdf();
        return;
      }
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const savedAgo = savedAt ? relativeTime(savedAt, now) : 'sem edição';
  const targetLabel = [
    SENIORITY_LABEL[target.seniority],
    TONE_LABEL[target.tone],
    target.area.trim(),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-wash text-ink">
      <CommandBar
        title={current.job.title}
        company={current.job.company}
        saveStatus={saveStatus}
        savedAgo={savedAgo}
        onDownload={() => void downloadPdf()}
        onUndo={undo}
        onRedo={redo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        fitScore={fitScore}
        atsCoverage={atsCoverage}
        leftSheet={leftSheet}
        rightSheet={rightSheet}
        onOpenHistory={() => openLeft('history')}
        onOpenStructure={() => openLeft('structure')}
        onOpenMetrics={() => openRight('metrics')}
        onToggleChat={() => openRight('chat')}
        onClose={onClose}
      />

      <main className="relative min-w-0 flex-1 overflow-hidden">
        <div className="h-full overflow-hidden">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-xs text-muted">
                Abrindo o documento…
              </div>
            }
          >
            <PdfViewer
              pdfUrl={pdfUrl}
              profile={pdfProfile}
              onEditField={editPdfField}
              onPages={setPages}
              focusRequest={focusRequest}
            />
          </Suspense>
        </div>

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

      {(leftSheet || rightSheet) && (
        <div
          className="ws-sheet-backdrop sm:hidden"
          onClick={() => {
            setLeftSheet(null);
            setRightSheet(null);
          }}
          aria-hidden="true"
        />
      )}

      {leftSheet === 'history' && (
        <HistorySheet
          history={history}
          currentId={current.adaptation.id}
          capturing={capturing}
          onSelect={(item) => void selectItem(item)}
          onCapture={() => void capture()}
          onClose={() => setLeftSheet(null)}
        />
      )}

      {leftSheet === 'structure' && (
        <StructurePanel
          profile={profile}
          onChange={applyProfile}
          onClose={() => setLeftSheet(null)}
          onEditSection={editSection}
          versions={versions}
          onRestore={restoreVersion}
        />
      )}

      {rightSheet === 'metrics' && (
        <MetricsPanel
          adaptation={current.adaptation}
          profile={profile}
          pages={pages}
          savedAt={savedAt}
          target={target}
          onTargetChange={changeTarget}
          onConfirmKeyword={confirmKeyword}
          onClose={() => setRightSheet(null)}
        />
      )}

      {rightSheet === 'chat' && (
        <ChatPanel
          resumeId={current.adaptation.id}
          job={current.job}
          profile={profile}
          onProfileChange={applyProfile}
          onToast={toast}
          onClose={() => setRightSheet(null)}
          matchScore={current.adaptation.match_score ?? undefined}
          atsCoverage={atsCoverage}
          targetContext={targetPrompt(target)}
          targetLabel={targetLabel}
        />
      )}

      <ToastStack items={toasts} onDismiss={dismiss} />
    </div>
  );
}
