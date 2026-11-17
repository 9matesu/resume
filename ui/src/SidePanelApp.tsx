import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Loader2,
  Download,
  Maximize2,
} from 'lucide-react';
import {
  fetchHealth,
  fetchMasterProfile,
} from './services/api';
import type { AppHealth, CandidateProfile, AdaptedResult } from './services/api';
import {
  startCaptureSelection,
  cancelCaptureSelection,
  onCaptureResult,
  saveStudioPayload,
  ensureBackend,
  isExtension,
  detachStudio,
} from './chrome';
import { cvFilename } from './cvFilename';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { ApplicationHistory } from './components/history/ApplicationHistory';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { ActionButton, Stage, Skeleton } from './components/ActionButton';
import { ToastStack, useToasts } from './components/Toast';

type View = 'capture' | 'history' | 'settings';

const NAV: Array<{ id: View; label: string }> = [
  { id: 'capture', label: 'Captura' },
  { id: 'history', label: 'Arquivo' },
  { id: 'settings', label: 'Ajustes' },
];

export function SidePanelApp() {
  const [health, setHealth] = useState<AppHealth | null>(null);
  const [masterProfile, setMasterProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('capture');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AdaptedResult | null>(null);
  const [starting, setStarting] = useState(false);
  const autoEnsured = useRef(false);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const [stage, setStage] = useState<string | null>(null);
  const { items: toasts, push: toast, dismiss } = useToasts();

  const applyHealth = async (h: AppHealth) => {
    setHealth(h);
    if (h.has_active_candidate) {
      const p = await fetchMasterProfile();
      setMasterProfile(p.profile);
    } else {
      setMasterProfile(null);
    }
  };

  const pollHealth = async (ms: number): Promise<boolean> => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      try {
        await applyHealth(await fetchHealth());
        return true;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    return false;
  };

  const startBackend = async () => {
    setStarting(true);
    const res = await ensureBackend();
    const ok = await pollHealth(12000);
    if (!ok) console.warn('Backend não respondeu:', res.error);
    setStarting(false);
    return ok;
  };

  const init = async (): Promise<boolean> => {
    try {
      await applyHealth(await fetchHealth());
      return true;
    } catch {
      setHealth(null);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const consumePendingCapture = async () => {
    if (!isExtension) return;
    try {
      const stored = await chrome.storage.local.get('resume_capture_result');
      const pending = stored?.resume_capture_result as
        | { ok?: boolean; result?: unknown; error?: string; cancelled?: boolean }
        | undefined;
      if (!pending) return;
      await chrome.storage.local.remove('resume_capture_result');
      setBusy(false);
      setStage(null);
      if (pending.ok) {
        setResult(pending.result as AdaptedResult);
        toast('Currículo pronto.', 'ok');
      } else if (!pending.cancelled) {
        toast(String(pending.error || 'Falha na captura'), 'error');
      }
    } catch {
      // Se o storage estiver indisponível, o fluxo ao vivo continua funcionando.
    }
  };

  useEffect(() => {
    init().then((ok) => {
      if (!ok && isExtension && !autoEnsured.current) {
        autoEnsured.current = true;
        void startBackend();
      }
      void consumePendingCapture();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (!busy && !starting) init();
    }, 5000);
    return () => clearInterval(t);
  }, [busy, starting]);

  const clearPendingCapture = () => {
    if (!isExtension) return;
    try {
      void chrome.storage.local.remove('resume_capture_result');
    } catch {}
  };

  useEffect(
    () =>
      onCaptureResult(
        (r) => {
          clearPendingCapture();
          setResult(r as AdaptedResult);
          setBusy(false);
          setStage(null);
          toast('Currículo pronto.', 'ok');
        },
        (m) => {
          clearPendingCapture();
          toast(m, 'error');
          setBusy(false);
          setStage(null);
        },
        () => {
          clearPendingCapture();
          setBusy(false);
          setStage(null);
        }
      ),
    []
  );

  // Esc no sidepanel cancela a captura ativa na aba
  useEffect(() => {
    if (!busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void cancelCaptureSelection();
        setBusy(false);
        setStage(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy]);

  const handleDomCapture = async () => {
    if (health && !health.has_api_key) {
      const ok = window.confirm(
        'Você não configurou uma IA. Sem IA, o currículo será compilado sem adaptação. Quer continuar?',
      );
      if (!ok) {
        setView('settings');
        return;
      }
    }
    setBusy(true);
    setResult(null);
    setStage('select');
    try {
      await startCaptureSelection();
      setStage('select');
    } catch (e: any) {
      toast(e.message || 'A captura não iniciou.', 'error');
      setBusy(false);
      setStage(null);
    }
  };

  const STAGE_TEXT: Record<string, { label: string; detail: string }> = {
    read: { label: 'Lendo a vaga na página', detail: 'Leva um instante' },
    adapt: { label: 'Adaptando seu currículo', detail: `Usando ${health?.ai_model || health?.ai_provider || 'a sua IA'}` },
    select: { label: 'Clique no painel da vaga', detail: 'Esc cancela' },
  };

  const openStudio = async () => {
    if (!result) return;
    await saveStudioPayload(result);
    detachStudio();
    toast('Workspace aberto.', 'ok');
  };

  const handleDownload = () => {
    downloadRef.current?.click();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center gap-3 text-xs uppercase tracking-wider">
        <Loader2 className="w-5 h-5 animate-spin" />
        Iniciando…
      </div>
    );
  }

  if (!health) {
    if (starting) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-xs uppercase tracking-wider">
          <Loader2 className="w-6 h-6 animate-spin" />
          Iniciando…
        </div>
      );
    }
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center gap-4">
        <p className="text-sm font-bold">resuMe não está respondendo.</p>
        <p className="text-xs text-muted-strong leading-relaxed">
          Verifique se a extensão está instalada corretamente.
        </p>
        <button
          onClick={() => (isExtension ? startBackend() : void init())}
          className="brutal-btn px-4 py-2 text-xs"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!health.has_active_candidate || !masterProfile) {
    return (
      <div className="h-full flex flex-col bg-white">
        <OnboardingWizard health={health} onComplete={init} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white text-black select-none">
      {/* Nav */}
      <nav className="hairline-b grid grid-cols-3 text-11 uppercase font-bold shrink-0 divide-x divide-black">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            className={`py-2.5 cursor-pointer transition-colors ${
              view === n.id ? 'bg-black text-white' : 'bg-white hover:bg-wash'
            }`}
          >
            {n.label}
          </button>
        ))}
      </nav>

      {/* Body */}
      <main className="flex-1 overflow-y-auto p-5">
        {view === 'capture' && (
          <div className="flex min-h-full flex-col">
            {!result && (
              <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-black shadow-mac">
                  <Camera className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-editorial text-3xl leading-none">Capturar vaga</h2>
                  <p className="max-w-xs text-2xs leading-relaxed text-muted">
                    Leio a vaga na página e preparo a adaptação. Você revisa antes de enviar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDomCapture}
                  disabled={busy}
                  data-testid="auto-capture"
                  className="w-full max-w-xs bg-brand border border-line-strong rounded-xl p-4 flex items-center justify-center gap-2 active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer disabled:opacity-60"
                >
                  {busy ? <Loader2 className="spin h-5 w-5" /> : <Camera className="h-5 w-5" />}
                  <span className="font-editorial text-xl leading-none">Capturar Vaga</span>
                </button>
                <p className="text-2xs text-subtle">Alt+Shift+A também captura a aba ativa.</p>
              </div>
            )}

            {stage && !result && STAGE_TEXT[stage] && (
              <Stage label={STAGE_TEXT[stage].label} detail={STAGE_TEXT[stage].detail} />
            )}

            {busy && !result && !stage && <Skeleton rows={2} />}

            {result && (
              <div className="capture-in brutal-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-editorial text-lg normal-case leading-tight">{result.job.title}</h2>
                    <p className="text-11 text-muted-strong mt-0.5">
                      {result.job.company}
                      {result.job.location ? ` · ${result.job.location}` : ''}
                    </p>
                  </div>
                  {result.adaptation.match_score != null && result.adaptation.match_score > 0 && (
                    <span className="brutal-tag brutal-tag-yellow shrink-0">
                      {result.adaptation.match_score.toFixed(0)}%
                    </span>
                  )}
                </div>

                {result.adaptation.ats && (
                  <div className="hairline-b pb-3">
                    <div className="flex items-center justify-between text-2xs font-bold uppercase mb-1">
                      <span>Cobertura ATS</span>
                      <span>{result.adaptation.ats.coverage.toFixed(0)}%</span>
                    </div>
                    {result.adaptation.ats.missing.length > 0 && (
                      <p className="text-2xs text-muted">
                        Faltou: {result.adaptation.ats.missing.slice(0, 5).join(', ')}
                      </p>
                    )}
                  </div>
                )}

                {result.adaptation.honest_gaps && result.adaptation.honest_gaps.length > 0 && (
                  <p className="text-2xs text-muted-strong leading-relaxed">
                    <strong>Lacunas:</strong> {result.adaptation.honest_gaps.slice(0, 2).join(' ')}
                  </p>
                )}

                {(result.adaptation.applied_keywords?.length ?? 0) > 0 && (
                  <div className="hairline-b pb-3">
                    <div className="text-2xs font-bold uppercase mb-1.5">Palavras-chave</div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.adaptation.applied_keywords!.map((k) => (
                        <span key={k} className="brutal-tag">{k}</span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-2xs text-subtle">
                  revise o currículo antes de enviar
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    data-testid="download-pdf"
                    onClick={handleDownload}
                    className="brutal-btn-yellow flex items-center justify-center gap-1.5 px-2 py-2 text-11"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar PDF
                  </button>
                  <ActionButton
                    label="Abrir workspace"
                    icon={<Maximize2 className="w-3.5 h-3.5" />}
                    variant="solid"
                    onClick={openStudio}
                  />
                </div>
                <a
                  ref={downloadRef}
                  className="sr-only"
                  data-testid="download-anchor"
                  href={result.adaptation.pdf_url}
                  download={result.adaptation.pdf_filename || cvFilename(health.candidate_name || '', result.job.title, result.job.company)}
                >
                  {result.adaptation.pdf_filename || 'curriculo.pdf'}
                </a>
              </div>
            )}
          </div>
        )}

        {view === 'history' && <ApplicationHistory />}
        {view === 'settings' && <SettingsPanel />}
      </main>

      {/* Footer */}
      <footer className="hairline-t px-4 py-1.5 text-2xs text-muted flex items-center justify-end shrink-0">
        <span>{health.candidate_name}</span>
      </footer>

      <ToastStack items={toasts} onDismiss={dismiss} />
    </div>
  );
}

export default SidePanelApp;
