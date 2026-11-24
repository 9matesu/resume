import { test, expect, type Page } from '@playwright/test';

const ADAPTED = {
  job: {
    id: 'job1', title: 'Segurança da Informação', company: 'Acme',
    location: 'São Paulo, SP', url: '',
    keywords: ['Linux', 'Redes', 'Firewall'], requirements: ['SOC', 'Linux'],
  },
  adaptation: {
    id: 'res1', match_score: 82, engine: 'ai', applied_keywords: ['Linux'],
    tailored_profile: {
      personal: { name: 'Mateus Santos', email: 'm@m.com', phone: '', location: '', linkedin: '', github: '', portfolio: '' },
      summary: 'Profissional de segurança com foco em Linux e redes.', experience: [], leadership: [],
      education: [], skills: ['Linux'], projects: [], certifications: [], languages: [],
    },
    tex_code: '% tex', pdf_url: '/api/resumes/res1/pdf',
    pdf_filename: 'CVMateus-Seguranca-Da-Informacao.pdf',
    ats: {
      coverage: 33.3, wanted: 3, covered: ['Linux'],
      missing: ['Redes', 'Firewall', 'SOC'], refined: true,
    },
  },
};

async function mockStudio(page: Page) {
  let currentDetail: any = ADAPTED;
  await page.addInitScript((data) => {
    localStorage.setItem('resume_studio', JSON.stringify(data));
  }, ADAPTED);
  await page.route('**/api/resumes/res1', (route) => {
    if (route.request().method() === 'PUT') {
      let body: any = {};
      try { body = route.request().postDataJSON(); } catch {}
      const profile = body.profile || currentDetail.adaptation.tailored_profile;
      const text = JSON.stringify(profile).toLowerCase();
      const wanted = [...ADAPTED.job.keywords, ...ADAPTED.job.requirements]
        .filter((k, i, arr) => arr.indexOf(k) === i);
      const covered = wanted.filter((k) => text.includes(k.toLowerCase()));
      const missing = wanted.filter((k) => !covered.includes(k));
      const ats = {
        coverage: Math.round((covered.length / wanted.length) * 1000) / 10,
        wanted: wanted.length, covered, missing, refined: true,
      };
      currentDetail = {
        ...currentDetail,
        adaptation: { ...currentDetail.adaptation, tailored_profile: profile, ats },
      };
      return route.fulfill({
        json: {
          status: 'saved', tex: ADAPTED.adaptation.tex_code,
          pdf_url: ADAPTED.adaptation.pdf_url, ats,
        },
      });
    }
    return route.fulfill({ json: currentDetail });
  });
  await page.route('**/api/resumes/res1/pdf*', (r) => r.fulfill({
    status: 200, contentType: 'application/pdf', body: '%PDF-1.4 fake',
  }));
  await page.goto('/studio.html');
}

test.describe('studio workspace', () => {
  test('abre com documento em destaque, uma linha de barra e sem overflow', async ({ page }) => {
    await mockStudio(page);
    await expect(page.getByRole('tab', { name: /Documento/ })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: /Documento/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('pdf-stage')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Baixar PDF' })).toBeVisible();

    const barHeight = await page.locator('.ws-bar').evaluate((el) => el.getBoundingClientRect().height);
    expect(barHeight).toBeLessThanOrEqual(49);

    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(bodyFont).toMatch(/Switzer/);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: 'e2e/screenshots/studio-loaded.png' });
  });

  test('390px: nada vaza e "Mais" abre candidaturas/estrutura/métricas', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockStudio(page);
    await expect(page.getByRole('tab', { name: 'Doc' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Mais ações' }).click();
    await expect(page.getByRole('menuitem', { name: 'Candidaturas' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Estrutura' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Métricas' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Estrutura' }).click();
    await expect(page.getByRole('dialog', { name: 'Estrutura do currículo' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    const boxes = await page.evaluate(() => {
      const els = [...document.querySelectorAll('button, a, textarea, input')];
      return els.map((el) => {
        const b = el.getBoundingClientRect();
        return { label: el.getAttribute('aria-label') || el.textContent?.slice(0, 20), overflow: b.x + b.width - innerWidth };
      });
    });
    for (const b of boxes) expect(b.overflow, b.label || '').toBeLessThanOrEqual(2);
    await page.screenshot({ path: 'e2e/screenshots/studio-mobile.png' });
  });

  test('estrutura: olho oculta seção do PDF e setas reordenam', async ({ page }) => {
    await mockStudio(page);
    await page.getByRole('button', { name: 'Estrutura', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Estrutura do currículo' });
    await expect(sheet).toBeVisible({ timeout: 10_000 });

    const summarySection = sheet.locator('[draggable="true"]').filter({ hasText: 'Resumo' }).first();
    const eye = summarySection.getByRole('button', { name: /Ocultar Resumo/ });
    await eye.click();
    await expect(summarySection.getByRole('button', { name: /Mostrar Resumo/ })).toBeVisible();
    await expect(summarySection.locator('span').filter({ hasText: 'Resumo' }).first()).toHaveClass(/line-through/);

    const order = () => sheet.locator('[draggable="true"]').allTextContents();
    const before = await order();
    await sheet.getByRole('button', { name: 'Mover Habilidades para cima' }).click();
    const after = await order();
    expect(after).not.toEqual(before);
    expect(after.indexOf(after.find((t) => t?.includes('Habilidades')) || '')).toBeLessThan(
      before.indexOf(before.find((t) => t?.includes('Habilidades')) || ''),
    );
  });

  test('métricas explicadas, grill de uma clique e alvo salvo', async ({ page }) => {
    await mockStudio(page);
    await page.getByTestId('metrics-chip').click();
    const sheet = page.getByRole('dialog', { name: 'Métricas do currículo' });
    await expect(sheet).toBeVisible({ timeout: 10_000 });

    await expect(sheet.getByText('Aderência', { exact: true })).toBeVisible();
    await expect(sheet.getByText('Cobertura ATS', { exact: true })).toBeVisible();
    await expect(sheet.getByText('Tamanho', { exact: true })).toBeVisible();
    await expect(sheet.getByText('medido', { exact: true }).first()).toBeVisible();
    await expect(sheet.getByText(/A IA leu a vaga/)).toBeVisible();

    await expect(sheet.getByText('Firewall', { exact: true })).toBeVisible();
    const beforeCount = await sheet.getByRole('button', { name: 'tenho' }).count();
    await sheet.getByRole('button', { name: 'tenho' }).first().click();
    await expect(sheet.getByRole('button', { name: 'tenho' })).toHaveCount(beforeCount - 1);

    await sheet.getByRole('button', { name: 'Sênior' }).click();
    await sheet.getByRole('button', { name: 'Caloroso' }).click();
    await sheet.getByPlaceholder('Ex.: segurança da informação').fill('segurança da informação');
    const stored = await page.evaluate(() => localStorage.getItem('resume_target_res1'));
    expect(stored).toContain('"seniority":"senior"');
    expect(stored).toContain('"tone":"caloroso"');
    expect(stored).toContain('segurança da informação');
  });

  test('chat aplica na hora e oferece desfazer', async ({ page }) => {
    const revised = {
      ...ADAPTED.adaptation.tailored_profile,
      summary: 'Novo resumo mais curto.',
    };
    await page.addInitScript((data) => {
      localStorage.setItem('resume_studio', JSON.stringify(data));
    }, ADAPTED);
    await page.route('**/api/resumes/res1', (r) => r.fulfill({ json: ADAPTED }));
    await page.route('**/api/resumes/res1/pdf*', (r) => r.fulfill({
      status: 200, contentType: 'application/pdf', body: '%PDF-1.4 fake',
    }));
    await page.route('**/api/resumes/res1/chat', (r) => r.fulfill({
      json: { reply: 'Resumo ajustado.', profile: revised },
    }));
    await page.goto('/studio.html');

    const chatRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/resumes/res1/chat')) chatRequests.push(req.postData() || '');
    });

    await page.getByRole('button', { name: 'Ajustar com IA' }).click();
    const chat = page.getByRole('dialog', { name: 'Ajustar com IA' });
    await expect(chat).toBeVisible();

    await chat.getByRole('textbox', { name: 'Mensagem para a IA' }).fill('Deixe mais curto');
    await chat.getByRole('button', { name: 'Enviar mensagem' }).click();
    await expect(chat.getByText('Resumo ajustado.')).toBeVisible({ timeout: 10_000 });
    expect(chatRequests[0]).toContain('Deixe mais curto');
    await expect(chat.getByText('No currículo')).toBeVisible();
    await chat.getByRole('button', { name: /Desfazer/ }).click();
    await expect(chat.getByText('Desfeito')).toBeVisible();
  });

  test('tabs Documento/TeX/Campos trocam de view', async ({ page }) => {
    await mockStudio(page);
    await page.getByRole('tab', { name: 'TeX' }).click();
    await expect(page.getByTestId('latex-editor')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.cm-lineNumbers')).toBeVisible();

    await page.getByRole('tab', { name: 'Campos' }).click();
    await expect(page.locator('[data-section="summary"]')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('tab', { name: 'Doc' }).click();
    await expect(page.getByTestId('pdf-stage')).toBeVisible();
  });

  test('empty studio explica o próximo passo', async ({ page }) => {
    await page.goto('/studio.html');
    await expect(page.getByText(/Nenhum resultado carregado/i)).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/screenshots/studio-empty.png' });
  });
});
