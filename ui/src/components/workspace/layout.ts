import type {
  AdaptedResult,
  CandidateProfile,
  ResumeLayout,
  ResumeLayoutSection,
  ResumeSectionType,
} from '../../services/api';

/**
 * Ordem e visibilidade das seções.
 *
 * O template LaTeX respeita `profile.layout.sections`: o PDF sai na ordem que
 * o usuário arrastou e seções com `visible: false` somem. `languages` não é
 * seção própria: idiomas aparecem dentro de Habilidades, como no template.
 */
export const RENDERED_SECTIONS: ResumeSectionType[] = [
  'summary',
  'experience',
  'leadership',
  'education',
  'projects',
  'skills',
  'certifications',
];

export const SECTION_LABEL: Record<string, string> = {
  summary: 'Resumo',
  experience: 'Experiência',
  leadership: 'Liderança',
  education: 'Formação',
  projects: 'Projetos',
  skills: 'Habilidades',
  certifications: 'Certificações',
  languages: 'Idiomas',
};

export const SECTION_HINT: Record<string, string> = {
  summary: 'Três linhas sobre você para esta vaga.',
  experience: 'Do cargo mais recente para o mais antigo.',
  leadership: 'Voluntariado, entidades, comunidades.',
  education: 'Curso, instituição e ano.',
  projects: 'O que você construiu e o resultado.',
  skills: 'Palavras-chave da vaga, sem inventar.',
  certifications: 'Certificados que existem de verdade.',
};

/** Layout normalizado: sempre todas as seções, na ordem salva. */
export function ensureLayout(profile: CandidateProfile): ResumeLayout {
  const existing = profile.layout?.sections || [];
  const seen = new Set<string>();
  const sections: ResumeLayoutSection[] = [];
  for (const section of existing) {
    const type = section?.type;
    if (!type || !RENDERED_SECTIONS.includes(type) || seen.has(type)) continue;
    seen.add(type);
    sections.push({ id: type, type, visible: section.visible !== false });
  }
  for (const type of RENDERED_SECTIONS) {
    if (seen.has(type)) continue;
    sections.push({ id: type, type, visible: true });
  }
  return { sections };
}

export function moveIndex<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.min(to, next.length), 0, item);
  return next;
}

export function moveSection(layout: ResumeLayout, from: number, to: number): ResumeLayout {
  return { sections: moveIndex(layout.sections, from, to) };
}

export function setSectionVisible(
  layout: ResumeLayout,
  type: ResumeSectionType,
  visible: boolean,
): ResumeLayout {
  return {
    sections: layout.sections.map((section) =>
      section.type === type ? { ...section, visible } : section,
    ),
  };
}

export interface SectionItem {
  index: number;
  label: string;
  sub?: string;
}

/** Itens arrastáveis de uma seção. Resumo não tem itens: é um texto só. */
export function itemsFor(profile: CandidateProfile, type: ResumeSectionType): SectionItem[] {
  const pick = (list?: Array<Record<string, unknown>>) =>
    (list || []).map((entry, index) => ({
      index,
      label: String(
        entry.title || entry.role || entry.name || entry.institution || `Item ${index + 1}`,
      ),
      sub: String(entry.company || entry.org || entry.degree || entry.period || '').trim() || undefined,
    }));

  switch (type) {
    case 'experience':
      return pick(profile.experience as unknown as Array<Record<string, unknown>>);
    case 'leadership':
      return pick(profile.leadership as unknown as Array<Record<string, unknown>>);
    case 'education':
      return pick(profile.education as unknown as Array<Record<string, unknown>>);
    case 'projects':
      return pick(profile.projects as unknown as Array<Record<string, unknown>>);
    case 'skills':
      return (profile.skills || []).map((skill, index) => ({ index, label: String(skill) }));
    case 'certifications':
      return (profile.certifications || []).map((cert, index) => ({
        index,
        label: typeof cert === 'string' ? cert : String(cert.name || `Certificado ${index + 1}`),
      }));
    default:
      return [];
  }
}

export function countFor(profile: CandidateProfile, type: ResumeSectionType): number {
  if (type === 'summary') return profile.summary ? 1 : 0;
  return itemsFor(profile, type).length;
}

export function reorderItems(
  profile: CandidateProfile,
  type: ResumeSectionType,
  from: number,
  to: number,
): CandidateProfile {
  switch (type) {
    case 'experience':
      return { ...profile, experience: moveIndex(profile.experience || [], from, to) };
    case 'leadership':
      return { ...profile, leadership: moveIndex(profile.leadership || [], from, to) };
    case 'education':
      return { ...profile, education: moveIndex(profile.education || [], from, to) };
    case 'projects':
      return { ...profile, projects: moveIndex(profile.projects || [], from, to) };
    case 'skills':
      return { ...profile, skills: moveIndex(profile.skills || [], from, to) };
    case 'certifications':
      return { ...profile, certifications: moveIndex(profile.certifications || [], from, to) };
    default:
      return profile;
  }
}

export function reorderSections(
  profile: CandidateProfile,
  from: number,
  to: number,
): CandidateProfile {
  return { ...profile, layout: moveSection(ensureLayout(profile), from, to) };
}

export function toggleSection(profile: CandidateProfile, type: ResumeSectionType): CandidateProfile {
  const layout = ensureLayout(profile);
  const current = layout.sections.find((section) => section.type === type);
  return {
    ...profile,
    layout: setSectionVisible(layout, type, !(current?.visible !== false)),
  };
}

/* ---------------------------------------------------------------------------
   Métricas explicadas
   --------------------------------------------------------------------------- */

export type MetricSource = 'medido' | 'estimado';
export type MetricTone = 'ok' | 'warn' | 'danger' | 'muted';

export interface MetricRow {
  id: 'fit' | 'ats' | 'length' | 'fresh';
  label: string;
  value: string;
  detail: string;
  source: MetricSource;
  tone: MetricTone;
}

export function toneForPercent(value: number): MetricTone {
  if (!Number.isFinite(value) || value <= 0) return 'muted';
  if (value >= 70) return 'ok';
  if (value >= 45) return 'warn';
  return 'danger';
}

export function relativeTime(timestamp: number | null, now = Date.now()): string {
  if (!timestamp) return 'sem registro';
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 5) return 'agora';
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}

export function atsPercent(ats: AdaptedResult['adaptation']['ats']): number | null {
  if (!ats || !ats.wanted) return null;
  return Math.max(0, Math.min(100, ats.coverage));
}

export function buildMetrics(input: {
  adaptation: AdaptedResult['adaptation'];
  pages: number;
  savedAt: number | null;
  now?: number;
}): MetricRow[] {
  const { adaptation, pages, savedAt, now = Date.now() } = input;
  const fit = Math.max(0, Math.min(100, Number(adaptation.match_score) || 0));
  const coverage = atsPercent(adaptation.ats);
  const ats = adaptation.ats;
  const engine = adaptation.engine;

  const fitDetail =
    engine === 'heuristic'
      ? 'Sem IA nesta captura: a heurística local alinhou o texto. Vale como piso, não como teto.'
      : 'A IA leu a vaga e o currículo final. Não é chance de contratação.';
  const atsDetail = !ats
    ? 'A vaga não trouxe palavras-chave para comparar.'
    : `${ats.covered.length} de ${ats.wanted} palavras-chave da vaga aparecem no currículo. Filtro automático lê isso antes de uma pessoa.`;

  return [
    {
      id: 'fit',
      label: 'Aderência',
      value: fit ? `${Math.round(fit)}%` : '—',
      detail: fitDetail,
      source: engine === 'heuristic' ? 'estimado' : 'medido',
      tone: toneForPercent(fit),
    },
    {
      id: 'ats',
      label: 'Cobertura ATS',
      value: coverage == null ? '—' : `${Math.round(coverage)}%`,
      detail: atsDetail,
      source: coverage == null ? 'estimado' : 'medido',
      tone: coverage == null ? 'muted' : toneForPercent(coverage),
    },
    {
      id: 'length',
      label: 'Tamanho',
      value: pages === 1 ? '1 página' : `${pages} páginas`,
      detail:
        pages === 1
          ? 'Cabe em uma página, o alvo de quem lê rápido.'
          : 'Passou de uma página. Corte o que não fala com esta vaga.',
      source: 'medido',
      tone: pages <= 1 ? 'ok' : 'warn',
    },
    {
      id: 'fresh',
      label: 'Última compilação',
      value: relativeTime(savedAt, now),
      detail: 'O PDF que você baixa é o que está na tela.',
      source: 'medido',
      tone: 'muted',
    },
  ];
}

/* ---------------------------------------------------------------------------
   Alvo do candidato: três respostas que ajustam as sugestões
   --------------------------------------------------------------------------- */

export type Seniority = 'primeiro' | 'pleno' | 'senior' | 'lideranca';
export type Tone = 'direto' | 'tecnico' | 'caloroso';

export interface TargetProfile {
  seniority: Seniority;
  tone: Tone;
  area: string;
}

export const DEFAULT_TARGET: TargetProfile = { seniority: 'pleno', tone: 'direto', area: '' };

export const SENIORITY_LABEL: Record<Seniority, string> = {
  primeiro: 'Primeira vaga',
  pleno: 'Pleno',
  senior: 'Sênior',
  lideranca: 'Liderança',
};

export const TONE_LABEL: Record<Tone, string> = {
  direto: 'Direto',
  tecnico: 'Técnico',
  caloroso: 'Caloroso',
};

const targetKey = (resumeId: string) => `resume_target_${resumeId}`;

export function readTarget(resumeId: string): TargetProfile {
  try {
    const raw = localStorage.getItem(targetKey(resumeId));
    if (!raw) return DEFAULT_TARGET;
    const parsed = JSON.parse(raw) as Partial<TargetProfile>;
    return {
      seniority: (parsed.seniority as Seniority) || DEFAULT_TARGET.seniority,
      tone: (parsed.tone as Tone) || DEFAULT_TARGET.tone,
      area: typeof parsed.area === 'string' ? parsed.area : '',
    };
  } catch {
    return DEFAULT_TARGET;
  }
}

export function writeTarget(resumeId: string, target: TargetProfile): void {
  try {
    localStorage.setItem(targetKey(resumeId), JSON.stringify(target));
  } catch {
    // Sem storage, o alvo vale só para esta sessão.
  }
}

/** Prefixo curto que o chat recebe junto da mensagem. Nada inventado. */
export function targetPrompt(target: TargetProfile): string {
  const bits = [`alvo: ${SENIORITY_LABEL[target.seniority]}`, `tom: ${TONE_LABEL[target.tone]}`];
  if (target.area.trim()) bits.push(`área: ${target.area.trim()}`);
  return `Contexto meu (não escreva isso no currículo): ${bits.join(', ')}.`;
}
