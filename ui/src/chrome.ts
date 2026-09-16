export const BACKEND = 'http://127.0.0.1:8322';

export const isExtension =
  typeof chrome !== 'undefined' && !!chrome.runtime?.id;

export interface EnsureBackendResult {
  running?: boolean;
  spawned?: boolean;
  error?: string;
}

export async function ensureBackend(): Promise<EnsureBackendResult> {
  if (!isExtension) return { running: false, error: 'Fora da extensão.' };
  try {
    const res = (await chrome.runtime.sendNativeMessage('com.resume.host', {
      action: 'ensure-backend',
    })) as EnsureBackendResult;
    return res || { running: false, error: 'O host não respondeu.' };
  } catch (err: any) {
    return { running: false, error: String(err?.message || err) };
  }
}

export async function startCaptureSelection(): Promise<void> {
  if (!isExtension) throw new Error('Captura só funciona dentro da extensão.');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('Nenhuma aba ativa encontrada.');
  let ack: { ok?: boolean; error?: string } | undefined;
  try {
    ack = (await chrome.tabs.sendMessage(tab.id, { type: 'resume-capture-start' })) as
      | { ok?: boolean; error?: string }
      | undefined;
  } catch {
    throw new Error('Recarregue a página da vaga (F5) e tente de novo.');
  }
  if (!ack?.ok) throw new Error(ack?.error || 'Não deu para selecionar o painel.');
}

export function onCaptureResult(
  onResult: (result: unknown) => void,
  onError: (message: string) => void,
  onCancel: () => void
): () => void {
  if (!isExtension) return () => {};
  const listener = (msg: any) => {
    if (msg?.type !== 'resume-capture-result') return;
    if (msg.payload?.ok) onResult(msg.payload.result);
    else if (msg.payload?.cancelled) onCancel();
    else onError(String(msg.payload?.error || 'Falha na captura'));
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

const STUDIO_KEY = 'resume_studio';

export async function saveStudioPayload(data: unknown): Promise<void> {
  if (isExtension) await chrome.storage.local.set({ [STUDIO_KEY]: data });
  else localStorage.setItem(STUDIO_KEY, JSON.stringify(data));
}

export async function loadStudioPayload<T>(): Promise<T | null> {
  if (isExtension) {
    const d = await chrome.storage.local.get(STUDIO_KEY);
    return (d[STUDIO_KEY] as T) ?? null;
  }
  const raw = localStorage.getItem(STUDIO_KEY);
  return raw ? (JSON.parse(raw) as T) : null;
}

export function openStudioTab(): void {
  if (isExtension) {
    chrome.tabs.create({ url: chrome.runtime.getURL('studio.html') });
    // O editor abre em aba própria: fecha o painel lateral para liberar
    // a janela (Chrome 141+; sem close disponível, o painel apenas fica).
    try {
      chrome.sidePanel
        ?.close?.({ windowId: chrome.windows.WINDOW_ID_CURRENT })
        ?.catch?.(() => {});
    } catch {}
  } else {
    window.open('studio.html', '_blank');
  }
}
