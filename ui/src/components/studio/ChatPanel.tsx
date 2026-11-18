import { useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, Copy, Sparkles, Trash2, Undo2 } from 'lucide-react';
import { sendResumeChat } from '../../services/api';
import type { CandidateProfile, JobData } from '../../services/api';

interface ChatPanelProps {
  resumeId: string;
  job: JobData;
  profile: CandidateProfile;
  onProfileChange: (profile: CandidateProfile) => void;
  onToast: (message: string, tone?: 'ok' | 'error' | 'info') => void;
  matchScore?: number;
  atsCoverage?: number | null;
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
  'Aumente a cobertura ATS ao máximo.',
  'Reduza o currículo para uma página.',
];

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
  const lines = useMemo(() => diffLines(profileToLines(before), profileToLines(after)), [before, after]);
  const changed = lines.some((line) => line.type !== 'ctx');
  if (!changed) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-[#0d0d0d]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-[10px] text-white/50">diff · currículo.tex</span>
        <span className="font-mono text-[10px] text-white/30">
          {lines.filter((l) => l.type === 'add').length}+
          {lines.filter((l) => l.type === 'del').length}−
        </span>
      </div>
      <div className="max-h-72 overflow-auto whitespace-pre p-3 font-mono text-[10.5px] leading-relaxed">
        {lines.map((line, index) => (
          <div
            key={index}
            className={
              line.type === 'add'
                ? 'bg-emerald-500/10 text-emerald-300'
                : line.type === 'del'
                  ? 'bg-rose-500/10 text-rose-300'
                  : 'text-white/40'
            }
          >
            <span className="mr-3 inline-block w-5 select-none text-right text-white/20">
              {index + 1}
            </span>
            <span className="select-none">{line.type === 'add' ? '+ ' : line.type === 'del' ? '− ' : '  '}</span>
            {line.text || ' '}
          </div>
        ))}
      </div>
    </div>
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
  if (JSON.stringify(before.certifications) !== JSON.stringify(after.certifications)) changes.push('Certificações');
  if (JSON.stringify(before.languages) !== JSON.stringify(after.languages)) changes.push('Idiomas');
  return changes.length ? changes : ['Texto'];
}

export function ChatPanel({
  resumeId,
  job,
  profile,
  onProfileChange,
  onToast,
  matchScore,
  atsCoverage,
}: ChatPanelProps) {
  const initialMessage: Message = {
    id: 1,
    role: 'assistant',
    text: `Estou com o currículo de ${job.title} na ${job.company}. Diga o que mudar. Eu aplico.`,
  };
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

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
    try {
      const res = await sendResumeChat(resumeId, message, profile);
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
    <div className="flex h-full min-h-0 flex-col bg-wash">
      <div className="shrink-0 border-b border-line bg-white px-5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-muted">
              <Sparkles className="h-3.5 w-3.5" />
              Ajustes com IA
            </div>
            <div className="truncate text-sm font-semibold text-ink">{job.title}</div>
            <div className="text-2xs text-muted">na {job.company}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!!matchScore && matchScore > 0 && (
              <span className="brutal-tag brutal-tag-yellow">{matchScore.toFixed(0)}% match</span>
            )}
            {atsCoverage != null && <span className="brutal-tag">{atsCoverage.toFixed(0)}% ATS</span>}
            <button
              type="button"
              aria-label="Limpar conversa"
              title="Limpar conversa"
              onClick={() => setMessages([initialMessage])}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-wash hover:text-black"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
        <div className="flex flex-col gap-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-black text-white'
                    : m.error
                      ? 'border border-danger/30 bg-danger-wash text-danger'
                      : 'border border-line bg-white text-ink shadow-mac'
                }`}
              >
                <p>{m.text}</p>

                {m.role === 'assistant' && m.changes && m.changes.length > 0 && !m.discarded && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                    {m.changes.map((change) => (
                      <span key={change} className="brutal-tag">
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
                      <Check className="h-3.5 w-3.5" />
                      Aplicado ao currículo
                    </span>
                    {m.before && (
                      <button
                        type="button"
                        onClick={() => undoMessage(m)}
                        className="inline-flex items-center gap-1 text-2xs font-semibold text-muted underline underline-offset-4 hover:text-black"
                      >
                        <Undo2 className="h-3 w-3" />
                        Desfazer
                      </button>
                    )}
                  </div>
                )}
                {m.discarded && (
                  <div className="mt-2 text-2xs font-semibold text-muted">Desfeito</div>
                )}

                {m.role === 'assistant' && !m.discarded && (
                  <button
                    type="button"
                    aria-label="Copiar resposta"
                    title="Copiar"
                    onClick={() => {
                      void navigator.clipboard.writeText(m.text);
                      onToast('Resposta copiada.', 'ok');
                    }}
                    className="mt-2 flex h-6 w-6 items-center justify-center rounded-md text-subtle transition-colors hover:bg-wash hover:text-black"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
              Editando…
            </div>
          )}

          {!sending && messages.length === 1 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-left text-2xs text-muted-strong transition-colors hover:bg-wash"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line bg-white px-5 py-4">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder="Peça uma mudança. Enter envia, Shift+Enter quebra linha."
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-line bg-wash px-4 py-2.5 text-sm text-ink outline-none transition-shadow placeholder:text-subtle focus:border-line-strong focus:bg-white focus:ring-4 focus:ring-brand/25"
          />
          <button
            type="button"
            aria-label="Enviar mensagem"
            onClick={() => void send(input)}
            disabled={!input.trim() || sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white transition-transform active:scale-95 disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}