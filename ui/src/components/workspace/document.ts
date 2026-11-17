import type {
  CandidateProfile,
  ResumeLayout,
  ResumeLayoutSection,
  ResumeSectionType,
} from '../../services/api';

export interface Selection {
  sectionId: string;
  blockId?: string;
}

export interface ResumeVersion {
  id: number;
  at: number;
  profile: CandidateProfile;
}

export const SECTION_LABELS: Record<ResumeSectionType, string> = {
  summary: 'Resumo',
  experience: 'Experiência',
  leadership: 'Liderança',
  projects: 'Projetos',
  education: 'Formação',
  skills: 'Habilidades',
  certifications: 'Certificações',
  languages: 'Idiomas',
};

export const DEFAULT_LAYOUT: ResumeLayout = {
  sections: [
    { id: 'summary', type: 'summary', visible: true },
    { id: 'experience', type: 'experience', visible: true },
    { id: 'leadership', type: 'leadership', visible: true },
    { id: 'projects', type: 'projects', visible: true },
    { id: 'education', type: 'education', visible: true },
    { id: 'skills', type: 'skills', visible: true },
    { id: 'certifications', type: 'certifications', visible: true },
    { id: 'languages', type: 'languages', visible: true },
  ],
};

export function getLayout(profile: CandidateProfile): ResumeLayout {
  return profile.layout?.sections?.length ? profile.layout : DEFAULT_LAYOUT;
}

export function sectionTitle(section: ResumeLayoutSection): string {
  return section.title || SECTION_LABELS[section.type] || section.id;
}

export function contactLine(profile: CandidateProfile): string {
  const p = profile.personal;
  return [p.email, p.phone, p.location, p.linkedin, p.github, p.portfolio]
    .filter(Boolean)
    .join(' · ');
}

export function moveSection(layout: ResumeLayout, sectionId: string, direction: -1 | 1): ResumeLayout {
  const sections = [...layout.sections];
  const index = sections.findIndex((s) => s.id === sectionId);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= sections.length) return layout;
  [sections[index], sections[next]] = [sections[next], sections[index]];
  return { sections };
}

export function reorderSection(layout: ResumeLayout, fromId: string, toId: string): ResumeLayout {
  const sections = [...layout.sections];
  const from = sections.findIndex((s) => s.id === fromId);
  const to = sections.findIndex((s) => s.id === toId);
  if (from < 0 || to < 0 || from === to) return layout;
  const [moved] = sections.splice(from, 1);
  sections.splice(to, 0, moved);
  return { sections };
}

export function updateSection(
  layout: ResumeLayout,
  sectionId: string,
  patch: Partial<ResumeLayoutSection>,
): ResumeLayout {
  return {
    sections: layout.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
  };
}

export function addExperience(profile: CandidateProfile): CandidateProfile {
  return {
    ...profile,
    experience: [
      ...profile.experience,
      { title: '', company: '', period: '', location: '', description: [''] },
    ],
  };
}

export function addEducation(profile: CandidateProfile): CandidateProfile {
  return {
    ...profile,
    education: [...profile.education, { institution: '', degree: '', year: '', location: '' }],
  };
}

export function addSkill(profile: CandidateProfile, skill: string): CandidateProfile {
  const value = skill.trim();
  if (!value || profile.skills.includes(value)) return profile;
  return { ...profile, skills: [...profile.skills, value] };
}