import {
  DEFAULT_SETTINGS,
  EXTENSION_NAME
} from "../shared/defaults.js";

const CONTEXT_MENU_ROOT = "alexandria-root";
const CONTEXT_MENU_SELECTION = "alexandria-explain-selection";
const CONTEXT_MENU_PAGE = "alexandria-analyze-page";

async function initializeSettings() {
  const existing = await chrome.storage.local.get("settings");

  if (!existing.settings) {
    await chrome.storage.local.set({ settings: structuredClone(DEFAULT_SETTINGS) });
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
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.warn("Unable to open Alexandria side panel.", error);
  }
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
      sendResponse({ settings: settings ?? structuredClone(DEFAULT_SETTINGS) });
    });
    return true;
  }

  if (message?.type === "alexandria:save-settings") {
    chrome.storage.local.set({ settings: message.settings }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === "alexandria:open-panel") {
    openAgentForTab(sender.tab).then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});
