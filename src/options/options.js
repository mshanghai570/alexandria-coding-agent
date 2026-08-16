import { DEFAULT_SETTINGS } from "../shared/defaults.js";

const form = document.querySelector("#settings-form");
const baseUrlField = document.querySelector("#provider-base-url");
const apiKeyField = document.querySelector("#provider-api-key");
const modelField = document.querySelector("#provider-model");
const discoveredModels = document.querySelector("#discovered-models");
const discoverButton = document.querySelector("#discover-models");
const discoveryStatus = document.querySelector("#discovery-status");
const permissionStatus = document.querySelector("#permission-status");
const saveStatus = document.querySelector("#save-status");

const controls = {
  confirmPageWrite: document.querySelector("#confirm-page-write"),
  confirmRepositoryAction: document.querySelector("#confirm-repository-action"),
  redactSecrets: document.querySelector("#redact-secrets"),
  allowPageContext: document.querySelector("#allow-page-context"),
  puterChat: document.querySelector("#puter-chat")
};

let settings = structuredClone(DEFAULT_SETTINGS);

function normaliseBaseUrl(value) {
  const url = new URL(value.trim());

  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("Use an HTTP or HTTPS provider URL.");
  }

  return url.href.replace(/\/$/, "");
}

function permissionPatternFor(urlString) {
  const url = new URL(urlString);
  return `${url.protocol}//${url.hostname}/*`;
}

function activeProvider() {
  return settings.providers.find(
    (provider) => provider.id === settings.activeProviderId
  ) ?? settings.providers[0];
}

function populateForm() {
  const provider = activeProvider();

  baseUrlField.value = provider.baseUrl;
  apiKeyField.value = provider.apiKey;
  modelField.value = provider.model;
  controls.confirmPageWrite.checked = settings.privacy.confirmBeforePageWrite;
  controls.confirmRepositoryAction.checked = settings.privacy.confirmBeforeRepositoryAction;
  controls.redactSecrets.checked = settings.privacy.redactSecretsBeforeSend;
  controls.allowPageContext.checked = settings.privacy.allowPageContext;
  controls.puterChat.checked = settings.features.puterChat;

  renderModelOptions(provider.models ?? []);
}

function renderModelOptions(models) {
  discoveredModels.replaceChildren(
    ...models.map((model) => {
      const option = document.createElement("option");
      option.value = model;
      return option;
    })
  );
}

function hydrateSettingsFromForm() {
  const provider = activeProvider();

  provider.baseUrl = normaliseBaseUrl(baseUrlField.value);
  provider.apiKey = apiKeyField.value.trim();
  provider.model = modelField.value.trim();
  settings.privacy = {
    confirmBeforePageWrite: controls.confirmPageWrite.checked,
    confirmBeforeRepositoryAction: controls.confirmRepositoryAction.checked,
    redactSecretsBeforeSend: controls.redactSecrets.checked,
    allowPageContext: controls.allowPageContext.checked
  };
  settings.features = {
    ...settings.features,
    puterChat: controls.puterChat.checked
  };
}

async function ensureProviderPermission(baseUrl) {
  const origin = permissionPatternFor(baseUrl);
  const alreadyGranted = await chrome.permissions.contains({ origins: [origin] });

  if (alreadyGranted) {
    return true;
  }

  return chrome.permissions.request({ origins: [origin] });
}

async function discoverModels() {
  try {
    hydrateSettingsFromForm();
    const provider = activeProvider();
    discoveryStatus.textContent = "Requesting permission for this provider…";

    const granted = await ensureProviderPermission(provider.baseUrl);
    if (!granted) {
      discoveryStatus.textContent = "Provider access was not granted. No request was sent.";
      return;
    }

    discoveryStatus.textContent = "Discovering models…";
    const endpoint = new URL(`${provider.baseUrl}/models`);
    const response = await fetch(endpoint, {
      headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}
    });

    if (!response.ok) {
      throw new Error(`The provider returned HTTP ${response.status}.`);
    }

    const payload = await response.json();
    const models = Array.isArray(payload.data)
      ? payload.data.map((item) => item.id).filter((id) => typeof id === "string")
      : [];

    provider.models = [...new Set(models)].sort((left, right) => left.localeCompare(right));
    renderModelOptions(provider.models);
    discoveryStatus.textContent = provider.models.length
      ? `${provider.models.length} model${provider.models.length === 1 ? "" : "s"} discovered.`
      : "The provider responded without an OpenAI-compatible model list.";
  } catch (error) {
    discoveryStatus.textContent = error.message || "Unable to discover models.";
  }
}

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: "alexandria:get-settings" });
  settings = response.settings ?? structuredClone(DEFAULT_SETTINGS);
  populateForm();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveStatus.textContent = "";

  try {
    hydrateSettingsFromForm();
    await chrome.runtime.sendMessage({
      type: "alexandria:save-settings",
      settings
    });
    saveStatus.textContent = "Settings saved locally.";
  } catch (error) {
    saveStatus.textContent = error.message || "Unable to save settings.";
  }
});

discoverButton.addEventListener("click", discoverModels);

document.querySelector("#grant-site-access").addEventListener("click", async () => {
  const { origins = [] } = await chrome.permissions.getAll();
  const grantedSiteOrigins = origins.filter((origin) => /^https?:/.test(origin));
  permissionStatus.textContent = grantedSiteOrigins.length
    ? `Access is currently granted to ${grantedSiteOrigins.length} site origin${grantedSiteOrigins.length === 1 ? "" : "s"}. Page-aware tools will request additional access per site when needed.`
    : "No site access is currently granted. Page-aware tools will request access per site when needed.";
});

loadSettings().catch((error) => {
  console.error("Unable to load Alexandria settings.", error);
  saveStatus.textContent = "Unable to load local settings.";
});
