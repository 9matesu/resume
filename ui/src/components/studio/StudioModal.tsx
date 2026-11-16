import type { AdaptedResult } from '../../services/api';
import { detachStudio } from '../../chrome';
import { StudioWorkspace } from './StudioWorkspace';

interface StudioModalProps {
  data: AdaptedResult;
  onClose: () => void;
}

/** Estúdio em tela cheia dentro do painel, com opção de abrir em janela. */
export function StudioModal({ data, onClose }: StudioModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-white">
      <StudioWorkspace
        adaptedData={data}
        onClose={onClose}
        onDetach={() => {
          detachStudio();
          onClose();
        }}
      />
    </div>
  );
}