(() => {
  if (globalThis.__alexandriaFloatingLauncherInstalled) {
    return;
  }
  globalThis.__alexandriaFloatingLauncherInstalled = true;

  const LAUNCHER_SIZE = 54;
  const VIEWPORT_MARGIN = 12;
  const root = document.createElement("div");
  root.id = "alexandria-floating-launcher-root";
  const shadow = root.attachShadow({ mode: "closed" });
  document.documentElement.append(root);

  shadow.innerHTML = `
    <style>
      :host {
        --ax-bg: #0e1117;
        --ax-surface: #161b22;
        --ax-raised: #21262d;
        --ax-text: #e6edf3;
        --ax-muted: #8b949e;
        --ax-border: #30363d;
        --ax-accent: #58a6ff;
        --ax-accent-strong: #1f6feb;
        --ax-success: #3fb950;
        --ax-danger: #ff7b72;
        --ax-code: #0d1117;
        position: fixed;
        z-index: 2147483646;
        width: ${LAUNCHER_SIZE}px;
        height: ${LAUNCHER_SIZE}px;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--ax-text);
      }
      :host([data-theme="cloud"]) {
        --ax-bg: #f4f7fb; --ax-surface: #ffffff; --ax-raised: #eef3f8; --ax-text: #152235; --ax-muted: #536477;
        --ax-border: #cbd7e4; --ax-accent: #0969da; --ax-accent-strong: #0757b8; --ax-success: #1a7f37; --ax-danger: #cf222e; --ax-code: #f6f8fa;
      }
      :host([data-theme="ember"]) {
        --ax-bg: #18130f; --ax-surface: #251b16; --ax-raised: #38261b; --ax-text: #f4e6d5; --ax-muted: #c2a68e;
        --ax-border: #5f4634; --ax-accent: #e88945; --ax-accent-strong: #bb5f25; --ax-success: #6cc08b; --ax-danger: #f47067; --ax-code: #17100d;
      }
      :host([data-theme="synthwave"]) {
        --ax-bg: #180d2f; --ax-surface: #231143; --ax-raised: #34185e; --ax-text: #f4ebff; --ax-muted: #c5aedf;
        --ax-border: #68469d; --ax-accent: #40e5ff; --ax-accent-strong: #0bc6e5; --ax-success: #74f5bb; --ax-danger: #ff6e9b; --ax-code: #130725;
      }
      *, *::before, *::after { box-sizing: border-box; }
      #launcher {
        display: grid; place-items: center; width: ${LAUNCHER_SIZE}px; height: ${LAUNCHER_SIZE}px; border: 1px solid color-mix(in srgb, var(--ax-accent), var(--ax-border) 35%);
        border-radius: 50%; box-shadow: 0 10px 28px rgba(0,0,0,.32); cursor: grab; color: #fff; background: linear-gradient(135deg, var(--ax-accent-strong), var(--ax-accent));
        transition: transform .16s ease, box-shadow .16s ease; touch-action: none;
      }
      #launcher:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 14px 34px rgba(0,0,0,.4); }
      #launcher:active { cursor: grabbing; }
      #launcher:focus-visible, button:focus-visible, textarea:focus-visible { outline: 3px solid var(--ax-accent); outline-offset: 3px; }
      .mark { font-size: 22px; font-weight: 800; line-height: 1; letter-spacing: -.09em; transform: translateX(-1px); }
      #chat {
        position: absolute; display: none; width: min(450px, calc(100vw - 24px)); max-height: min(610px, calc(100vh - 24px));
        overflow: hidden; border: 1px solid var(--ax-border); border-radius: 14px; background: var(--ax-bg); box-shadow: 0 18px 52px rgba(0,0,0,.45);
      }
      #chat[data-open="true"] { display: grid; grid-template-rows: auto minmax(180px, 1fr) auto; }
      .header { display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid var(--ax-border); padding: 13px 14px; background: var(--ax-surface); }
      .title { display: grid; gap: 2px; }
      .eyebrow { margin: 0; color: var(--ax-accent); font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      h2 { margin: 0; color: var(--ax-text); font-size: 15px; }
      .header-actions { display: flex; gap: 6px; }
      .icon-button, .secondary-button, .dismiss-button, .approve-button, .send-button { border: 1px solid var(--ax-border); border-radius: 7px; cursor: pointer; color: var(--ax-text); background: var(--ax-raised); font: inherit; }
      .icon-button { width: 29px; height: 29px; padding: 0; font-size: 17px; line-height: 1; }
      .conversation { display: grid; align-content: start; gap: 9px; min-height: 190px; max-height: 355px; overflow-y: auto; padding: 12px; background: var(--ax-bg); }
      .message { border: 1px solid var(--ax-border); border-radius: 9px; padding: 10px; background: var(--ax-surface); }
      .message.user { border-color: var(--ax-accent-strong); background: color-mix(in srgb, var(--ax-accent-strong), var(--ax-surface) 84%); }
      .role { margin: 0 0 4px; color: var(--ax-muted); font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
      .content { margin: 0; color: var(--ax-text); font-size: 12.5px; line-height: 1.45; white-space: pre-wrap; }
      .events { margin: 8px 0 0; border-top: 1px solid var(--ax-border); padding-top: 7px; color: var(--ax-muted); font-size: 11px; }
      .events summary { cursor: pointer; }
      .events ul { margin: 6px 0 0; padding-left: 16px; }
      .events .failed { color: var(--ax-danger); }
      .proposal { border: 1px solid #d29922; border-radius: 9px; padding: 11px; background: color-mix(in srgb, #d29922, var(--ax-surface) 87%); }
      .proposal h3 { margin: 0 0 5px; color: var(--ax-text); font-size: 13px; }
      .proposal p { margin: 0 0 9px; color: var(--ax-text); font-size: 12px; line-height: 1.4; }
      .preview-label { margin: 7px 0 3px; color: var(--ax-muted); font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
      pre { overflow: auto; max-height: 100px; margin: 0; border: 1px solid var(--ax-border); border-radius: 6px; padding: 7px; background: var(--ax-code); color: var(--ax-text); font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap; }
      .proposal-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 9px; }
      .proposal-actions > div { display: flex; gap: 6px; }
      .proposal-status { color: var(--ax-muted); font-size: 10px; line-height: 1.3; }
      .approve-button { border-color: var(--ax-success); padding: 6px 8px; color: #fff; background: var(--ax-success); font-size: 11px; font-weight: 700; }
      .dismiss-button { padding: 6px 8px; font-size: 11px; }
      .composer { display: grid; gap: 7px; border-top: 1px solid var(--ax-border); padding: 10px 12px 12px; background: var(--ax-surface); }
      textarea { width: 100%; min-height: 62px; resize: vertical; border: 1px solid var(--ax-border); border-radius: 8px; padding: 8px; color: var(--ax-text); background: var(--ax-code); font: 12px/1.4 inherit; }
      .composer-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      #status { color: var(--ax-muted); font-size: 10.5px; line-height: 1.3; }
      #status.error { color: var(--ax-danger); }
      .send-button { border-color: var(--ax-accent-strong); padding: 7px 10px; color: #fff; background: var(--ax-accent-strong); font-size: 12px; font-weight: 700; }
      button:disabled { cursor: not-allowed; opacity: .55; }
      @media (max-width: 480px) { #chat { width: calc(100vw - 18px); } .conversation { max-height: 300px; } }
    </style>
    <button id="launcher" type="button" aria-label="Open Alexandria chat" title="Open Alexandria:Coding Agent"><span class="mark" aria-hidden="true">A</span></button>
    <section id="chat" aria-label="Alexandria chat window" data-open="false">
      <header class="header">
        <div class="title"><p class="eyebrow">Coding agent</p><h2>Alexandria</h2></div>
        <div class="header-actions"><button id="settings" class="icon-button" type="button" aria-label="Open Alexandria settings" title="Settings">⚙</button><button id="minimize" class="icon-button" type="button" aria-label="Minimize Alexandria chat" title="Minimize">−</button></div>
      </header>
      <div id="conversation" class="conversation" aria-live="polite">
        <article class="message"><p class="role">Alexandria</p><p class="content">Ready to help with this coding page. I can inspect the page when you ask; any browser-field change will be shown for your approval first.</p></article>
      </div>
      <form id="composer" class="composer"><textarea id="prompt" rows="3" placeholder="Ask Alexandria about this page…"></textarea><div class="composer-actions"><span id="status" role="status"></span><button id="send" class="send-button" type="submit">Send</button></div></form>
    </section>
  `;

  const launcher = shadow.querySelector("#launcher");
  const chat = shadow.querySelector("#chat");
  const conversation = shadow.querySelector("#conversation");
  const form = shadow.querySelector("#composer");
  const prompt = shadow.querySelector("#prompt");
  const send = shadow.querySelector("#send");
  const status = shadow.querySelector("#status");
  const origin = location.origin;
  let settings = null;
  let history = [];
  let position = null;
  let dragging = false;
  let suppressClick = false;
  let dragOffset = { x: 0, y: 0 };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function defaultPosition() {
    return {
      x: Math.max(VIEWPORT_MARGIN, window.innerWidth - LAUNCHER_SIZE - 24),
      y: Math.max(VIEWPORT_MARGIN, window.innerHeight - LAUNCHER_SIZE - 88)
    };
  }

  function applyPosition(nextPosition, persist = false) {
    const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - LAUNCHER_SIZE - VIEWPORT_MARGIN);
    const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - LAUNCHER_SIZE - VIEWPORT_MARGIN);
    position = {
      x: clamp(Math.round(nextPosition.x), VIEWPORT_MARGIN, maxX),
      y: clamp(Math.round(nextPosition.y), VIEWPORT_MARGIN, maxY)
    };
    root.style.left = `${position.x}px`;
    root.style.top = `${position.y}px`;
    positionChat();
    if (persist) {
      chrome.runtime.sendMessage({ type: "alexandria:set-launcher-position", origin, position }).catch(() => {});
    }
  }

  function positionChat() {
    if (!position) {
      return;
    }
    const opensDown = position.y < Math.max(260, window.innerHeight * 0.45);
    const panelWidth = Math.min(450, Math.max(300, window.innerWidth - 24));
    chat.style.top = opensDown ? "64px" : "auto";
    chat.style.bottom = opensDown ? "auto" : "64px";
    chat.style.left = position.x > window.innerWidth / 2 ? `${LAUNCHER_SIZE - panelWidth}px` : "0";
    chat.style.right = "auto";
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function addMessage(role, content, events = []) {
    const card = document.createElement("article");
    card.className = `message ${role}`;
    const label = document.createElement("p");
    label.className = "role";
    label.textContent = role === "user" ? "You" : "Alexandria";
    const text = document.createElement("p");
    text.className = "content";
    text.textContent = content;
    card.append(label, text);

    if (settings?.agent?.showToolActivity && events.length) {
      const details = document.createElement("details");
      details.className = "events";
      const summary = document.createElement("summary");
      summary.textContent = `Workflow activity (${events.length})`;
      const list = document.createElement("ul");
      events.forEach((event) => {
        const item = document.createElement("li");
        item.textContent = `${event.name}: ${event.summary}`;
        if (!event.ok) item.className = "failed";
        list.append(item);
      });
      details.append(summary, list);
      card.append(details);
    }

    conversation.append(card);
    conversation.scrollTop = conversation.scrollHeight;
  }

  function addProposal(proposal) {
    const card = document.createElement("article");
    card.className = "proposal";
    const heading = document.createElement("h3");
    heading.textContent = "Review proposed page edit";
    const rationale = document.createElement("p");
    rationale.textContent = proposal.rationale;
    const beforeLabel = document.createElement("p");
    beforeLabel.className = "preview-label";
    beforeLabel.textContent = "Current inspected text";
    const before = document.createElement("pre");
    before.textContent = proposal.original || "(No text was available for preview.)";
    const afterLabel = document.createElement("p");
    afterLabel.className = "preview-label";
    afterLabel.textContent = "Proposed replacement";
    const after = document.createElement("pre");
    after.textContent = proposal.replacement;
    const actions = document.createElement("div");
    actions.className = "proposal-actions";
    const proposalStatus = document.createElement("span");
    proposalStatus.className = "proposal-status";
    proposalStatus.textContent = "Approval changes the field only. Save or submit the page yourself.";
    const buttonGroup = document.createElement("div");
    const dismiss = document.createElement("button");
    dismiss.className = "dismiss-button";
    dismiss.type = "button";
    dismiss.textContent = "Dismiss";
    dismiss.addEventListener("click", () => card.remove());
    const approve = document.createElement("button");
    approve.className = "approve-button";
    approve.type = "button";
    approve.textContent = "Approve and apply";
    approve.addEventListener("click", async () => {
      approve.disabled = true;
      dismiss.disabled = true;
      proposalStatus.textContent = "Applying approved edit…";
      const response = await chrome.runtime.sendMessage({ type: "alexandria:apply-proposal", proposalId: proposal.id, tabId: proposal.tabId });
      if (response?.ok) {
        proposalStatus.textContent = "Applied. Review the field, then save or submit it yourself.";
        approve.textContent = "Applied";
      } else {
        proposalStatus.textContent = response?.error || "Unable to apply the proposed edit.";
        proposalStatus.style.color = "var(--ax-danger)";
        approve.disabled = false;
        dismiss.disabled = false;
      }
    });
    buttonGroup.append(dismiss, approve);
    actions.append(proposalStatus, buttonGroup);
    card.append(heading, rationale, beforeLabel, before, afterLabel, after, actions);
    conversation.append(card);
    conversation.scrollTop = conversation.scrollHeight;
  }

  function toggleChat(force) {
    const shouldOpen = typeof force === "boolean" ? force : chat.dataset.open !== "true";
    chat.dataset.open = String(shouldOpen);
    launcher.setAttribute("aria-label", shouldOpen ? "Minimize Alexandria chat" : "Open Alexandria chat");
    if (shouldOpen) {
      positionChat();
      prompt.focus();
    }
  }

  launcher.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    dragging = true;
    suppressClick = false;
    dragOffset = { x: event.clientX - position.x, y: event.clientY - position.y };
    launcher.setPointerCapture(event.pointerId);
  });

  launcher.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const next = { x: event.clientX - dragOffset.x, y: event.clientY - dragOffset.y };
    if (Math.abs(next.x - position.x) > 3 || Math.abs(next.y - position.y) > 3) suppressClick = true;
    applyPosition(next);
  });

  launcher.addEventListener("pointerup", (event) => {
    if (!dragging) return;
    dragging = false;
    if (launcher.hasPointerCapture(event.pointerId)) launcher.releasePointerCapture(event.pointerId);
    applyPosition(position, true);
  });

  launcher.addEventListener("click", () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    toggleChat();
  });

  shadow.querySelector("#minimize").addEventListener("click", () => toggleChat(false));
  shadow.querySelector("#settings").addEventListener("click", () => chrome.runtime.sendMessage({ type: "alexandria:open-options" }));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = prompt.value.trim();
    if (!text) {
      prompt.focus();
      return;
    }
    const historyBeforePrompt = [...history];
    addMessage("user", text);
    history.push({ role: "user", content: text });
    prompt.value = "";
    send.disabled = true;
    setStatus("Alexandria is working…");
    try {
      const response = await chrome.runtime.sendMessage({ type: "alexandria:run-agent", prompt: text, history: historyBeforePrompt });
      if (!response?.ok) throw new Error(response?.error || "Agent execution failed.");
      addMessage("assistant", response.result.content, response.result.events);
      history.push({ role: "assistant", content: response.result.content });
      (response.result.proposals || []).forEach(addProposal);
      setStatus(response.result.proposals?.length ? "Edit proposal ready for your approval." : "Response complete.");
    } catch (error) {
      addMessage("assistant", `I could not complete that request: ${error.message}`);
      setStatus(error.message, true);
    } finally {
      send.disabled = false;
    }
  });

  window.addEventListener("resize", () => {
    if (position) applyPosition(position);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.settings?.newValue) return;
    settings = changes.settings.newValue;
    if (!settings.features?.floatingLauncher) {
      root.remove();
      return;
    }
    root.dataset.theme = settings.appearance?.theme || "midnight";
  });

  async function initialize() {
    const response = await chrome.runtime.sendMessage({ type: "alexandria:get-settings" });
    settings = response?.settings;
    if (!settings?.features?.floatingLauncher) {
      root.remove();
      return;
    }
    root.dataset.theme = settings.appearance?.theme || "midnight";
    const stored = await chrome.runtime.sendMessage({ type: "alexandria:get-launcher-position", origin });
    applyPosition(stored?.position || defaultPosition());
  }

  initialize().catch(() => {
    applyPosition(defaultPosition());
  });
})();
