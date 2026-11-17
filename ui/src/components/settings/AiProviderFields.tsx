import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { detectModels, type ProviderInfo } from '../../services/api';

interface AiProviderFieldsProps {
  catalog: ProviderInfo[];
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  onProviderChange: (id: string) => void;
  onModelChange: (v: string) => void;
  onApiKeyChange: (v: string) => void;
  onBaseUrlChange: (v: string) => void;
  keyHint?: React.ReactNode;
  keyProviders?: string[];
}

const AUTH_URLS: Record<string, string> = {
  gemini: 'https://aistudio.google.com/app/apikey',
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  groq: 'https://console.groq.com/keys',
  openrouter: 'https://openrouter.ai/keys',
  together: 'https://api.together.xyz/settings/api-keys',
  mistral: 'https://console.mistral.ai/api-keys',
  deepseek: 'https://platform.deepseek.com/api_keys',
  xai: 'https://console.x.ai',
  nvidia: 'https://build.nvidia.com',
};

const LOCAL_PROVIDERS = new Set(['ollama', 'openai-compatible']);

export const AiProviderFields: React.FC<AiProviderFieldsProps> = ({
  catalog,
  provider,
  model,
  apiKey,
  baseUrl,
  onProviderChange,
  onModelChange,
  onApiKeyChange,
  onBaseUrlChange,
  keyHint,
  keyProviders = [],
}) => {
  const [models, setModels] = useState<string[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectMsg, setDetectMsg] = useState('');
  const autoDetectedFor = useRef('');
  const [authMode, setAuthMode] = useState<'key' | 'oauth'>('key');

  const entry = catalog.find((p) => p.id === provider);
  const listId = React.useId();

  const autoDetect = async (pvId: string, key: string, base: string, probe = false) => {
    if (!pvId) return;
    const ent = catalog.find((p) => p.id === pvId);
    setDetecting(true);
    setDetectMsg('');
    try {
      const { models: list, working } = await detectModels({
        ai_provider: pvId,
        // Só envia a chave se o usuário digitou uma. Se vazia, omite e
        // o backend usa a chave já salva para esse provedor.
        ...(key ? { ai_api_key: key } : {}),
        ai_base_url: base || ent?.default_base_url || '',
        ...(probe ? { probe: true } : {}),
      });
      setModels(list);
      const chosen = working || list[0] || '';
      if (chosen) {
        onModelChange(chosen);
        setDetectMsg(
          working
            ? `${list.length} modelos. Escolhi este, que responde: ${working}`
            : `${list.length} modelos. Escolhi o primeiro: ${list[0]}`,
        );
      } else {
        setDetectMsg('Não achei modelos. Digite o nome manualmente.');
      }
    } catch (err: any) {
      setModels([]);
      setDetectMsg(err.message || 'O provedor não listou modelos.');
    } finally {
      setDetecting(false);
    }
  };

  const handleProvider = (id: string) => {
    onProviderChange(id);
    onModelChange('');
    onApiKeyChange(''); // limpa campo visual; chave salva no SQLite permanece
    setModels([]);
    autoDetectedFor.current = id;
    const ent = catalog.find((p) => p.id === id);
    // Chave vazia → backend resolve api_key:<provider> do SQLite automaticamente
    void autoDetect(id, '', ent?.default_base_url || '');
  };

  // Primeira detecção automática quando o provedor chega do backend
  // e ainda não há modelo salvo (chave pode já estar no SQLite).
  useEffect(() => {
    if (!provider || model || !catalog.length) return;
    if (autoDetectedFor.current === provider) return;
    autoDetectedFor.current = provider;
    void autoDetect(provider, apiKey, baseUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, model, catalog]);

  return (
    <>
      <div>
        <label htmlFor="ai-provider" className="text-2xs font-bold uppercase tracking-wider block mb-1">Provedor de IA</label>
        <select id="ai-provider" value={provider} onChange={(e) => handleProvider(e.target.value)} className="brutal-input cursor-pointer">
          {catalog.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}{keyProviders.includes(p.id) ? ' · chave salva' : ''}
            </option>
          ))}
        </select>
      </div>

      {entry?.needs_key && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-2xs font-bold uppercase tracking-wider">Autenticação</span>
            <div className="flex items-center rounded-lg border border-line bg-wash p-0.5">
              <button
                type="button"
                onClick={() => setAuthMode('key')}
                className={`rounded-md px-2 py-1 text-2xs font-semibold ${
                  authMode === 'key' ? 'bg-white text-ink shadow-mac' : 'text-muted hover:text-black'
                }`}
              >
                Chave
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('oauth')}
                className={`rounded-md px-2 py-1 text-2xs font-semibold ${
                  authMode === 'oauth' ? 'bg-white text-ink shadow-mac' : 'text-muted hover:text-black'
                }`}
              >
                OAuth / SSO
              </button>
            </div>
          </div>
          {authMode === 'oauth' && (
            <div className="mb-2">
              {LOCAL_PROVIDERS.has(provider) ? (
                <p className="text-2xs leading-relaxed text-ok">
                  Provedor local: não precisa de chave. Basta salvar e usar.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const url = AUTH_URLS[provider];
                    if (url) window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                  className="brutal-btn w-full py-2 text-2xs"
                >
                  Conectar com {entry?.label || provider}
                </button>
              )}
            </div>
          )}
          <label htmlFor="ai-api-key" className="text-2xs font-bold uppercase tracking-wider block mb-1">
            {authMode === 'oauth' ? 'Access token (OAuth/SSO)' : 'Chave de API'} {keyHint}
          </label>
          <input
            id="ai-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={
              authMode === 'oauth'
                ? 'Token de acesso do provedor'
                : entry.key_hint || 'Insira a Chave de API'
            }
            className="brutal-input"
          />
          {authMode === 'oauth' && (
            <p className="mt-1 text-2xs leading-relaxed text-muted">
              O fluxo OAuth completo depende do provedor. Cole um access token válido
              ou use um provedor compatível.
            </p>
          )}
        </div>
      )}

      {entry?.custom_base && (
        <div>
          <label htmlFor="ai-base-url" className="text-2xs font-bold uppercase tracking-wider block mb-1">URL base (opcional)</label>
          <input
            id="ai-base-url"
            type="text"
            value={baseUrl}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            placeholder={entry.default_base_url || 'http://localhost:11434/v1'}
            className="brutal-input font-mono"
          />
        </div>
      )}

      <div>
        <label htmlFor="ai-model" className="text-2xs font-bold uppercase tracking-wider block mb-1">Modelo</label>
        <div className="flex items-center gap-2">
          <input
            id="ai-model"
            type="text"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            placeholder={detecting ? 'detectando...' : 'detectado automaticamente'}
            list={listId}
            className="brutal-input flex-1"
          />
          <datalist id={listId}>
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={() => void autoDetect(provider, apiKey, baseUrl, true)}
            disabled={detecting}
            className="brutal-btn px-3 py-2 text-11 shrink-0 flex items-center gap-1.5"
            title="Detectar modelos"
          >
            {detecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{detecting ? 'Lendo...' : 'Detectar'}</span>
          </button>
        </div>
        {detectMsg && <p className="text-11 text-muted mt-1 font-mono">{detectMsg}</p>}
      </div>
    </>
  );
};
