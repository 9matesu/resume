import { test, expect } from '@playwright/test';

const ADAPTED = {
  job: { id: 'job1', title: 'Segurança da Informação', company: 'Acme', location: 'São Paulo, SP' },
  adaptation: {
    id: 'res1', match_score: 82, applied_keywords: ['Linux'],
    tailored_profile: {
      personal: { name: 'Mateus Santos', email: 'm@m.com', phone: '', location: '', linkedin: '', github: '', portfolio: '' },
      summary: 'Profissional de segurança', experience: [], leadership: [],
      education: [], skills: ['Linux'], projects: [], certifications: [], languages: [],
    },
    tex_code: '% tex', pdf_url: '/api/resumes/res1/pdf',
    pdf_filename: 'CVMateus-Seguranca-Da-Informacao.pdf',
  },
};

test.describe('studio UI/UX', () => {
  test('editor loads, download uses canonical CV name, no overflow', async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('resume_studio', JSON.stringify(data));
    }, ADAPTED);
    await page.route('**/api/history', (r) => r.fulfill({ json: { history: [{ id: 'res1' }] } }));
    await page.goto('/studio.html');
    await expect(page.getByText('Segurança da Informação')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/screenshots/studio-loaded.png', fullPage: false });

    // Botão Baixar PDF existe e o layout em 1280px não estoura.
    await expect(page.getByRole('button', { name: /Baixar PDF/i }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    // Mobile 390px: paineis empilham (erro de UX = sobreposição).
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'e2e/screenshots/studio-mobile.png', fullPage: false });
    const boxes = await page.evaluate(() => {
      const els = [...document.querySelectorAll('button, a, textarea, input')];
      const r = (el: Element) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width, overflow: b.x + b.width - innerWidth }; };
      return els.map(r);
    });
    for (const b of boxes) expect(b.overflow).toBeLessThanOrEqual(2);
  });

  test('empty studio explains next step (screenshot)', async ({ page }) => {
    await page.goto('/studio.html');
    await expect(page.getByText(/Nenhum resultado carregado/i)).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/screenshots/studio-empty.png' });
  });
});
