import { ArrowRight, Camera, Download, FileText } from 'lucide-react';

interface WelcomeCardProps {
  onClose: () => void;
}

const STEPS = [
  {
    icon: Camera,
    title: 'Capture a vaga',
    text: 'Abra a vaga no navegador. O resuMe lê o painel e devolve o currículo.',
  },
  {
    icon: FileText,
    title: 'Revise',
    text: 'O currículo aparece na prévia. Ajuste o que quiser antes de baixar.',
  },
  {
    icon: Download,
    title: 'Baixe o PDF',
    text: 'PDF na saída, gerado por LaTeX. Ou abra o Estúdio para editar o código.',
  },
];

export function WelcomeCard({ onClose }: WelcomeCardProps) {
  return (
    <div className="border-b border-line bg-brand px-5 py-5">
      <div className="text-2xs font-bold uppercase tracking-wider text-black/70">
        Como funciona
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-brand">
              <step.icon className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-black">
                {index + 1}. {step.title}
              </div>
              <p className="text-2xs leading-relaxed text-black/70">{step.text}</p>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="brutal-btn mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-2xs"
      >
        Começar
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}