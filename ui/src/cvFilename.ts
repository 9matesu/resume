// Canonical CV filename shared by SidePanel, Studio and History.
// Example: candidate "Mateus Santos" + "Segurança da Informação"
// -> "CVMateus-Seguranca-da-Informacao.pdf"
function ascii(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function cvFilename(candidateName: string, jobTitle: string, company = ''): string {
  const first = (ascii(candidateName).trim().split(/\s+/)[0] || '').replace(/[^A-Za-z0-9]/g, '');
  const base = (jobTitle || '').trim() || (company || '').trim() || 'Vaga';
  const slug = ascii(base)
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, '').replace(/^./, (c) => c.toUpperCase()))
    .filter(Boolean)
    .join('-')
    .replace(/-{2,}/g, '-')
    .slice(0, 60) || 'Vaga';
  return first ? `CV${first[0].toUpperCase()}${first.slice(1)}-${slug}.pdf` : `CV-${slug}.pdf`;
}
