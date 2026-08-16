import { normaliseSettings } from "../shared/defaults.js";

const contextSummary = document.querySelector("#context-summary");
const providerStatus = document.querySelector("#provider-status");
const runStatus = document.querySelector("#run-status");
const promptField = document.querySelector("#agent-prompt");
const form = document.querySelector("#agent-form");
const optionsButton = document.querySelector("#open-options");
const refreshContextButton = document.querySelector("#refresh-context");
const conversation = document.querySelector("#conversation");
const proposalContainer = document.querySelector("#proposals");
const sendButton = document.querySelector("#send-button");

let settings;
let currentTab = null;
let history = [];

function applyAppearance() {
  document.body.dataset.theme = settings.appearance.theme;
  document.body.classList.toggle("compact-mode", settings.appearance.compactMode);
  document.documentElement.style.setProperty("--configured-code-font-size", `${settings.appearance.codeFontSize}px`);
}

function setRunStatus(message, isError = false) {
  runStatus.textContent = message;
  runStatus.classList.toggle("error-status", isError);
}

function createMessage({ role, content, events = [] }) {
  const article = document.createElement("article");
  article.className = `message ${role}-message`;
  const roleLabel = document.createElement("p");
  roleLabel.className = "message-role";
  roleLabel.textContent = role === "user" ? "You" : "Alexandria";
  const text = document.createElement("p");
  text.className = "message-content";
  text.textContent = content;
  article.append(roleLabel, text);

  if (settings.agent.showToolActivity && events.length) {
    const trace = document.createElement("details");
    trace.className = "tool-trace";
    const summary = document.createElement("summary");
    summary.textContent = `Workflow activity (${events.length})`;
    const list = document.createElement("ul");
    for (const event of events) {
      const item = document.createElement("li");
      item.textContent = `${event.name}: ${event.summary}`;
      if (!event.ok) {
        item.className = "tool-failed";
      }
      list.append(item);
    }
    trace.append(summary, list);
    article.append(trace);
  }

  conversation.append(article);
  article.scrollIntoView({ block: "end", behavior: "smooth" });
}

function createProposalCard(proposal) {
  const card = document.createElement("article");
  card.className = "proposal-card";
  card.dataset.proposalId = proposal.id;
  const heading = document.createElement("h3");
  heading.textContent = "Review proposed page edit";
  const rationale = document.createElement("p");
  rationale.textContent = proposal.rationale;
  const reviewGrid = document.createElement("div");
  reviewGrid.className = "review-grid";

  for (const [label, content] of [["Current inspected text", proposal.original], ["Proposed replacement", proposal.replacement]]) {
    const group = document.createElement("div");
    const codeLabel = document.createElement("p");
    codeLabel.className = "code-label";
    codeLabel.textContent = label;
    const code = document.createElement("pre");
    code.className = "review-code";
    code.textContent = content || "(No text was available for preview.)";
    group.append(codeLabel, code);
    reviewGrid.append(group);
  }

  const actions = document.createElement("div");
  actions.className = "proposal-actions";
  const status = document.createElement("span");
  status.className = "proposal-status";
  status.textContent = "Approval changes the field only; you save or submit the page yourself.";
  const buttons = document.createElement("div");
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "dismiss-button";
  dismiss.textContent = "Dismiss";
  dismiss.addEventListener("click", () => {
    card.remove();
    if (!proposalContainer.children.length) {
      proposalContainer.hidden = true;
    }
  });
  const approve = document.createElement("button");
  approve.type = "button";
  approve.className = "approve-button";
  approve.textContent = "Approve and apply";
  approve.addEventListener("click", async () => {
    approve.disabled = true;
    dismiss.disabled = true;
    status.textContent = "Applying approved edit…";
    const response = await chrome.runtime.sendMessage({
      type: "alexandria:apply-proposal",
      proposalId: proposal.id,
      tabId: proposal.tabId
    });

    if (response?.ok) {
      status.textContent = "Applied. Review the browser field, then save or submit it manually.";
      approve.textContent = "Applied";
    } else {
      status.textContent = response?.error || "The proposed edit could not be applied.";
      status.classList.add("error-status");
      approve.disabled = false;
      dismiss.disabled = false;
    }
  });
  buttons.append(dismiss, approve);
  actions.append(status, buttons);
  card.append(heading, rationale, reviewGrid, actions);
  return card;
}

function renderProposals(proposals = []) {
  if (!proposals.length) {
    return;
  }
  proposalContainer.hidden = false;
  for (const proposal of proposals) {
    proposalContainer.append(createProposalCard(proposal));
  }
}

function renderCurrentTab() {
  if (!currentTab?.url) {
    contextSummary.textContent = "No coding tab is available. Open a website and try refresh.";
    return;
  }
  try {
    const url = new URL(currentTab.url);
    contextSummary.textContent = `${currentTab.title || "Current page"} — ${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    contextSummary.textContent = currentTab.title || "Current page";
  }
}

async function refreshContext() {
  const response = await chrome.runtime.sendMessage({ type: "alexandria:get-agent-tab", tabId: currentTab?.id });
  currentTab = response?.tab ?? null;
  renderCurrentTab();
}

async function loadPanelState() {
  const [{ settings: storedSettings }, { pendingContext }] = await Promise.all([
    chrome.runtime.sendMessage({ type: "alexandria:get-settings" }),
    chrome.storage.session.get("pendingContext")
  ]);
  settings = normaliseSettings(storedSettings);
  applyAppearance();
  await refreshContext();

  const provider = settings.providers.find((item) => item.id === settings.activeProviderId) ?? settings.providers[0];
  if (provider?.baseUrl && provider?.model) {
    providerStatus.textContent = `Provider: ${provider.label} · ${provider.model}`;
  } else {
    providerStatus.textContent = "Configure a provider base URL and model before sending requests.";
  }

  if (pendingContext?.text && settings.agent.includeSelectionByDefault) {
    const excerpt = pendingContext.text.trim().replace(/\s+/g, " ").slice(0, 200);
    promptField.placeholder = `Selected context available: ${excerpt}${pendingContext.text.length > 200 ? "…" : ""}`;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = promptField.value.trim();
  if (!prompt || !settings) {
    promptField.focus();
    return;
  }

  const historyBeforePrompt = [...history];
  createMessage({ role: "user", content: prompt });
  history.push({ role: "user", content: prompt });
  promptField.value = "";
  sendButton.disabled = true;
  setRunStatus("Alexandria is working with the configured provider…");

  try {
    const response = await chrome.runtime.sendMessage({
      type: "alexandria:run-agent",
      prompt,
      history: historyBeforePrompt,
      tabId: currentTab?.id
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Agent execution failed.");
    }

    currentTab = { ...(currentTab ?? {}), id: response.tabId };
    createMessage({
      role: "assistant",
      content: response.result.content,
      events: response.result.events
    });
    history.push({ role: "assistant", content: response.result.content });
    renderProposals(response.result.proposals);
    setRunStatus(response.result.proposals?.length ? "Edit proposal ready for your review." : "Response complete.");
  } catch (error) {
    createMessage({ role: "assistant", content: `I could not complete that request: ${error.message}` });
    setRunStatus(error.message, true);
  } finally {
    sendButton.disabled = false;
  }
});

optionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
refreshContextButton.addEventListener("click", refreshContext);

loadPanelState().catch((error) => {
  console.error("Unable to initialize Alexandria panel.", error);
  setRunStatus("Unable to load extension settings.", true);
});
