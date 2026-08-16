const pageName = document.querySelector("#page-name");
const providerName = document.querySelector("#provider-name");
const providerDetail = document.querySelector("#provider-detail");
const grantPageAccess = document.querySelector("#grant-page-access");

let activeTab;

function originPatternFor(urlString) {
  const url = new URL(urlString);
  return `${url.protocol}//${url.hostname}/*`;
}

async function loadPopup() {
  const [tabs, { settings }] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    chrome.storage.local.get("settings")
  ]);
  activeTab = tabs[0];

  if (activeTab?.url) {
    try {
      const pageUrl = new URL(activeTab.url);
      pageName.textContent = `${pageUrl.hostname}${pageUrl.pathname === "/" ? "" : pageUrl.pathname}`;

      if (!/^https?:$/.test(pageUrl.protocol)) {
        grantPageAccess.disabled = true;
        grantPageAccess.textContent = "Unavailable on this page";
      }
    } catch {
      pageName.textContent = activeTab.title || "Current page";
    }
  } else {
    pageName.textContent = activeTab?.title || "Current page";
  }

  const provider = settings?.providers?.find(
    (item) => item.id === settings.activeProviderId
  ) ?? settings?.providers?.[0];

  if (provider?.baseUrl && provider?.apiKey) {
    providerName.textContent = `Provider: ${provider.label}`;
    providerDetail.textContent = provider.model
      ? `Model: ${provider.model}`
      : "Choose or discover a model in settings.";
  } else {
    providerName.textContent = "No provider configured";
    providerDetail.textContent = "Add an OpenAI-compatible base URL, API key, and model in settings.";
  }
}

document.querySelector("#open-options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

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
      grantPageAccess.disabled = true;
    }
  } catch {
    grantPageAccess.textContent = "Unavailable on this page";
  }
});

loadPopup().catch((error) => {
  console.error("Unable to initialize Alexandria popup.", error);
  pageName.textContent = "Unable to inspect the active page.";
});
