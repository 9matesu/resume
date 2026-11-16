import { useRef, useState } from 'react';
import { ArrowUp, Check, Copy, Sparkles, Trash2, X } from 'lucide-react';
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
  changes?: string[];
  applied?: boolean;
  discarded?: boolean;
  error?: boolean;
}

const SUGGESTIONS = [
  'Deixe o resumo mais direto para esta vaga.',
  'Reescreva as descrições com verbos de ação.',
  'Reduza o currículo para uma página.',
  'Ajuste as palavras-chave para o ATS.',
];

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
    text: `Estou com o currículo para ${job.title} na ${job.company}. Diga o que quer mudar e eu aplico só nessa versão.`,
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
    const userMsg: Message = { id: Date.now(), role: 'user', text: message };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    try {
      const res = await sendResumeChat(resumeId, message, profile);
      const changes = describeChanges(profile, res.profile);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          text: res.reply,
          profile: res.profile,
          changes,
        },
      ]);
      onToast('Sugestão pronta. Revise antes de aplicar.', 'ok');
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

  const applyMessage = (message: Message) => {
    if (!message.profile) return;
    onProfileChange(message.profile);
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, applied: true, discarded: false } : m)),
    );
    onToast('Sugestão aplicada ao currículo.', 'ok');
  };

  const discardMessage = (message: Message) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, discarded: true, applied: false } : m)),
    );
    onToast('Sugestão descartada.', 'info');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-wash">
      <div className="shrink-0 border-b border-line bg-white px-6 py-4">
        <div className="mx-auto flex w-full max-w-2xl items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-2xs font-semibold uppercase tracking-wide text-muted">
              Editando com IA
            </div>
            <div className="truncate text-sm font-semibold text-ink">{job.title}</div>
            <div className="text-2xs text-muted">na {job.company}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!!matchScore && matchScore > 0 && (
              <span className="brutal-tag brutal-tag-yellow">{matchScore.toFixed(0)}% match</span>
            )}
            {atsCoverage != null && (
              <span className="brutal-tag">{atsCoverage.toFixed(0)}% ATS</span>
            )}
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

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <div className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-muted">
            <Sparkles className="h-3.5 w-3.5" />
            Edição com IA
          </div>

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-black text-white'
                    : m.error
                      ? 'border border-danger/30 bg-danger-wash text-danger'
                      : 'border border-line bg-white text-ink shadow-mac'
                }`}
              >
                <p>{m.text}</p>

                {m.role === 'assistant' && m.changes && m.changes.length > 0 && !m.applied && !m.discarded && (
                  <div className="mt-3 border-t border-line pt-3">
                    <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted">
                      Mudanças
                    </div>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {m.changes.map((change) => (
                        <span key={change} className="brutal-tag">
                          {change}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => applyMessage(m)}
                        className="brutal-btn-yellow inline-flex items-center gap-1.5 px-3 py-1.5 text-2xs"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Aplicar
                      </button>
                      <button
                        type="button"
                        onClick={() => discardMessage(m)}
                        className="brutal-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-2xs"
                      >
                        <X className="h-3.5 w-3.5" />
                        Descartar
                      </button>
                    </div>
                  </div>
                )}

                {m.applied && (
                  <div className="mt-2 inline-flex items-center gap-1 text-2xs font-semibold text-ok">
                    <Check className="h-3.5 w-3.5" />
                    Aplicado ao currículo
                  </div>
                )}
                {m.discarded && (
                  <div className="mt-2 text-2xs font-semibold text-muted">Descartado</div>
                )}

                {m.role === 'assistant' && !m.applied && !m.discarded && (
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

      <div className="border-t border-line bg-white px-6 py-4">
        <div className="mx-auto flex w-full max-w-2xl items-end gap-2">
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