(() => {
  const BACKEND = "http://127.0.0.1:8322";
  const UI_FONT = "'Schibsted Grotesk',system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";

  // ---------- structured hints (JSON-LD JobPosting + meta) ----------
  function readStructured() {
    const out = { title: "", company: "", location: "", url: location.href };
    try {
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
        try {
          const data = JSON.parse(s.textContent || "null");
          const arr = Array.isArray(data) ? data : [data];
          for (const d of arr) {
            const node = d && d["@graph"] ? d["@graph"].find((x) => x && /JobPosting/i.test(x["@type"] || "")) : d;
            if (!node || !/JobPosting/i.test(node["@type"] || "")) continue;
            if (!out.title && node.title) out.title = String(node.title);
            const org = node.hiringOrganization;
            if (!out.company && org) out.company = String(org.name || org);
            const loc = node.jobLocation;
            const addr = Array.isArray(loc) ? loc[0] : loc;
            const a = addr && addr.address;
            if (!out.location && a) out.location = String(a.addressLocality || a.addressRegion || a.addressCountry || "");
          }
        } catch {}
      });
    } catch {}
    const og = (p) => document.querySelector(`meta[property="${p}"]`)?.content || "";
    if (!out.title) out.title = og("og:title") || document.title.split(/[|·–—-]/)[0].trim();
    return out;
  }

  // ---------- site-specific containers (flexibilidade por ATS) ----------
  const SITE_SELECTORS = [
    // LinkedIn
    ".jobs-search__job-details--container", ".job-view-layout", "[data-job-id]",
    // Gupy
    "[data-testid='job-details']", ".job__details", "main section",
    // Indeed
    "#jobDescriptionText", ".jobsearch-JobComponent",
    // Greenhouse / Lever / Kenoby / Workable
    "#content", ".posting-headline", "[data-qa='job-description']",
    "article", "main",
  ];

  const JOB_WORDS = /(requisitos|requirements|responsabilidades|responsibilities|benef[ií]cios|benefits|sal[aá]rio|salary|vaga|hiring|job|qualifica)/i;

  function scoreCandidate(el) {
    const t = textOf(el);
    if (!t || t.length < 80) return 0;
    let score = Math.min(t.length / 1000, 20);
    if (JOB_WORDS.test(t.slice(0, 4000))) score += 8;
    const heads = el.querySelectorAll ? el.querySelectorAll("h1,h2,h3,li").length : 0;
    score += Math.min(heads / 4, 5);
    const r = el.getBoundingClientRect();
    if (r.width > 40 && r.height > 40 && r.bottom > 0 && r.top < window.innerHeight) score += 3;
    // penaliza menus/sidebars gigantes
    if (/nav|aside|footer|cookie|banner/i.test(el.className || "")) score -= 6;
    return score;
  }

  function autoExtract() {
    const structured = readStructured();
    let best = null, bestScore = 0;
    for (const sel of SITE_SELECTORS) {
      document.querySelectorAll(sel).forEach((el) => {
        if (isOurs(el) || !(el instanceof HTMLElement)) return;
        const s = scoreCandidate(el) + 4; // bonus: seletor conhecido
        if (s > bestScore) { bestScore = s; best = el; }
      });
      if (bestScore >= 15) break;
    }
    if (!best || bestScore < 6) {
      // fallback genérico: melhor bloco pontuado (não só o maior)
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let seen = 0, node = walker.nextNode();
      while (node && seen < 3000) {
        seen++;
        if (node instanceof HTMLElement && !isOurs(node)) {
          const s = scoreCandidate(node);
          if (s > bestScore) { bestScore = s; best = node; }
        }
        node = walker.nextNode();
      }
    }
    // se o bloco for gigante (página inteira), tenta o filho mais denso
    if (best && textOf(best).length > 12000) {
      let childBest = null, childScore = 0;
      best.querySelectorAll("article,section,main,div").forEach((el) => {
        const s = scoreCandidate(el);
        if (s > childScore && textOf(el).length > 300) { childScore = s; childBest = el; }
      });
      if (childBest) best = childBest;
    }
    const text = best ? textOf(best).slice(0, 30000) : "";
    return { el: best, text, structured, confidence: bestScore };
  }

  function fmtCount(n) {
    return n >= 1000 ? (n / 1000).toFixed(1).replace(".", ",").replace(",0", "") + "k" : String(n);
  }

  function isOurs(el) {
    return el instanceof HTMLElement && el.hasAttribute("data-resume");
  }

  // Descrição legível do elemento: usa role semântico, aria-label, ou título da seção
  function describeEl(el) {
    if (!el) return "";
    // Preferência: aria-label, role semântico, heading mais próximo
    const label = el.getAttribute("aria-label") || el.getAttribute("title");
    if (label) return label.trim().slice(0, 60);
    const role = el.getAttribute("role");
    if (role && role !== "none" && role !== "presentation") return role;
    // Heading dentro do elemento
    const h = el.querySelector("h1,h2,h3,h4");
    if (h && h.textContent) return h.textContent.trim().slice(0, 60);
    // Tag semântica
    const tag = el.tagName.toLowerCase();
    if (["article","section","main","aside","nav","header","footer"].includes(tag)) return tag;
    return "";
  }

  function textOf(el) {
    return ((el && el.innerText) || "").trim();
  }

  // Maior bloco de texto visível na viewport
  function largestVisibleBlock() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let best = null;
    let bestLen = 0;
    let seen = 0;
    let node = walker.nextNode();
    while (node && seen < 2000) {
      seen++;
      if (!isOurs(node)) {
        const r = node.getBoundingClientRect();
        if (r.width > 40 && r.height > 40 && r.bottom > 0 && r.top < window.innerHeight) {
          const len = textOf(node).length;
          if (len > bestLen) {
            bestLen = len;
            best = node;
          }
        }
      }
      node = walker.nextNode();
    }
    return bestLen >= 80 ? best : null;
  }

  let state = null;

  function labelFor(el) {
    if (!el) return "Mova o mouse para destacar um painel";
    const desc = describeEl(el);
    const chars = fmtCount(textOf(el).length);
    return desc ? `${desc} · ${chars} caracteres` : `${chars} caracteres`;
  }

  function positionOverlay() {
    const { hovered, overlay, label } = state;
    if (!hovered || !document.contains(hovered)) {
      overlay.style.display = "none";
      return;
    }
    const r = hovered.getBoundingClientRect();
    overlay.style.display = "block";
    overlay.style.left = r.left + "px";
    overlay.style.top = r.top + "px";
    overlay.style.width = r.width + "px";
    overlay.style.height = r.height + "px";
    label.textContent = labelFor(hovered);
  }

  function loop() {
    if (!state || state.mode !== "select") return;
    positionOverlay();
    state.raf = requestAnimationFrame(loop);
  }

  function pickTarget(x, y) {
    let el = document.elementFromPoint(x, y);
    while (el && (isOurs(el) || !(el instanceof HTMLElement))) {
      el = el.parentElement;
    }
    if (el === document.documentElement || el === document.body.parentElement) return null;
    return el;
  }

  function setCurrent(el) {
    if (!el || el === state.current) return;
    state.current = el;
    state.stack.push(el);
    state.hovered = el;
    positionOverlay();
  }

  function onMouseMove(e) {
    if (!state || state.mode !== "select") return;
    setCurrent(pickTarget(e.clientX, e.clientY));
  }

  function stepUp() {
    if (!state || !state.current) return;
    let p = state.current.parentElement;
    while (p && (isOurs(p) || !(p instanceof HTMLElement))) p = p.parentElement;
    if (p && p !== document.documentElement) setCurrent(p);
  }

  function stepDown() {
    if (!state || state.stack.length < 2) return;
    state.stack.pop();
    const el = state.stack[state.stack.length - 1];
    state.current = el;
    state.hovered = el;
    positionOverlay();
  }

  function showToast(target) {
    const text = textOf(target);
    const desc = describeEl(target);

    const toast = document.createElement("div");
    toast.setAttribute("data-resume", "toast");
    toast.style.cssText =
      "position:fixed;z-index:2147483647;left:50%;transform:translateX(-50%);bottom:16px;" +
      "max-width:min(640px,92vw);background:#ffff00;color:#000;border:2px solid #000;" +
      "box-shadow:6px 6px 0px 0px #000000;pointer-events:none;border-radius:14px;overflow:hidden;" +
      `font-family:${UI_FONT};`;;

    const head = document.createElement("div");
    head.style.cssText =
      "display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:2px solid #000;" +
      "font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;" +
      `font-family:${UI_FONT};border-radius:14px 14px 0 0;`;;

    const tag = document.createElement("span");
    tag.textContent = "PRÉVIA";
    tag.style.cssText = "background:#000;color:#ffff00;padding:2px 8px;font-size:10px;flex-shrink:0;";

    const meta = document.createElement("span");
    // Mostra descrição legível, sem paths técnicos
    meta.textContent = desc
      ? `${desc} · ${fmtCount(text.length)} caracteres`
      : `${fmtCount(text.length)} caracteres`;
    meta.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:normal;text-transform:none;letter-spacing:0;";

    const btnOther = document.createElement("button");
    btnOther.textContent = "OUTRO";
    btnOther.style.cssText =
      `background:#fff;color:#000;border:2px solid #000;border-radius:999px;font:bold 11px ${UI_FONT};` +
      "padding:4px 10px;cursor:pointer;pointer-events:auto;flex-shrink:0;";

    const btnCapture = document.createElement("button");
    btnCapture.textContent = "CAPTURAR";
    btnCapture.style.cssText =
      `background:#000;color:#ffff00;border:2px solid #000;border-radius:999px;font:bold 11px ${UI_FONT};` +
      "padding:4px 12px;cursor:pointer;pointer-events:auto;flex-shrink:0;";

    const caption = document.createElement("div");
    caption.textContent = "Edite se precisar · Enter captura · Esc cancela";
    caption.style.cssText =
      `padding:4px 10px;font:11px/1.4 ${UI_FONT};` +
      "border-bottom:1px solid #000;color:#333;";

    const ta = document.createElement("textarea");
    ta.value = text.slice(0, 4000);
    ta.spellcheck = false;
    ta.style.cssText =
      "display:block;width:100%;box-sizing:border-box;margin:0;border:0;" +
      `font:12px/1.5 ${UI_FONT};` +
      "padding:8px 10px;max-height:160px;min-height:60px;resize:vertical;outline:none;" +
      "color:#000;background:#ffff00;border-radius:0 0 14px 14px;";

    head.append(tag, meta, btnOther, btnCapture);
    toast.append(head, caption, ta);
    document.documentElement.appendChild(toast);

    btnCapture.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      finish(target, ta.value);
    });
    btnOther.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      backToSelection();
    });
    ta.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        ev.stopPropagation();
        finish(target, ta.value);
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        cancel(null);
      }
    });
    state.toast = toast;
    state.pending = { el: target, get text() { return ta.value; } };

    // Foca o textarea para que o usuário possa editar imediatamente
    requestAnimationFrame(() => ta.focus());
  }

  function hideToast() {
    if (state && state.toast) {
      state.toast.remove();
      state.toast = null;
      state.pending = null;
    }
  }

  function showHint() {
    const hint = document.createElement("div");
    hint.setAttribute("data-resume", "hint");
    hint.textContent = "Mova o mouse · ↑/↓ expande seleção · Clique = prévia · Esc cancela";
    hint.style.cssText =
      "position:fixed;z-index:2147483647;top:12px;left:50%;transform:translateX(-50%);" +
      "background:#000;color:#ffff00;border:2px solid #ffff00;" +
      `font:bold 11px/1.4 ${UI_FONT};padding:6px 14px;letter-spacing:0.03em;` +
      "white-space:nowrap;pointer-events:none;border-radius:999px;";
    document.documentElement.appendChild(hint);
    state.hint = hint;
  }

  function backToSelection() {
    if (!state) return;
    hideToast();
    state.mode = "select";
    document.documentElement.style.cursor = "crosshair";
    loop();
  }

  function onClick(e) {
    if (!state || state.mode !== "select") return;
    e.preventDefault();
    e.stopPropagation();
    const target = state.hovered;
    if (!target || !document.contains(target)) {
      cancel("Nenhum elemento sob o cursor.");
      return;
    }
    state.mode = "confirm";
    document.documentElement.style.cursor = "";
    showToast(target);
  }

  function onKey(e) {
    if (!state) return;
    if (e.key === "Escape") {
      // Esc sempre cancela — em qualquer modo, instantaneamente
      e.preventDefault();
      e.stopPropagation();
      cancel(null);
    } else if (e.key === "Enter" && state.mode === "select" && state.hovered) {
      e.preventDefault();
      e.stopPropagation();
      state.mode = "confirm";
      document.documentElement.style.cursor = "";
      showToast(state.hovered);
    } else if (e.key === "Enter" && state.mode === "confirm" && state.pending) {
      e.preventDefault();
      e.stopPropagation();
      finish(state.pending.el, state.pending.text);
    } else if (e.key === "ArrowUp" && state.mode === "select") {
      e.preventDefault();
      e.stopPropagation();
      stepUp();
    } else if (e.key === "ArrowDown" && state.mode === "select") {
      e.preventDefault();
      e.stopPropagation();
      stepDown();
    }
  }

  function cleanup() {
    if (!state) return;
    cancelAnimationFrame(state.raf);
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    state.overlay.remove();
    if (state.toast) state.toast.remove();
    if (state.hint) state.hint.remove();
    document.documentElement.style.cursor = state.prevCursor;
    state = null;
  }

  function cancel(errMsg) {
    cleanup();
    report(errMsg ? { ok: false, error: errMsg } : { ok: false, cancelled: true });
  }

  function report(payload) {
    try {
      chrome.runtime.sendMessage({ type: "resume-capture-result", payload }).catch(() => {});
    } catch {}
  }

  // Caminho único de envio: manual e automático usam o mesmo retry.
  async function postAdapt(body, structured, mode) {
    let lastErr = "Não foi possível conectar ao resuMe. Recarregue a extensão.";
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(BACKEND + "/api/adapt-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_text: body.slice(0, 30000),
            page_title: document.title,
            page_url: location.href,
            structured,
            mode,
          }),
        });
        if (!res.ok) {
          let detail = String(res.status);
          try {
            detail = (await res.json()).detail || detail;
          } catch {}
          // heurística do backend salva sem chave; só tenta de novo em 5xx/rede
          if (res.status < 500) { report({ ok: false, error: detail }); return; }
          lastErr = detail;
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        report({ ok: true, result: await res.json() });
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    report({ ok: false, error: lastErr });
  }

  async function finish(el, text) {
    const body = (text !== undefined ? text : textOf(el)).trim();
    cleanup();
    if (body.length < 80) {
      report({ ok: false, error: "O texto selecionado é muito curto para extrair a vaga." });
      return;
    }
    // 2 tentativas: queda transitória do motor não derruba a captura.
    await postAdapt(body, readStructured(), "manual");
  }

  function startSelection(sendResponse) {
    if (state) {
      sendResponse({ ok: false, error: "Seleção já em andamento nesta página." });
      return;
    }
    sendResponse({ ok: true, mode: "selecting" });

    const overlay = document.createElement("div");
    overlay.setAttribute("data-resume", "overlay");
    overlay.style.cssText =
      "position:fixed;z-index:2147483646;left:0;top:0;border:3px solid #ffff00;border-radius:12px;" +
      "box-shadow:0 0 0 9999px rgba(0,0,0,0.35);pointer-events:none;display:none;";
    const label = document.createElement("div");
    label.style.cssText =
      `position:absolute;top:-28px;left:0;background:#ffff00;color:#000;border:1px solid #000;border-radius:999px;` +
      `font:bold 11px/1.4 ${UI_FONT};padding:3px 10px;white-space:nowrap;max-width:360px;overflow:hidden;text-overflow:ellipsis;`;
    overlay.appendChild(label);
    document.documentElement.appendChild(overlay);

    const prevCursor = document.documentElement.style.cursor;
    document.documentElement.style.cursor = "crosshair";

    state = {
      mode: "select",
      current: null,
      stack: [],
      hovered: null,
      overlay,
      label,
      toast: null,
      hint: null,
      pending: null,
      prevCursor,
      raf: 0,
    };
    showHint();
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    const first = largestVisibleBlock();
    if (first) setCurrent(first);
    loop();
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === "resume-capture-start") {
        startSelection(sendResponse);
      } else if (msg && msg.type === "resume-capture-auto") {
        // Extração automática: sem clique, com fallback manual se fraca.
        (async () => {
          try {
            const { text, structured, confidence } = autoExtract();
            if (!text || text.trim().length < 80) {
              sendResponse({ ok: false, error: "Não achei a vaga sozinho — use a seleção manual.", fallback: "manual" });
              return;
            }
            sendResponse({ ok: true, mode: "auto", confidence });
            await postAdapt(text.trim(), structured, "auto");
          } catch {
            report({ ok: false, error: "Não foi possível conectar ao resuMe. Recarregue a extensão." });
          }
        })();
        return true;
      } else if (msg && msg.type === "resume-capture-cancel") {
        if (state) cancel(null);
        sendResponse({ ok: true });
      }
    });
  }
})();
