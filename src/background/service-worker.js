import {
  EXTENSION_NAME,
  createDefaultSettings,
  normaliseSettings
} from "../shared/defaults.js";
import { runAgent } from "../agent/run-agent.js";
import { applyApprovedProposal, createAgentToolExecutor } from "../agent/page-tools.js";

const CONTEXT_MENU_ROOT = "alexandria-root";
const CONTEXT_MENU_SELECTION = "alexandria-explain-selection";
const CONTEXT_MENU_PAGE = "alexandria-analyze-page";

async function initializeSettings() {
  const existing = await chrome.storage.local.get("settings");
  if (!existing.settings) {
    await chrome.storage.local.set({ settings: createDefaultSettings() });
  }
}

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ROOT,
      title: EXTENSION_NAME,
      contexts: ["page", "selection", "editable"]
    });
    chrome.contextMenus.create({
      id: CONTEXT_MENU_SELECTION,
      parentId: CONTEXT_MENU_ROOT,
      title: "Ask about selected code",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: CONTEXT_MENU_PAGE,
      parentId: CONTEXT_MENU_ROOT,
      title: "Analyze this coding page",
      contexts: ["page"]
    });
  });
}

async function openAgentForTab(tab) {
  if (!tab?.id) {
    return;
  }

  try {
    await chrome.storage.session.set({ lastAgentTabId: tab.id });
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.warn("Unable to open Alexandria side panel.", error);
  }
}

function originPatternFor(baseUrl) {
  const url = new URL(baseUrl);
  return `${url.protocol}//${url.hostname}/*`;
}

async function providerAccessAvailable(provider) {
  try {
    return chrome.permissions.contains({ origins: [originPatternFor(provider.baseUrl)] });
  } catch {
    return false;
  }
}

async function resolveTab(tabId) {
  if (Number.isInteger(tabId)) {
    try {
      return await chrome.tabs.get(tabId);
    } catch {
      return null;
    }
  }

  const { lastAgentTabId } = await chrome.storage.session.get("lastAgentTabId");
  if (Number.isInteger(lastAgentTabId)) {
    try {
      return await chrome.tabs.get(lastAgentTabId);
    } catch {
      // Continue to the active-tab fallback.
    }
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab ?? null;
}

async function runAgentForTab({ prompt, history, tabId }) {
  const stored = await chrome.storage.local.get("settings");
  const settings = normaliseSettings(stored.settings);
  const provider = settings.providers.find((item) => item.id === settings.activeProviderId) ?? settings.providers[0];

  if (!provider?.baseUrl || !provider?.model) {
    return {
      ok: false,
      error: "Configure a provider base URL and model in Alexandria settings before sending a request."
    };
  }

  if (!(await providerAccessAvailable(provider))) {
    return {
      ok: false,
      error: "Grant access to the configured provider from the settings page before sending a request."
    };
  }

  const tab = await resolveTab(tabId);
  if (!tab?.id) {
    return { ok: false, error: "No active browser tab is available for the coding-agent session." };
  }

  const result = await runAgent({
    provider,
    prompt,
    history,
    behavior: settings.agent,
    executeTool: createAgentToolExecutor(tab.id, {
      features: settings.features,
      privacy: settings.privacy
    })
  });

  return { ok: true, tabId: tab.id, result };
}

chrome.runtime.onInstalled.addListener(async () => {
  await initializeSettings();
  createContextMenus();
});

chrome.runtime.onStartup.addListener(async () => {
  await initializeSettings();
  createContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  await chrome.storage.session.set({
    pendingContext: {
      type: info.menuItemId === CONTEXT_MENU_SELECTION ? "selection" : "page",
      text: info.selectionText ?? "",
      pageUrl: info.pageUrl ?? tab?.url ?? "",
      capturedAt: new Date().toISOString()
    }
  });
  await openAgentForTab(tab);
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (command === "open-agent") {
    await openAgentForTab(tab);
    return;
  }

  if (command === "capture-selection" && tab?.id) {
    try {
      const [{ result: selection = "" } = {}] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection()?.toString() ?? ""
      });

      await chrome.storage.session.set({
        pendingContext: {
          type: "selection",
          text: selection,
          pageUrl: tab.url ?? "",
          capturedAt: new Date().toISOString()
        }
      });
      await openAgentForTab(tab);
    } catch (error) {
      console.warn("Unable to capture the active selection.", error);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "alexandria:get-settings") {
    chrome.storage.local.get("settings").then(({ settings }) => {
      sendResponse({ settings: normaliseSettings(settings) });
    });
    return true;
  }

  if (message?.type === "alexandria:save-settings") {
    chrome.storage.local.set({ settings: normaliseSettings(message.settings) }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === "alexandria:open-panel") {
    openAgentForTab(sender.tab).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "alexandria:get-agent-tab") {
    resolveTab(message.tabId).then((tab) => {
      sendResponse({
        ok: Boolean(tab?.id),
        tab: tab ? { id: tab.id, title: tab.title ?? "Current page", url: tab.url ?? "" } : null
      });
    });
    return true;
  }

  if (message?.type === "alexandria:run-agent") {
    runAgentForTab(message).then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: error?.message || "Agent execution failed." });
    });
    return true;
  }

  if (message?.type === "alexandria:apply-proposal") {
    applyApprovedProposal(message.proposalId, message.tabId).then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: error?.message || "Unable to apply the approved edit." });
    });
    return true;
  }

  return false;
});
