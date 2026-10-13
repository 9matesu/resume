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
  startAutoCapture,
  cancelCaptureSelection,
  onCaptureResult,
  saveStudioPayload,
  openStudioTab,
  ensureBackend,
  isExtension,
} from './chrome';
import { cvFilename } from './cvFilename';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { ApplicationHistory } from './components/history/ApplicationHistory';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { ActionButton, TextButton, Stage, Skeleton } from './components/ActionButton';
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
  const [stage, setStage] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
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

  useEffect(() => {
    init().then((ok) => {
      if (!ok && isExtension && !autoEnsured.current) {
        autoEnsured.current = true;
        void startBackend();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (!busy && !starting) init();
    }, 5000);
    return () => clearInterval(t);
  }, [busy, starting]);

  useEffect(
    () =>
      onCaptureResult(
        (r) => {
          setResult(r as AdaptedResult);
          setBusy(false);
          setStage(null);
          toast('Currículo pronto.', 'ok');
        },
        (m) => {
          toast(m, 'error');
          setBusy(false);
          setStage(null);
        },
        () => {
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

  // Um botão só. O auto tenta primeiro; se não achar a vaga, ele cai sozinho
  // para a seleção manual. O link aparece só nesse caso, como escape.
  const handleCapture = async () => {
    setBusy(true);
    setResult(null);
    setStage('read');
    setShowManual(false);
    try {
      await startAutoCapture();
      setStage('adapt');
    } catch (e: any) {
      if ((e as any)?.fallback === 'manual') {
        setShowManual(true);
        toast('Não achei a vaga sozinho. Selecione o painel.', 'info');
        setBusy(false);
        setStage(null);
        return;
      }
      toast(e.message || 'A captura falhou.', 'error');
      setBusy(false);
      setStage(null);
    }
  };

  const handleDomCapture = async () => {
    setBusy(true);
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
    openStudioTab();
    toast('Estúdio aberto.', 'ok');
  };

  const handleDownload = () => {
    if (!result) return;
    toast('PDF baixado.', 'ok');
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
        <p className="text-xs text-neutral-600 leading-relaxed">
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

  const online = health.status === 'ok';

  return (
    <div className="h-full flex flex-col bg-white text-black select-none">
      {/* Header */}
      <header className="hairline-b px-4 py-2.5 flex items-center justify-between shrink-0">
        <span className="text-sm font-bold tracking-tight">resuMe</span>
        <span className="brutal-tag">
          <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-600'}`} />
          {online ? 'Online' : 'Offline'}
        </span>
      </header>

      {/* Nav */}
      <nav className="hairline-b grid grid-cols-3 text-[11px] uppercase font-bold shrink-0 divide-x divide-black">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            className={`py-2 cursor-pointer transition-colors ${
              view === n.id ? 'bg-black text-white' : 'bg-white hover:bg-neutral-100'
            }`}
          >
            {n.label}
          </button>
        ))}
      </nav>

      {/* Body */}
      <main className="flex-1 overflow-y-auto p-4">
        {view === 'capture' && (
          <div className="space-y-4">
            <button
              onClick={handleCapture}
              disabled={busy}
              data-testid="auto-capture"
              className="w-full bg-brutal-yellow border-2 border-black rounded-2xl p-6 text-left active:translate-x-[2px] active:translate-y-[2px] transition-transform cursor-pointer disabled:opacity-60"
            >
              <div className="flex items-center gap-2">
                {busy ? (
                  <Loader2 className="spin w-5 h-5" />
                ) : (
                  <Camera className="w-5 h-5" />
                )}
                <span className="font-editorial text-2xl leading-none">Capturar Vaga</span>
              </div>
            </button>

            {stage && STAGE_TEXT[stage] && (
              <Stage label={STAGE_TEXT[stage].label} detail={STAGE_TEXT[stage].detail} />
            )}

            {showManual && (
              <div className="flex items-center gap-2">
                <TextButton onClick={handleDomCapture} testId="manual-capture">
                  Não achou? Selecione o painel
                </TextButton>
              </div>
            )}

            {busy && !stage && <Skeleton rows={2} />}

            {result && (
              <div className="brutal-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-editorial text-lg normal-case leading-tight">{result.job.title}</h2>
                    <p className="text-[11px] text-neutral-600 mt-0.5">
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

                {(result.adaptation.applied_keywords?.length ?? 0) > 0 && (
                  <div className="hairline-b pb-3">
                    <div className="text-[10px] font-bold uppercase mb-1.5">Palavras-chave</div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.adaptation.applied_keywords!.map((k) => (
                        <span key={k} className="brutal-tag">{k}</span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-neutral-400">
                  revise o currículo antes de enviar
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    data-testid="download-pdf"
                    onClick={handleDownload}
                    className="brutal-btn-yellow flex items-center justify-center gap-1.5 px-2 py-2 text-[11px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar PDF
                  </button>
                  <ActionButton
                    label="Abrir Estúdio"
                    icon={<Maximize2 className="w-3.5 h-3.5" />}
                    variant="solid"
                    onClick={openStudio}
                  />
                </div>
                <a
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
      <footer className="hairline-t px-4 py-1.5 text-[10px] text-neutral-500 flex items-center justify-end shrink-0">
        <span>{health.candidate_name}</span>
      </footer>

      <ToastStack items={toasts} onDismiss={dismiss} />
    </div>
  );
}

export default SidePanelApp;
