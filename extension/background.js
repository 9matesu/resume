// Service worker: side panel behavior + capture shortcut.
// Toda a avaliacao roda dentro de try/catch: nada aqui pode lancar no
// registro do SW (falha de registro = extensao inutilizavel).
try {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch(() => {});
  }

  if (chrome.commands && chrome.commands.onCommand) {
    chrome.commands.onCommand.addListener(async (command) => {
      if (command !== "capture") return;
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;
        const ack = await chrome.tabs.sendMessage(tab.id, { type: "resume-capture-start" });
        if (ack && !ack.ok) {
          chrome.runtime
            .sendMessage({
              type: "resume-capture-result",
              payload: { ok: false, error: ack.error || "Falha ao iniciar seleção." },
            })
            .catch(() => {});
        }
      } catch (err) {
        chrome.runtime
          .sendMessage({
            type: "resume-capture-result",
            payload: { ok: false, error: "Recarregue a pagina da vaga (F5) e tente de novo." },
          })
          .catch(() => {});
      }
    });
  }

  // O content script roda na origem da pagina da vaga. Em vez de deixar o
  // backend aberto com CORS *, ele pede para o service worker fazer o fetch:
  // assim a origem pode ficar restrita a chrome-extension://.
  if (chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type !== "resume-adapt") return;
      (async () => {
        try {
          const res = await fetch("http://127.0.0.1:8322/api/adapt-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(msg.body),
          });
          let data = null;
          try {
            data = await res.json();
          } catch {}
          sendResponse({ ok: res.ok, status: res.status, data });
        } catch {
          sendResponse({
            ok: false,
            status: 0,
            error: "Não foi possível conectar ao resuMe. Recarregue a extensão.",
          });
        }
      })();
      return true;
    });
  }
  // Motor local sobe sozinho quando a extensao carrega (browser startup,
  // install/update e wake-up do SW). Fire-and-forget: o painel tem o
  // fallback com botao; nada aqui pode lancar no registro do SW.
  const ensureBackend = () => {
    try {
      chrome.runtime.sendNativeMessage("com.resume.host", { action: "ensure-backend" }, () => {
        void chrome.runtime.lastError; // host ausente = painel mostra instrucoes
      });
    } catch (e) {
      console.error("resuMe SW ensure:", e);
    }
  };
  // Injeta o content script nas abas que ja estavam abertas quando a
  // extensao foi instalada/recarregada. Evita o F5 manual.
  const injectExistingTabs = async () => {
    if (!chrome.scripting || !chrome.scripting.executeScript) return;
    try {
      const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
      for (const tab of tabs) {
        if (!tab.id) continue;
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"],
          });
        } catch {
          // Aba restrita ou sem permissao: segue.
        }
      }
    } catch {
      // Sem acesso a abas: segue.
    }
  };

  const onInstalled = () => {
    ensureBackend();
    void injectExistingTabs();
  };
  const onStartup = () => {
    ensureBackend();
    void injectExistingTabs();
  };

  if (chrome.runtime.onInstalled) chrome.runtime.onInstalled.addListener(onInstalled);
  if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(onStartup);
  ensureBackend(); // wake-up do service worker (MV3 morre e renasce)
} catch (e) {
  console.error("resuMe SW:", e);
}
