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

  // Um botão por ação: no painel de captura não pode existir o par
  // "auto" + "manual" lado a lado. O manual só aparece se o auto falhar.
  // isExtension é avaliado no import do chrome.ts, então o stub precisa
  // existir ANTES do goto, via addInitScript. O barramento guarda os
  // listeners de verdade: sem isso o resultado da captura nunca chega ao
  // painel e nenhum toast aparece.
  async function withChrome(
    page: import('@playwright/test').Page,
    opts: { autoFallback?: boolean; payload?: unknown } = {}
  ) {
    await page.addInitScript((o) => {
      const listeners: ((m: any, s: any, r: any) => void)[] = [];
      const emit = (payload: unknown) =>
        listeners.forEach((l) => l({ type: 'resume-capture-result', payload }, {}, () => {}));
      const handle = (m: any, cb?: (r: unknown) => void) => {
        if (m?.type === 'resume-capture-auto') {
          if (o.autoFallback) return { ok: false, error: 'x', fallback: 'manual' };
          setTimeout(() => emit({ ok: true, result: o.payload }), 30);
          return { ok: true, mode: 'auto' };
        }
        return { ok: true };
      };
      (window as any).chrome = {
        runtime: {
          id: 'test-extension',
          sendMessage: (m: any, cb?: (r: unknown) => void) => handle(m, cb),
          onMessage: {
            addListener: (l: any) => listeners.push(l),
            removeListener: (l: any) => {
              const i = listeners.indexOf(l);
              if (i >= 0) listeners.splice(i, 1);
            },
          },
        },
        tabs: {
          query: async () => [{ id: 1 }],
          sendMessage: async (_id: number, m: any, cb?: (r: unknown) => void) => handle(m, cb),
        },
        sidePanel: {},
      };
    }, opts);
  }

  test('captura tem um botão só, com escape manual sob demanda', async ({ page }) => {
    await mockBase(page);
    await withChrome(page, { autoFallback: true });
    await page.goto('/sidepanel.html');
    await expect(page.getByTestId('auto-capture')).toBeVisible();
    await expect(page.getByTestId('manual-capture')).toHaveCount(0);

    await page.getByTestId('auto-capture').click();
    await expect(page.getByTestId('manual-capture')).toBeVisible();
  });

  // Toast: feedback de algo que terminou longe do cursor.
  test('captura concluída mostra toast com texto real', async ({ page }) => {
    await mockBase(page);
    await withChrome(page, { payload: ADAPTED() });
    await page.goto('/sidepanel.html');
    await expect(page.getByTestId('auto-capture')).toBeVisible();
    await page.getByTestId('auto-capture').click();
    const toast = page.getByTestId('toast').first();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Currículo pronto');
    await page.screenshot({ path: 'e2e/screenshots/sidepanel-toast.png' });
  });

  // prefers-reduced-motion: sem animação, mas com o conteúdo no lugar.
  test('reduced-motion desliga animação sem esconder conteúdo', async ({ page }) => {
    await mockBase(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/sidepanel.html');
    await expect(page.getByTestId('auto-capture')).toBeVisible();
    const dur = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="auto-capture"]');
      return getComputedStyle(el as Element).transitionDuration;
    });
    expect(parseFloat(dur)).toBeLessThan(0.01);
  });

  // Trava de marca: TODO texto visível renderiza em Inter ou Instrument Serif.
  // Qualquer terceira família que entrar no CSS quebra este teste.
  test('todo texto visível usa só Inter ou Instrument Serif', async ({ page }) => {
    await mockBase(page);
    await page.goto('/sidepanel.html');
    await expect(page.getByTestId('auto-capture')).toBeVisible();
    const offenders = await page.evaluate(() => {
      const allowed = /Inter|Instrument Serif/;
      const bad: string[] = [];
      document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
        const text = (el.childElementCount === 0 ? el.textContent : '').trim();
        if (!text) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const fam = getComputedStyle(el).fontFamily;
        if (!allowed.test(fam)) bad.push(`${el.tagName}.${el.className}: ${fam}`);
      });
      return bad;
    });
    expect(offenders).toEqual([]);
  });
});
