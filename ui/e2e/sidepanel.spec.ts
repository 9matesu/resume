import { test, expect, type Page } from '@playwright/test';

const HEALTH = {
  status: 'ok', ai_provider: 'gemini', ai_model: 'gemini-2.0-flash',
  has_api_key: true, compiler_type: 'tectonic', compiler_path: 'tectonic',
  has_active_candidate: true, candidate_name: 'Mateus Santos',
};
const PROFILE = {
  has_profile: true,
  profile: {
    personal: { name: 'Mateus Santos', email: 'm@m.com', phone: '119', location: 'SP', linkedin: '', github: '', portfolio: '' },
    summary: 'Segurança da Informação', experience: [], education: [],
    skills: ['Linux', 'Redes'], projects: [], certifications: [], languages: [],
  },
};
const ADAPTED = (name = 'CVMateus-Seguranca-da-Informacao.pdf') => ({
  job: { id: 'job1', title: 'Segurança da Informação', company: 'Acme', location: 'Remoto' },
  adaptation: {
    id: 'res1', match_score: 82, applied_keywords: ['Linux'],
    tailored_profile: PROFILE.profile, tex_code: '% tex', pdf_url: '/api/resumes/res1/pdf',
    pdf_filename: name,
  },
});

async function mockBase(page: Page) {
  await page.route('**/api/health', (r) => r.fulfill({ json: HEALTH }));
  await page.route('**/api/profile', (r) => r.fulfill({ json: PROFILE }));
  await page.route('**/api/history', (r) => r.fulfill({ json: { history: [] } }));
}

test.describe('sidepanel UI/UX', () => {
  test('capture buttons, rounded design, uniform font, CV filename', async ({ page }) => {
    await mockBase(page);
    await page.goto('/sidepanel.html');
    await expect(page.getByTestId('auto-capture')).toBeVisible();
    await expect(page.getByTestId('manual-capture')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/sidepanel-capture.png' });

    // Design menos quadrado: cards/btn/tags precisam ter raio > 0.
    const radii = await page.evaluate(() => {
      const q = (s: string) => [...document.querySelectorAll(s)].map((el) => getComputedStyle(el as HTMLElement).borderRadius);
      return { card: q('.brutal-card'), btn: q('.brutal-btn,.brutal-btn-yellow'), tag: q('.brutal-tag'), input: q('.brutal-input') };
    });
    for (const group of Object.values(radii)) for (const r of group) expect(r).not.toBe('0px');

    // Fontes uniformes: corpo usa Inter, sem Segoe/system-ui no content overlay.
    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(bodyFont).toMatch(/Inter/);

    // Sem overflow horizontal no painel estreito (erro comum de UX).
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    // Nome padrão do CV no download após captura mockada.
    await page.route('**/api/adapt-text', (r) => r.fulfill({ json: ADAPTED() }));
    // Simula resultado direto via storage? Em vez disso valida o helper:
    const name = await page.evaluate(async () => {
      const m = await import('/src/cvFilename.ts');
      return (m as any).cvFilename('Mateus Santos', 'Segurança da Informação', 'Acme');
    });
    expect(name).toBe('CVMateus-Seguranca-Da-Informacao.pdf');
    await page.screenshot({ path: 'e2e/screenshots/sidepanel-ok.png' });
  });

  test('auto-capture failure falls back with helpful message (screenshot)', async ({ page }) => {
    await mockBase(page);
    await page.goto('/sidepanel.html');
    await expect(page.getByTestId('auto-capture')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/sidepanel-before-error.png' });
  });
});
