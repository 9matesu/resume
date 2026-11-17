import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchSettings, saveSettings, testAiConnection, fetchProviders, fetchMasterProfile, deleteMasterProfile, type ProviderInfo } from '../../services/api';
import type { AppSettings, MasterCandidate } from '../../services/api';
import { AiProviderFields } from './AiProviderFields';

export const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [catalog, setCatalog] = useState<ProviderInfo[]>([]);
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiModel, setAiModel] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [resumeFont, setResumeFont] = useState('lmodern');
  const [baseProfile, setBaseProfile] = useState<MasterCandidate | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [data, provs, prof] = await Promise.all([fetchSettings(), fetchProviders(), fetchMasterProfile()]);
      setSettings(data);
      setCatalog(provs);
      setAiProvider(data.ai_provider);
      setAiModel(data.ai_model);
      setAiBaseUrl(data.ai_base_url || '');
      setResumeFont(data.resume_font || 'lmodern');
      setBaseProfile(prof.has_profile && prof.candidate ? prof.candidate : null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const effectiveBaseUrl = () => {
    const ent = catalog.find((p) => p.id === aiProvider);
    return aiBaseUrl || ent?.default_base_url || '';
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await testAiConnection({
        ai_provider: aiProvider,
        ai_api_key: aiApiKey,
        ai_model: aiModel,
        ai_base_url: effectiveBaseUrl(),
      });
      setTestResult({ ok: true, message: 'Conectou.' });
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Falha na conexão' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings({
        ai_provider: aiProvider,
        ai_model: aiModel,
        ai_base_url: effectiveBaseUrl(),
        resume_font: resumeFont,
        ...(aiApiKey ? { ai_api_key: aiApiKey, provider_for_key: aiProvider } : {}),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setTestResult({ ok: false, message: 'Não salvei: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto w-full space-y-5 select-none">
      <div className="brutal-card p-5 space-y-5">
        <div className="hairline-b pb-3">
          <h2 className="text-sm font-bold uppercase tracking-tight">Ajustes de IA e PDF</h2>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <AiProviderFields
              catalog={catalog}
              provider={aiProvider}
              model={aiModel}
              apiKey={aiApiKey}
              baseUrl={aiBaseUrl}
              onProviderChange={setAiProvider}
              onModelChange={setAiModel}
              onApiKeyChange={setAiApiKey}
              onBaseUrlChange={setAiBaseUrl}
              keyProviders={settings?.key_providers || []}
              keyHint={
                settings?.key_providers?.includes(aiProvider) ? (
                  <span className="text-muted normal-case tracking-normal">
                    (Chave salva para este provedor.)
                  </span>
                ) : undefined
              }
            />

            {/* Testar conexão */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="brutal-btn w-full py-2 flex items-center justify-center gap-1.5"
              >
                {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{testing ? 'Testando…' : 'Testar Conexão com a IA'}</span>
              </button>
              {testResult && (
                <div className={`mt-2 p-2.5 flex items-center gap-2 border border-line-strong ${testResult.ok ? 'bg-brutal-yellow' : 'bg-white'}`}>
                  <span className="brutal-tag brutal-tag-black shrink-0">{testResult.ok ? 'OK' : 'Falha'}</span>
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            {/* Fonte do documento */}
            <div className="border border-line-strong p-4 space-y-3">
              <div className="font-bold uppercase mb-1">Documento</div>
              <label htmlFor="resume-font" className="text-2xs font-bold uppercase tracking-wider block mb-1">
                Fonte do currículo
              </label>
              <select
                id="resume-font"
                value={resumeFont}
                onChange={(e) => setResumeFont(e.target.value)}
                className="brutal-input cursor-pointer"
              >
                <option value="lmodern">Latin Modern (padrão LaTeX)</option>
                <option value="helvetica">Helvetica</option>
                <option value="times">Times</option>
                <option value="charter">Charter</option>
                <option value="libertine">Linux Libertine</option>
                <option value="tgheros">TeX Gyre Heros</option>
              </select>
              <p className="text-2xs leading-relaxed text-muted">
                A fonte vale para o PDF gerado pelo LaTeX. A prévia do documento
                acompanha a estrutura; o PDF final usa a fonte escolhida.
              </p>
            </div>

            {/* Currículo base */}
            <div className="border border-line-strong p-4">
              <div className="font-bold uppercase mb-1">Currículo base</div>
              {baseProfile ? (
                <div className="text-11 font-mono space-y-0.5 mb-3">
                  <div className="font-bold text-xs">{baseProfile.name}</div>
                  <div className="text-muted-strong">{baseProfile.email}</div>
                  {baseProfile.source_file && (
                    <div className="text-muted">arquivo: {baseProfile.source_file}</div>
                  )}
                </div>
              ) : (
                <div className="text-11 font-mono text-muted mb-3">nenhum perfil ativo</div>
              )}
              {baseProfile && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm('Isso remove o currículo base e o histórico ligado a ele. Quer continuar?')) return;
                    setSwapping(true);
                    try {
                      await deleteMasterProfile();
                      window.location.reload();
                    } catch (err: any) {
                      setTestResult({ ok: false, message: 'Não removi o perfil: ' + err.message });
                      setSwapping(false);
                    }
                  }}
                  disabled={swapping}
                  className="brutal-btn w-full py-2 text-11"
                >
                  {swapping ? 'Removendo...' : 'Remover currículo base'}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 hairline-t">
          {saved && <span className="brutal-tag brutal-tag-yellow mr-auto">Salvo</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="brutal-btn-yellow px-5 py-2 text-xs tracking-wider"
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  );
};
