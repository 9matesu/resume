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
  if (chrome.runtime.onInstalled) chrome.runtime.onInstalled.addListener(ensureBackend);
  if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(ensureBackend);
  ensureBackend(); // wake-up do service worker (MV3 morre e renasce)
} catch (e) {
  console.error("resuMe SW:", e);
}
