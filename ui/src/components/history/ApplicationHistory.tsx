import { useEffect, useState } from 'react';
import {
  Download,
  Maximize2,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  fetchHistory,
  fetchResumeDetail,
  deleteResume,
  resumePdfUrl,
} from '../../services/api';
import { saveStudioPayload, openStudioTab } from '../../chrome';

export const ApplicationHistory: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await fetchHistory();
      setHistory(data);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6 select-none overflow-y-auto h-full">
      <div className="flex items-end justify-between mb-6 hairline-b pb-4">
        <div>
          <h1 className="font-editorial text-2xl text-black leading-[1.05] tracking-tight">
            Arquivo de candidaturas
          </h1>
          <p className="text-xs text-neutral-600 mt-1 font-mono">
            Cada linha é um currículo adaptado — edite no Estúdio ou baixe o PDF.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-600">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-xs font-mono uppercase">Carregando histórico...</span>
        </div>
      ) : history.length === 0 ? (
        <div className="py-20 text-center brutal-card p-8">
          <h3 className="font-editorial text-xl normal-case">Nenhuma vaga adaptada ainda</h3>
          <p className="text-xs text-neutral-600 mt-2 max-w-sm mx-auto font-mono">
            Abra uma vaga no navegador e use Captura.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
        <table className="ledger-table w-full">
          <thead>
            <tr className="border-b-2 border-black text-[10px] uppercase tracking-wider text-neutral-600">
              <td className="py-2 font-bold">Vaga / Empresa</td>
              <td className="py-2 font-bold">Data</td>
              <td className="py-2 font-bold text-right">ATS</td>
              <td className="py-2 font-bold text-right">Ações</td>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                <td className="py-3 pr-4">
                  <div className="font-bold text-sm uppercase">{item.title}</div>
                  <div className="text-xs text-neutral-600">
                    na {item.company}{item.location ? ` — ${item.location}` : ''}
                  </div>
                </td>
                <td className="py-3 text-xs text-neutral-600 whitespace-nowrap">
                  {new Date(item.created_at).toLocaleDateString('pt-BR')}
                </td>
                <td className="py-3 text-right whitespace-nowrap">
                  {item.match_score > 0 ? (
                    <span className="brutal-tag brutal-tag-yellow">
                      {item.match_score.toFixed(0)}%
                    </span>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
                <td className="py-3 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-2">
                    <a
                      href={resumePdfUrl(item.id)}
                      download={`Curriculo_${item.company}_${item.title}.pdf`}
                      className="brutal-btn flex items-center gap-1 px-3 py-1 text-[11px]"
                    >
                      <Download className="w-3 h-3" />
                      <span>PDF</span>
                    </a>
                    <button
                      onClick={async () => {
                        try {
                          const detail = await fetchResumeDetail(item.id);
                          await saveStudioPayload(detail);
                          openStudioTab();
                        } catch (err) {
                          console.error('Falha ao abrir no estúdio:', err);
                        }
                      }}
                      className="brutal-btn-yellow flex items-center gap-1 px-3 py-1 text-[11px]"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Estúdio</span>
                    </button>
                    {confirmDelete === item.id ? (
                      <button
                        onClick={async () => {
                          await deleteResume(item.id);
                          setHistory(history.filter((h) => h.id !== item.id));
                          setConfirmDelete(null);
                        }}
                        className="brutal-btn flex items-center gap-1 px-3 py-1 text-[11px]"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Confirmar</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(item.id)}
                        title="Remover do histórico"
                        className="brutal-btn p-1.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
};
