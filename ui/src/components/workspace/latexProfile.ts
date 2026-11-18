import type { CandidateProfile } from '../../services/api';

/**
 * Ponte LaTeX ↔ perfil.
 *
 * O resuMe gera o .tex a partir do perfil (backend). Quando o usuário edita o
 * .tex direto, este parser reconstrói o perfil para que o PDF e o clique
 * voltem a apontar para os campos certos. Não é um parser LaTeX completo:
 * cobre exatamente a estrutura do template (cventry, itemize, header).
 */

const LATEX_MAP: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '&': '\\&',
  '%': '\\%',
  '$': '\\$',
  '#': '\\#',
  '_': '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

export function escapeLatex(value: string): string {
  return String(value ?? '')
    .split('')
    .map((ch) => LATEX_MAP[ch] || ch)
    .join('');
}

export function unescapeLatex(value: string): string {
  return String(value ?? '')
    .replace(/\\textbackslash\{\}/g, '\\')
    .replace(/\\textasciitilde\{\}/g, '~')
    .replace(/\\textasciicircum\{\}/g, '^')
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\\$/g, '$')
    .replace(/\\#/g, '#')
    .replace(/\\_/g, '_')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/\\\\/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lê um grupo { ... } balanceado a partir do índice da abertura. */
function readBraceGroup(text: string, openIndex: number): { value: string; end: number } | null {
  if (text[openIndex] !== '{') return null;
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\') { i += 1; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { value: text.slice(openIndex + 1, i), end: i + 1 };
    }
  }
  return null;
}

function splitCventries(body: string): Array<{ args: string[]; bullets: string[] }> {
  const out: Array<{ args: string[]; bullets: string[] }> = [];
  const re = /\\cventry/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    let i = m.index + m[0].length;
    const args: string[] = [];
    for (let k = 0; k < 4; k++) {
      while (i < body.length && /\s/.test(body[i])) i += 1;
      if (body[i] !== '{') break;
      const g = readBraceGroup(body, i);
      if (!g) break;
      args.push(unescapeLatex(g.value));
      i = g.end;
    }
    if (args.length < 4) continue;

    const rest = body.slice(i);
    const stop = rest.search(/\\cventry|\\section|\\end\{itemize\}/);
    const chunk = stop >= 0 ? rest.slice(0, stop) : rest;
    const bullets = Array.from(chunk.matchAll(/\\item\s+([^\n]*)/g)).map((mm) =>
      unescapeLatex(mm[1]),
    );
    out.push({ args, bullets });
    re.lastIndex = i;
  }
  return out;
}

function splitSections(tex: string): Array<{ title: string; body: string }> {
  const out: Array<{ title: string; body: string }> = [];
  const re = /\\section\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  let lastTitle = '';
  let lastIndex = 0;
  while ((m = re.exec(tex))) {
    if (lastTitle) out.push({ title: lastTitle, body: tex.slice(lastIndex, m.index) });
    lastTitle = unescapeLatex(m[1]);
    lastIndex = m.index + m[0].length;
  }
  if (lastTitle) out.push({ title: lastTitle, body: tex.slice(lastIndex) });
  return out;
}

function sectionKey(title: string): string | null {
  const t = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (t.includes('resumo') || t.includes('summary')) return 'summary';
  if (t.includes('lideran')) return 'leadership';
  if (t.includes('experi')) return 'experience';
  if (t.includes('habilidade') || t.includes('skills') || t === 'skills') return 'skills';
  if (
    t.includes('educa') ||
    t.includes('formacao') ||
    t.includes('academica') ||
    t === 'education'
  ) {
    return 'education';
  }
  if (t.includes('projeto') || t === 'projects') return 'projects';
  if (t.includes('certific') || t === 'certifications') return 'certifications';
  if (t.includes('idioma') || t === 'languages') return 'languages';
  return null;
}

function parseHeader(tex: string): Record<string, string> {
  const out: Record<string, string> = {};
  const center = tex.match(/\\begin\{center\}([\s\S]*?)\\end\{center\}/);
  if (!center) return out;

  let header = center[1];
  const bi = header.indexOf('\\textbf{');
  if (bi >= 0) {
    const g = readBraceGroup(header, header.indexOf('{', bi));
    if (g) {
      out.name = unescapeLatex(g.value);
      header = header.slice(g.end);
    }
  }

  // remove o } que fecha {\LARGE ...} e o \\ [0.1cm]
  header = header.replace(/^\s*\}\s*\\+\s*\[0\.1cm\]\s*/, '');
  const parts = header.split(/\\textbullet\{\}/);
  const first = unescapeLatex(parts[0] || '');
  if (first) out.location = first;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const href = part.match(/\\href\{([^}]*)\}\{([^}]*)\}/);
    if (href) {
      const url = href[1];
      const text = unescapeLatex(href[2]);
      if (/^mailto:/i.test(url)) {
        if (!out.email) out.email = text || url.replace(/^mailto:/i, '');
      } else if (/linkedin/i.test(url)) {
        out.linkedin = text || url;
      } else if (/github/i.test(url)) {
        out.github = text || url;
      } else if (!out.portfolio) {
        out.portfolio = text || url;
      }
    } else {
      const text = unescapeLatex(part);
      if (!text) continue;
      if (!out.phone && /\d{3,}/.test(text)) out.phone = text;
      else if (!out.location) out.location = text;
    }
  }

  // se o e-mail não veio do href, tenta um e-mail solto no header
  if (!out.email) {
    const em = header.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    if (em) out.email = em[0];
  }
  return out;
}

function parseSkills(body: string): { skills: string[]; languages: Array<{ name: string; level?: string }> } {
  const skills: string[] = [];
  const languages: Array<{ name: string; level?: string }> = [];
  const re = /\\item\s+\\textbf\{([^:}]*):\}\s*([^\n]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const label = m[1].toLowerCase();
    const value = unescapeLatex(m[2]);
    if (label.includes('tecnic') || label.includes('technical')) {
      value.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => skills.push(s));
    } else if (label.includes('idioma') || label.includes('language')) {
      value.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => {
        const [name, ...rest] = s.split(':');
        const level = rest.join(':').trim();
        if (name.trim()) languages.push(level ? { name: name.trim(), level } : { name: name.trim() });
      });
    }
  }
  return { skills, languages };
}

function parseBullets(body: string): string[] {
  return Array.from(body.matchAll(/\\item\s+([^\n]*)/g)).map((m) => unescapeLatex(m[1]));
}

export function parseLatexToProfile(tex: string, fallback: CandidateProfile): CandidateProfile {
  const base: CandidateProfile = JSON.parse(JSON.stringify(fallback || {}));
  const personal = { ...(base.personal || ({} as CandidateProfile['personal'])) };

  const header = parseHeader(tex);
  if (header.name) personal.name = header.name;
  if (header.email) personal.email = header.email;
  if (header.phone) personal.phone = header.phone;
  if (header.location) personal.location = header.location;
  if (header.linkedin) personal.linkedin = header.linkedin;
  if (header.github) personal.github = header.github;
  if (header.portfolio) personal.portfolio = header.portfolio;

  const sections = splitSections(tex);
  const result: CandidateProfile = { ...base, personal };

  for (const sec of sections) {
    const key = sectionKey(sec.title);
    if (!key) continue;

    if (key === 'summary') {
      const text = unescapeLatex(sec.body.replace(/\\vspace\{[^}]*\}/g, ' ').replace(/^\s*\\?%.*$/gm, ' '));
      if (text) result.summary = text;
      continue;
    }

    if (key === 'experience' || key === 'leadership') {
      const list = splitCventries(sec.body).map((c) => ({
        title: c.args[2] || '',
        company: c.args[0] || '',
        location: c.args[1] || '',
        period: c.args[3] || '',
        description: c.bullets,
      }));
      if (list.length) {
        if (key === 'experience') result.experience = list;
        else result.leadership = list;
      }
      continue;
    }

    if (key === 'education') {
      const list = splitCventries(sec.body).map((c) => ({
        institution: c.args[0] || '',
        location: c.args[1] || '',
        degree: c.args[2] || '',
        year: c.args[3] || '',
      }));
      if (list.length) result.education = list;
      continue;
    }

    if (key === 'projects') {
      const list = splitCventries(sec.body).map((c) => ({
        name: c.args[0] || '',
        location: c.args[1] || '',
        role: c.args[2] || '',
        period: c.args[3] || '',
        description: c.bullets,
      }));
      if (list.length) result.projects = list;
      continue;
    }

    if (key === 'skills') {
      const parsed = parseSkills(sec.body);
      if (parsed.skills.length) result.skills = parsed.skills;
      if (parsed.languages.length) result.languages = parsed.languages;
      continue;
    }

    if (key === 'certifications') {
      const list = parseBullets(sec.body).map((name) => ({ name }));
      if (list.length) result.certifications = list;
      continue;
    }

    if (key === 'languages') {
      const parsed = parseSkills(sec.body);
      if (parsed.languages.length) result.languages = parsed.languages;
      continue;
    }
  }

  return result;
}