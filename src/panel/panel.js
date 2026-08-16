const contextSummary = document.querySelector("#context-summary");
const providerStatus = document.querySelector("#provider-status");
const promptField = document.querySelector("#agent-prompt");
const form = document.querySelector("#agent-form");
const optionsButton = document.querySelector("#open-options");

async function loadPanelState() {
  const [{ settings }, { pendingContext }] = await Promise.all([
    chrome.runtime.sendMessage({ type: "alexandria:get-settings" }),
    chrome.storage.session.get("pendingContext")
  ]);

  const activeProvider = settings.providers.find(
    (provider) => provider.id === settings.activeProviderId
  );

  if (activeProvider?.apiKey && activeProvider?.baseUrl) {
    providerStatus.textContent = `Provider: ${activeProvider.label}`;
  } else {
    providerStatus.textContent = "Configure a provider before sending requests.";
  }

  if (pendingContext?.text) {
    const excerpt = pendingContext.text.trim().replace(/\s+/g, " ").slice(0, 280);
    contextSummary.textContent = `Selected code: ${excerpt}${pendingContext.text.length > 280 ? "…" : ""}`;
  } else if (pendingContext?.pageUrl) {
    contextSummary.textContent = `Page: ${pendingContext.pageUrl}`;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const prompt = promptField.value.trim();

  if (!prompt) {
    promptField.focus();
    return;
  }

  // The agent execution pipeline will be added after provider configuration and
  // consent-gated page adapters are implemented.
  promptField.value = "";
  providerStatus.textContent = "Agent execution is not configured yet.";
});

optionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

loadPanelState().catch((error) => {
  console.error("Unable to initialize Alexandria panel.", error);
  providerStatus.textContent = "Unable to load extension settings.";
});
