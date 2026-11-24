import { useMemo, useState } from 'react';
import { Check, Info, Target, X } from 'lucide-react';
import type { AdaptedResult, CandidateProfile } from '../../services/api';
import {
  SENIORITY_LABEL,
  TONE_LABEL,
  buildMetrics,
  type Seniority,
  type TargetProfile,
  type Tone,
} from './layout';

interface MetricsPanelProps {
  adaptation: AdaptedResult['adaptation'];
  profile: CandidateProfile;
  pages: number;
  savedAt: number | null;
  target: TargetProfile;
  onTargetChange: (target: TargetProfile) => void;
  onConfirmKeyword: (keyword: string) => void;
  onClose: () => void;
}

const TONE_CLASS: Record<string, string> = {
  ok: 'border-[#b6e3cf] bg-[#f0fbf6]',
  warn: 'border-[#f0dca8] bg-[#fffbf0]',
  danger: 'border-[#f3c4c4] bg-[#fff5f5]',
  muted: 'border-line bg-wash',
};

/**
 * Métricas com a conta aberta. Cada número diz de onde veio e o que não é.
 * As palavras que faltam têm resposta de um clique: "tenho" vira habilidade.
 */
export function MetricsPanel({
  adaptation,
  profile,
  pages,
  savedAt,
  target,
  onTargetChange,
  onConfirmKeyword,
  onClose,
}: MetricsPanelProps) {
  const metrics = useMemo(
    () => buildMetrics({ adaptation, pages, savedAt }),
    [adaptation, pages, savedAt],
  );
  const [dismissed, setDismissed] = useState<Record<string, true>>({});
  const ats = adaptation.ats;
  const missing = (ats?.missing || []).filter((keyword) => !dismissed[keyword]);
  const covered = ats?.covered || [];
  const skills = (profile.skills || []).map((skill) => String(skill).toLowerCase());

  const dismiss = (keyword: string) =>
    setDismissed((prev) => ({ ...prev, [keyword]: true }));

  return (
    <div
      className="ws-sheet ws-sheet-right w-[380px] max-w-[94vw]"
      role="dialog"
      aria-label="Métricas do currículo"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">Métricas</h2>
          <p className="mt-0.5 text-2xs leading-relaxed text-muted">
            O que o filtro automático e a IA leem no seu currículo.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar métricas" className="ws-icon-btn">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 ws-scroll-thin">
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              className={`rounded-xl border p-3 ${TONE_CLASS[metric.tone] || TONE_CLASS.muted}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-2xs font-semibold uppercase tracking-wide text-muted">
                  {metric.label}
                </span>
                <span
                  className={`shrink-0 rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${
                    metric.source === 'medido'
                      ? 'border-[#b6e3cf] bg-white text-ok'
                      : 'border-line bg-white text-muted'
                  }`}
                >
                  {metric.source}
                </span>
              </div>
              <div className="mt-1 text-xl font-semibold leading-none tracking-tight text-ink">
                {metric.value}
              </div>
              <p className="mt-1.5 text-2xs leading-relaxed text-muted-strong">{metric.detail}</p>
            </div>
          ))}
        </div>

        <section className="mt-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-2xs font-semibold uppercase tracking-wide text-muted">
              Palavras da vaga
            </h3>
            {ats && (
              <span className="text-2xs text-muted">
                {ats.covered.length}/{ats.wanted} no currículo
              </span>
            )}
          </div>

          {!ats || ats.wanted === 0 ? (
            <p className="mt-2 rounded-lg border border-line bg-wash p-3 text-2xs leading-relaxed text-muted">
              Esta vaga não trouxe palavras-chave. A cobertura ATS aparece na próxima captura que
              trouxer.
            </p>
          ) : (
            <>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wash-strong">
                <div
                  className="h-full rounded-full bg-black transition-[width] duration-300"
                  style={{ width: `${Math.round(ats.coverage)}%` }}
                />
              </div>

              {missing.length > 0 ? (
                <div className="mt-3 flex flex-col gap-1.5">
                  <p className="text-2xs leading-relaxed text-muted">
                    Faltando. Responder “tenho” adiciona a palavra ao perfil e recompila. Nada é
                    inventado.
                  </p>
                  {missing.map((keyword) => (
                    <div
                      key={keyword}
                      className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-2xs font-medium text-ink">
                        {keyword}
                      </span>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => onConfirmKeyword(keyword)}
                          className="inline-flex items-center gap-1 rounded-md bg-black px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#1a1a1a]"
                        >
                          <Check className="h-3 w-3" />
                          tenho
                        </button>
                        <button
                          type="button"
                          onClick={() => dismiss(keyword)}
                          className="rounded-md border border-line bg-white px-2 py-1 text-[10px] font-semibold text-muted hover:text-ink"
                        >
                          não
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 flex items-center gap-1.5 text-2xs font-semibold text-ok">
                  <Check className="h-3.5 w-3.5" />
                  Toda palavra da vaga aparece no currículo.
                </p>
              )}

              {covered.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-2xs font-semibold text-muted">Já no currículo</div>
                  <div className="flex flex-wrap gap-1">
                    {covered.map((keyword) => (
                      <span
                        key={keyword}
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${
                          skills.includes(keyword.toLowerCase())
                            ? 'border-[#b6e3cf] bg-[#f0fbf6] text-ink'
                            : 'border-line bg-wash text-muted-strong'
                        }`}
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section className="mt-5 border-t border-line pt-4">
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-muted" />
            <h3 className="text-2xs font-semibold uppercase tracking-wide text-muted">
              Seu alvo
            </h3>
          </div>
          <p className="mt-1 text-2xs leading-relaxed text-muted">
            Três respostas para o chat falar a sua língua. Isso não vai para o currículo.
          </p>

          <div className="mt-3">
            <div className="mb-1 text-2xs font-semibold text-ink">Momento</div>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(SENIORITY_LABEL) as Seniority[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onTargetChange({ ...target, seniority: key })}
                  aria-pressed={target.seniority === key}
                  className={`rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition-colors ${
                    target.seniority === key
                      ? 'border-black bg-black text-white'
                      : 'border-line bg-white text-muted-strong hover:text-ink'
                  }`}
                >
                  {SENIORITY_LABEL[key]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1 text-2xs font-semibold text-ink">Tom</div>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(TONE_LABEL) as Tone[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onTargetChange({ ...target, tone: key })}
                  aria-pressed={target.tone === key}
                  className={`rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition-colors ${
                    target.tone === key
                      ? 'border-black bg-black text-white'
                      : 'border-line bg-white text-muted-strong hover:text-ink'
                  }`}
                >
                  {TONE_LABEL[key]}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-3 block">
            <span className="mb-1 block text-2xs font-semibold text-ink">Área que você busca</span>
            <input
              type="text"
              value={target.area}
              onChange={(event) => onTargetChange({ ...target, area: event.target.value })}
              placeholder="Ex.: segurança da informação"
              className="brutal-input"
            />
          </label>
        </section>

        <p className="mt-5 flex items-start gap-1.5 rounded-lg border border-line bg-wash p-3 text-2xs leading-relaxed text-muted">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            Tudo é calculado no seu computador. Aderência é leitura da vaga, não probabilidade de
            contratação. Cobertura ATS conta palavra por palavra, do jeito que o filtro faz.
          </span>
        </p>
      </div>
    </div>
  );
}
