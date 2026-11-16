import { useRef, useState } from 'react';
import { ArrowUp, Sparkles } from 'lucide-react';
import { sendResumeChat } from '../../services/api';
import type { CandidateProfile, JobData } from '../../services/api';

interface ChatPanelProps {
  resumeId: string;
  job: JobData;
  profile: CandidateProfile;
  onProfileChange: (profile: CandidateProfile) => void;
  onToast: (message: string, tone?: 'ok' | 'error' | 'info') => void;
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = [
  'Deixe o resumo mais direto para esta vaga.',
  'Reescreva as descrições com verbos de ação.',
  'Reduza o currículo para uma página.',
];

export function ChatPanel({ resumeId, job, profile, onProfileChange, onToast }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      text: `Estou com o currículo para ${job.title} na ${job.company}. Diga o que quer mudar e eu aplico só nessa versão.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    const userMsg: Message = { id: Date.now(), role: 'user', text: message };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    try {
      const res = await sendResumeChat(resumeId, message, profile);
      onProfileChange(res.profile);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', text: res.reply },
      ]);
      onToast('Currículo atualizado.', 'ok');
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      });
    } catch (err: unknown) {
      const text = err instanceof Error ? err.message : 'Não consegui editar.';
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', text },
      ]);
      onToast(text, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-wash">
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <div className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-muted">
            <Sparkles className="h-3.5 w-3.5" />
            Edição com IA
          </div>
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-brand text-black'
                    : 'bg-white text-ink shadow-mac'
                }`}
              >
                {m.text}
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

      <div className="border-t border-line bg-white px-4 py-3">
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-black transition-transform active:scale-95 disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}