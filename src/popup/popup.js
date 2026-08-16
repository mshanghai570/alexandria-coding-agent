import { normaliseSettings } from "../shared/defaults.js";

const pageName = document.querySelector("#page-name");
const providerName = document.querySelector("#provider-name");
const providerDetail = document.querySelector("#provider-detail");
const grantPageAccess = document.querySelector("#grant-page-access");

let activeTab;

function originPatternFor(urlString) {
  const url = new URL(urlString);
  return `${url.protocol}//${url.hostname}/*`;
}

function applyAppearance(settings) {
  document.body.dataset.theme = settings.appearance.theme;
  document.body.classList.toggle("compact-mode", settings.appearance.compactMode);
}

async function loadPopup() {
  const [tabs, { settings: storedSettings }] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    chrome.storage.local.get("settings")
  ]);
  const settings = normaliseSettings(storedSettings);
  applyAppearance(settings);
  activeTab = tabs[0];

  if (activeTab?.url) {
    try {
      const pageUrl = new URL(activeTab.url);
      pageName.textContent = `${pageUrl.hostname}${pageUrl.pathname === "/" ? "" : pageUrl.pathname}`;
      if (!/^https?:$/.test(pageUrl.protocol)) {
        grantPageAccess.disabled = true;
        grantPageAccess.textContent = "Unavailable on this page";
      } else {
        const origin = originPatternFor(activeTab.url);
        const alreadyGranted = await chrome.permissions.contains({ origins: [origin] });
        if (alreadyGranted) {
          grantPageAccess.disabled = true;
          grantPageAccess.textContent = "Enabled for this site";
          chrome.runtime.sendMessage({ type: "alexandria:enable-launcher", tabId: activeTab.id }).catch(() => {});
        }
      }
    } catch {
      pageName.textContent = activeTab.title || "Current page";
    }
  } else {
    pageName.textContent = activeTab?.title || "Current page";
  }

  const provider = settings.providers.find((item) => item.id === settings.activeProviderId) ?? settings.providers[0];
  if (provider?.baseUrl && provider?.model) {
    providerName.textContent = `Provider: ${provider.label}`;
    providerDetail.textContent = `Model: ${provider.model}`;
  } else {
    providerName.textContent = "No provider configured";
    providerDetail.textContent = "Add an OpenAI-compatible base URL, API key, and model in settings.";
  }
}

document.querySelector("#open-options").addEventListener("click", () => chrome.runtime.openOptionsPage());

document.querySelector("#open-panel").addEventListener("click", async () => {
  if (activeTab?.id) {
    await chrome.sidePanel.open({ tabId: activeTab.id });
    window.close();
  }
});

grantPageAccess.addEventListener("click", async () => {
  if (!activeTab?.url) {
    return;
  }

  try {
    const origin = originPatternFor(activeTab.url);
    const granted = await chrome.permissions.request({ origins: [origin] });
    grantPageAccess.textContent = granted ? "Enabled for this site" : "Site access declined";
    if (granted) {
      const launcherResponse = await chrome.runtime.sendMessage({ type: "alexandria:enable-launcher", tabId: activeTab.id });
      grantPageAccess.disabled = true;
      grantPageAccess.textContent = launcherResponse?.ok ? "Enabled for this site" : "Site enabled; launcher opens after refresh";
    }
  } catch {
    grantPageAccess.textContent = "Unavailable on this page";
  }
});

loadPopup().catch((error) => {
  console.error("Unable to initialize Alexandria popup.", error);
  pageName.textContent = "Unable to inspect the active page.";
});
