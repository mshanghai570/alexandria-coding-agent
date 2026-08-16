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
const LAUNCHER_SCRIPT_FILE = "src/launcher/floating-launcher.js";
const LAUNCHER_ORIGINS_KEY = "launcherOrigins";
const LAUNCHER_POSITIONS_KEY = "launcherPositions";

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

function launcherScriptId(origin) {
  return `alexandria-launcher-${origin.replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").slice(0, 120)}`;
}

async function readLauncherOrigins() {
  const { [LAUNCHER_ORIGINS_KEY]: origins = [] } = await chrome.storage.local.get(LAUNCHER_ORIGINS_KEY);
  return Array.isArray(origins) ? origins.filter((origin) => typeof origin === "string") : [];
}

async function writeLauncherOrigins(origins) {
  await chrome.storage.local.set({ [LAUNCHER_ORIGINS_KEY]: [...new Set(origins)].sort() });
}

async function ensureLauncherForTab(tab) {
  if (!tab?.id || !tab.url) {
    return { ok: false, error: "No browser tab is available for the floating launcher." };
  }

  let origin;
  try {
    origin = originPatternFor(tab.url);
  } catch {
    return { ok: false, error: "The floating launcher is unavailable on this page." };
  }
  if (!/^https?:/.test(origin)) {
    return { ok: false, error: "The floating launcher is available only on HTTP and HTTPS pages." };
  }

  const stored = await chrome.storage.local.get("settings");
  const settings = normaliseSettings(stored.settings);
  if (!settings.features.floatingLauncher) {
    return { ok: false, error: "The floating launcher is disabled in Alexandria settings." };
  }

  const granted = await chrome.permissions.contains({ origins: [origin] });
  if (!granted) {
    return { ok: false, error: "Enable Alexandria on this site before showing the floating launcher." };
  }

  const id = launcherScriptId(origin);
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [id] });
  } catch {
    // The script may not have been registered yet.
  }
  await chrome.scripting.registerContentScripts([{
    id,
    matches: [origin],
    js: [LAUNCHER_SCRIPT_FILE],
    runAt: "document_idle",
    allFrames: false,
    persistAcrossSessions: true
  }]);
  await writeLauncherOrigins([...(await readLauncherOrigins()), origin]);

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [LAUNCHER_SCRIPT_FILE] });
  } catch {
    // Registration ensures future navigations on this enabled origin receive the launcher.
  }

  return { ok: true, origin };
}

async function disableLauncherForOrigin(origin) {
  const id = launcherScriptId(origin);
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [id] });
  } catch {
    // No registered launcher is harmless.
  }
  const origins = await readLauncherOrigins();
  await writeLauncherOrigins(origins.filter((item) => item !== origin));
}

async function restoreLaunchers() {
  const stored = await chrome.storage.local.get("settings");
  const settings = normaliseSettings(stored.settings);
  if (!settings.features.floatingLauncher) {
    return;
  }

  for (const origin of await readLauncherOrigins()) {
    const granted = await chrome.permissions.contains({ origins: [origin] });
    if (!granted) {
      await disableLauncherForOrigin(origin);
      continue;
    }
    const id = launcherScriptId(origin);
    try {
      await chrome.scripting.registerContentScripts([{
        id,
        matches: [origin],
        js: [LAUNCHER_SCRIPT_FILE],
        runAt: "document_idle",
        allFrames: false,
        persistAcrossSessions: true
      }]);
    } catch {
      // Existing persistent registrations do not need to be recreated.
    }
  }
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
  await restoreLaunchers();
});

chrome.runtime.onStartup.addListener(async () => {
  await initializeSettings();
  createContextMenus();
  await restoreLaunchers();
});

chrome.permissions.onRemoved.addListener(({ origins = [] }) => {
  origins.filter((origin) => /^https?:/.test(origin)).forEach((origin) => {
    disableLauncherForOrigin(origin).catch((error) => console.warn("Unable to remove launcher registration.", error));
  });
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
    const nextSettings = normaliseSettings(message.settings);
    chrome.storage.local.set({ settings: nextSettings }).then(async () => {
      if (nextSettings.features.floatingLauncher) {
        await restoreLaunchers();
      } else {
        await Promise.all((await readLauncherOrigins()).map(disableLauncherForOrigin));
      }
      sendResponse({ ok: true });
    }).catch((error) => sendResponse({ ok: false, error: error?.message || "Unable to save Alexandria settings." }));
    return true;
  }

  if (message?.type === "alexandria:open-panel") {
    openAgentForTab(sender.tab).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "alexandria:open-options") {
    chrome.runtime.openOptionsPage().then(() => sendResponse({ ok: true })).catch((error) => {
      sendResponse({ ok: false, error: error?.message || "Unable to open Alexandria settings." });
    });
    return true;
  }

  if (message?.type === "alexandria:enable-launcher") {
    resolveTab(message.tabId).then(ensureLauncherForTab).then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: error?.message || "Unable to enable the floating launcher." });
    });
    return true;
  }

  if (message?.type === "alexandria:get-launcher-position") {
    chrome.storage.local.get(LAUNCHER_POSITIONS_KEY).then(({ [LAUNCHER_POSITIONS_KEY]: positions = {} }) => {
      sendResponse({ position: positions[message.origin] ?? null });
    });
    return true;
  }

  if (message?.type === "alexandria:set-launcher-position") {
    chrome.storage.local.get(LAUNCHER_POSITIONS_KEY).then(async ({ [LAUNCHER_POSITIONS_KEY]: positions = {} }) => {
      const origin = message.origin;
      if (typeof origin !== "string" || !message.position || !Number.isFinite(message.position.x) || !Number.isFinite(message.position.y)) {
        sendResponse({ ok: false, error: "Invalid launcher position." });
        return;
      }
      const nextPositions = { ...positions, [origin]: { x: message.position.x, y: message.position.y } };
      await chrome.storage.local.set({ [LAUNCHER_POSITIONS_KEY]: nextPositions });
      sendResponse({ ok: true });
    }).catch((error) => sendResponse({ ok: false, error: error?.message || "Unable to save launcher position." }));
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
    runAgentForTab({ ...message, tabId: message.tabId ?? sender.tab?.id }).then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: error?.message || "Agent execution failed." });
    });
    return true;
  }

  if (message?.type === "alexandria:apply-proposal") {
    applyApprovedProposal(message.proposalId, message.tabId ?? sender.tab?.id).then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: error?.message || "Unable to apply the approved edit." });
    });
    return true;
  }

  return false;
});
