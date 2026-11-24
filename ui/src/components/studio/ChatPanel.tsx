import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, Copy, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import { sendResumeChat } from '../../services/api';
import type { CandidateProfile, JobData } from '../../services/api';

interface ChatPanelProps {
  resumeId: string;
  job: JobData;
  profile: CandidateProfile;
  onProfileChange: (profile: CandidateProfile) => void;
  onToast: (message: string, tone?: 'ok' | 'error' | 'info') => void;
  onClose: () => void;
  matchScore?: number;
  atsCoverage?: number | null;
  /** Contexto do alvo ("pleno, tom direto, área X"). Não vai para o currículo. */
  targetContext?: string;
  targetLabel?: string;
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  profile?: CandidateProfile;
  before?: CandidateProfile;
  changes?: string[];
  applied?: boolean;
  discarded?: boolean;
  error?: boolean;
}

interface DiffLine {
  type: 'add' | 'del' | 'ctx';
  text: string;
}

const SUGGESTIONS = [
  'Deixe o resumo mais direto para esta vaga.',
  'Reescreva as descrições com verbos de ação.',
  'Aproxime as palavras do anúncio sem inventar nada.',
  'Corte o que não fala com esta vaga.',
];

const STEPS = ['Lendo a vaga e o seu currículo', 'Reescrevendo só o que você pediu', 'Conferindo fatos e tamanho'];

function profileToLines(p: CandidateProfile): string[] {
  const out: string[] = [];
  const personal = p.personal || ({} as CandidateProfile['personal']);
  out.push(`name: ${personal.name || ''}`);
  out.push(`email: ${personal.email || ''}`);
  out.push(`phone: ${personal.phone || ''}`);
  out.push(`location: ${personal.location || ''}`);
  if (personal.linkedin) out.push(`linkedin: ${personal.linkedin}`);
  if (personal.github) out.push(`github: ${personal.github}`);
  if (personal.portfolio) out.push(`portfolio: ${personal.portfolio}`);
  out.push('');
  out.push('summary:');
  out.push(p.summary || '');
  out.push('');

  (p.experience || []).forEach((exp, i) => {
    out.push(`experience[${i}]: ${exp.title} | ${exp.company} | ${exp.period || ''}`);
    (exp.description || []).forEach((bullet) => out.push(`  - ${bullet}`));
  });

  (p.leadership || []).forEach((lead, i) => {
    out.push(`leadership[${i}]: ${lead.title} | ${lead.company} | ${lead.period || ''}`);
    (lead.description || []).forEach((bullet) => out.push(`  - ${bullet}`));
  });

  (p.education || []).forEach((edu, i) => {
    out.push(`education[${i}]: ${edu.institution} | ${edu.degree || ''} | ${edu.year || ''}`);
  });

  (p.projects || []).forEach((project, i) => {
    out.push(`project[${i}]: ${project.name}`);
  });

  out.push('');
  out.push(`skills: ${(p.skills || []).join(', ')}`);

  const certifications = (p.certifications || []).map((c) => (typeof c === 'string' ? c : c.name));
  if (certifications.length) out.push(`certifications: ${certifications.join(', ')}`);

  const languages = (p.languages || []).map((l) => (l.level ? `${l.name}: ${l.level}` : l.name));
  if (languages.length) out.push(`languages: ${languages.join(', ')}`);

  return out;
}

function diffLines(before: string[], after: string[]): DiffLine[] {
  const n = before.length;
  const m = after.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = before[i] === after[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      out.push({ type: 'ctx', text: before[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: before[i] });
      i++;
    } else {
      out.push({ type: 'add', text: after[j] });
      j++;
    }
  }
  while (i < n) {
    out.push({ type: 'del', text: before[i] });
    i++;
  }
  while (j < m) {
    out.push({ type: 'add', text: after[j] });
    j++;
  }
  return out;
}

function DiffBlock({ before, after }: { before: CandidateProfile; after: CandidateProfile }) {
  const lines = useMemo(
    () => diffLines(profileToLines(before), profileToLines(after)),
    [before, after],
  );
  const added = lines.filter((line) => line.type === 'add').length;
  const removed = lines.filter((line) => line.type === 'del').length;
  if (added + removed === 0) return null;

  return (
    <details className="mt-2.5 rounded-lg border border-line bg-wash">
      <summary className="cursor-pointer select-none px-2.5 py-1.5 text-2xs font-semibold text-muted-strong">
        Ver o que mudou
        <span className="ml-1.5 font-normal text-subtle">
          +{added} −{removed}
        </span>
      </summary>
      <div className="max-h-56 overflow-auto border-t border-line px-2.5 py-2 text-[10.5px] leading-relaxed ws-scroll-thin">
        {lines.map((line, index) => (
          <div
            key={index}
            className={
              line.type === 'add'
                ? 'text-ok'
                : line.type === 'del'
                  ? 'text-danger line-through decoration-danger/40'
                  : 'text-subtle'
            }
          >
            <span className="mr-2 inline-block w-2 select-none">
              {line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' '}
            </span>
            {line.text || ' '}
          </div>
        ))}
      </div>
    </details>
  );
}

function describeChanges(before: CandidateProfile, after: CandidateProfile): string[] {
  const changes: string[] = [];
  if (before.summary !== after.summary) changes.push('Resumo');
  if (JSON.stringify(before.experience) !== JSON.stringify(after.experience)) changes.push('Experiência');
  if (JSON.stringify(before.leadership) !== JSON.stringify(after.leadership)) changes.push('Liderança');
  if (JSON.stringify(before.education) !== JSON.stringify(after.education)) changes.push('Formação');
  if (JSON.stringify(before.skills) !== JSON.stringify(after.skills)) changes.push('Habilidades');
  if (JSON.stringify(before.projects) !== JSON.stringify(after.projects)) changes.push('Projetos');
  if (JSON.stringify(before.certifications) !== JSON.stringify(after.certifications)) {
    changes.push('Certificações');
  }
  if (JSON.stringify(before.languages) !== JSON.stringify(after.languages)) changes.push('Idiomas');
  return changes.length ? changes : ['Texto'];
}

/**
 * Chat de edição em folha lateral.
 *
 * A resposta já entra no currículo: o autosave recompila e o PDF muda atrás da
 * folha. Cada mensagem tem desfazer. O diff fica guardado, não aberto.
 */
export function ChatPanel({
  resumeId,
  job,
  profile,
  onProfileChange,
  onToast,
  onClose,
  matchScore,
  atsCoverage,
  targetContext,
  targetLabel,
}: ChatPanelProps) {
  const initialMessage: Message = useMemo(
    () => ({
      id: 1,
      role: 'assistant',
      text: `Estou com o currículo de ${job.title} na ${job.company}. Diga o que mudar. Eu aplico e você desfaz se não gostar.`,
    }),
    [job.title, job.company],
  );
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!sending) {
      setStep(0);
      return;
    }
    const timers = [
      window.setTimeout(() => setStep(1), 1200),
      window.setTimeout(() => setStep(2), 3200),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [sending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    const before = profile;
    const userMsg: Message = { id: Date.now(), role: 'user', text: message };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    scrollToBottom();
    try {
      const payload = targetContext ? `${targetContext}\n\n${message}` : message;
      const res = await sendResumeChat(resumeId, payload, profile);
      const changes = describeChanges(before, res.profile);
      onProfileChange(res.profile);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          text: res.reply,
          profile: res.profile,
          before,
          changes,
          applied: true,
        },
      ]);
      onToast('Aplicado ao currículo.', 'ok');
      scrollToBottom();
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : 'Não consegui editar.';
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', text, error: true },
      ]);
      onToast(text, 'error');
      scrollToBottom();
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const undoMessage = (message: Message) => {
    if (!message.before) return;
    onProfileChange(message.before);
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, discarded: true, applied: false } : m)),
    );
    onToast('Mudança desfeita.', 'info');
  };

  return (
    <div
      className="ws-sheet ws-sheet-right w-[400px] max-w-[96vw]"
      role="dialog"
      aria-label="Ajustar com IA"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted">
            <Sparkles className="h-3.5 w-3.5" />
            Ajustar com IA
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-ink">{job.title}</div>
          <div className="truncate text-2xs text-muted">na {job.company}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Limpar conversa"
            title="Limpar conversa"
            onClick={() => setMessages([initialMessage])}
            className="ws-icon-btn"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onClose} aria-label="Fechar chat" className="ws-icon-btn">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {(matchScore != null || atsCoverage != null) && (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-4 py-1.5">
          {matchScore != null && matchScore > 0 && (
            <span className="ws-chip h-6" data-tone={matchScore >= 70 ? 'ok' : matchScore >= 45 ? 'warn' : 'danger'}>
              {Math.round(matchScore)}% aderência
            </span>
          )}
          {atsCoverage != null && (
            <span
              className="ws-chip h-6"
              data-tone={atsCoverage >= 70 ? 'ok' : atsCoverage >= 45 ? 'warn' : 'danger'}
            >
              {Math.round(atsCoverage)}% ATS
            </span>
          )}
        </div>
      )}

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 ws-scroll-thin">
        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[94%] ws-bubble ${
                  m.role === 'user'
                    ? 'ws-bubble-user'
                    : m.error
                      ? 'border border-danger/30 bg-danger-wash text-danger'
                      : 'ws-bubble-ai'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>

                {m.role === 'assistant' && m.changes && m.changes.length > 0 && !m.discarded && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.changes.map((change) => (
                      <span
                        key={change}
                        className="rounded-full border border-line bg-wash px-1.5 py-0.5 text-[10px] font-semibold text-muted-strong"
                      >
                        {change}
                      </span>
                    ))}
                  </div>
                )}

                {m.role === 'assistant' && m.before && m.profile && !m.discarded && (
                  <DiffBlock before={m.before} after={m.profile} />
                )}

                {m.applied && !m.discarded && (
                  <div className="mt-2 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-2xs font-semibold text-ok">
                      <Check className="h-3 w-3" />
                      No currículo
                    </span>
                    {m.before && (
                      <button
                        type="button"
                        onClick={() => undoMessage(m)}
                        className="inline-flex items-center gap-1 text-2xs font-semibold text-muted underline underline-offset-4 hover:text-ink"
                      >
                        <Undo2 className="h-3 w-3" />
                        Desfazer
                      </button>
                    )}
                  </div>
                )}
                {m.discarded && <div className="mt-1.5 text-2xs font-semibold text-muted">Desfeito</div>}

                {m.role === 'assistant' && !m.discarded && (
                  <button
                    type="button"
                    aria-label="Copiar resposta"
                    title="Copiar"
                    onClick={() => {
                      void navigator.clipboard.writeText(m.text);
                      onToast('Resposta copiada.', 'ok');
                    }}
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-subtle hover:text-ink"
                  >
                    <Copy className="h-3 w-3" />
                    Copiar
                  </button>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-white p-3">
              {STEPS.map((label, index) => (
                <div key={label} className="ws-step" data-done={index < step ? 'true' : 'false'}>
                  {index < step ? (
                    <Check className="h-3.5 w-3.5 text-ok" />
                  ) : (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        index === step ? 'bg-mac-yellow ws-dot-pulse' : 'bg-line-strong'
                      }`}
                    />
                  )}
                  {label}
                </div>
              ))}
            </div>
          )}

          {!sending && messages.length === 1 && (
            <div className="flex flex-col gap-1.5 pt-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-left text-2xs leading-relaxed text-muted-strong transition-colors hover:border-line-strong hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-white px-3 py-2.5">
        {targetLabel && (
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-muted">
            <span className="rounded-full border border-line bg-wash px-1.5 py-0.5 font-semibold">
              Seu alvo
            </span>
            <span className="truncate">{targetLabel}</span>
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder="Peça uma mudança. Enter envia."
            aria-label="Mensagem para a IA"
            className="max-h-28 min-h-9 flex-1 resize-none rounded-xl border border-line bg-wash px-3 py-2 text-xs leading-relaxed text-ink outline-none transition-shadow placeholder:text-subtle focus:border-line-strong focus:bg-white focus:ring-2 focus:ring-brand/40"
          />
          <button
            type="button"
            aria-label="Enviar mensagem"
            onClick={() => void send(input)}
            disabled={!input.trim() || sending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white transition-transform active:scale-95 disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-subtle">
          Shift+Enter quebra linha. A mudança entra na hora; dá para desfazer em cada resposta.
        </p>
      </div>
    </div>
  );
}
