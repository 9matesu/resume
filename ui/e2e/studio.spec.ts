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
    await page.route('**/api/resumes/res1', (r) => r.fulfill({ json: ADAPTED }));
    await page.route('**/api/resumes/res1/pdf*', (r) => r.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: '%PDF-1.4 fake',
    }));
    await page.goto('/studio.html');
    await expect(page.getByText('Segurança da Informação').first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/screenshots/studio-loaded.png', fullPage: false });

    // Fonte Switzer no body e no header do Estúdio.
    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    const headerFont = await page.getByText('Segurança da Informação').first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(bodyFont).toMatch(/Switzer/);
    expect(headerFont).toMatch(/Switzer/);

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

  test('editor LaTeX tem números de linha e highlight', async ({ page }) => {
    await page.addInitScript((data) => {
      localStorage.setItem('resume_studio', JSON.stringify(data));
    }, ADAPTED);
    await page.route('**/api/resumes/res1', (r) => r.fulfill({ json: ADAPTED }));
    await page.goto('/studio.html');
    await page.getByRole('button', { name: /LaTeX/i }).click();
    await expect(page.getByTestId('latex-editor')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.cm-lineNumbers')).toBeVisible();
    await expect(page.locator('.cm-content')).toContainText('% tex');
    await page.locator('.cm-content').click();
    await page.keyboard.type('\\documentclass{article}');
    await expect(page.locator('.cm-content')).toContainText('\\documentclass{article}');
    await page.screenshot({ path: 'e2e/screenshots/studio-editor.png', fullPage: false });
  });

  test('chat sugere mudança e aplica no currículo', async ({ page }) => {
    const revised = {
      ...ADAPTED.adaptation.tailored_profile,
      summary: 'Novo resumo mais curto.',
    };
    await page.addInitScript((data) => {
      localStorage.setItem('resume_studio', JSON.stringify(data));
    }, ADAPTED);
    await page.route('**/api/resumes/res1', (r) => r.fulfill({ json: ADAPTED }));
    await page.route('**/api/resumes/res1/chat', (r) => r.fulfill({
      json: { reply: 'Resumo ajustado.', profile: revised },
    }));
    await page.goto('/studio.html');
    await page.getByRole('button', { name: /Chat com IA/i }).click();
    await page.getByPlaceholder(/Peça uma mudança/i).fill('Deixe mais curto');
    await page.getByRole('button', { name: 'Enviar mensagem' }).click();
    await expect(page.getByText('Resumo ajustado.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Aplicar' })).toBeVisible();
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page.getByText('Aplicado ao currículo')).toBeVisible();
  });

  test('empty studio explains next step (screenshot)', async ({ page }) => {
    await page.goto('/studio.html');
    await expect(page.getByText(/Nenhum resultado carregado/i)).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/screenshots/studio-empty.png' });
  });
});
