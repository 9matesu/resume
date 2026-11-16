import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { AdaptedResult } from './services/api';
import { loadStudioPayload } from './chrome';
import { Workspace } from './components/workspace/Workspace';

export function StudioApp() {
  const [data, setData] = useState<AdaptedResult | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    loadStudioPayload<AdaptedResult>().then((d) => {
      if (d) setData(d);
      else setMissing(true);
    });
  }, []);

  if (missing) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-white p-6 text-center text-black">
        <h1 className="font-editorial text-3xl">Nenhum resultado carregado</h1>
        <p className="max-w-md text-xs text-muted-strong leading-relaxed">
          Abra o painel lateral do resuMe, capture uma vaga e clique em “Abrir workspace”.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-dvh items-center justify-center gap-3 bg-white text-xs uppercase tracking-wider text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando workspace…
      </div>
    );
  }

  return <Workspace initialData={data} onClose={() => window.close()} />;
}

export default StudioApp;