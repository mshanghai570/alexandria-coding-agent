import {
  DEFAULT_PROVIDER,
  THEMES,
  createDefaultSettings,
  normaliseSettings
} from "../shared/defaults.js";

const form = document.querySelector("#settings-form");
const activeProviderSelect = document.querySelector("#active-provider");
const providerLabelField = document.querySelector("#provider-label");
const baseUrlField = document.querySelector("#provider-base-url");
const apiKeyField = document.querySelector("#provider-api-key");
const modelField = document.querySelector("#provider-model");
const discoveredModels = document.querySelector("#discovered-models");
const discoverButton = document.querySelector("#discover-models");
const testButton = document.querySelector("#test-provider");
const discoveryStatus = document.querySelector("#discovery-status");
const permissionList = document.querySelector("#permission-list");
const saveStatus = document.querySelector("#save-status");
const dataStatus = document.querySelector("#data-status");
const themeGrid = document.querySelector("#theme-grid");

const controls = {
  temperature: document.querySelector("#agent-temperature"),
  temperatureOutput: document.querySelector("#temperature-output"),
  maxOutputTokens: document.querySelector("#max-output-tokens"),
  includeSelection: document.querySelector("#include-selection"),
  showToolActivity: document.querySelector("#show-tool-activity"),
  confirmPageWrite: document.querySelector("#confirm-page-write"),
  confirmRepositoryAction: document.querySelector("#confirm-repository-action"),
  redactSecrets: document.querySelector("#redact-secrets"),
  allowPageContext: document.querySelector("#allow-page-context"),
  githubAssistant: document.querySelector("#github-assistant"),
  developerAdapters: document.querySelector("#developer-adapters"),
  pageEditor: document.querySelector("#page-editor"),
  floatingLauncher: document.querySelector("#floating-launcher"),
  puterChat: document.querySelector("#puter-chat"),
  compactMode: document.querySelector("#compact-mode"),
  codeFontSize: document.querySelector("#code-font-size"),
  fontSizeOutput: document.querySelector("#font-size-output")
};

let settings = createDefaultSettings();

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
  return settings.providers.find((provider) => provider.id === settings.activeProviderId) ?? settings.providers[0];
}

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? "var(--danger)" : "";
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
}

function renderThemeChoices() {
  themeGrid.replaceChildren(
    ...THEMES.map((theme) => {
      const label = document.createElement("label");
      label.className = "theme-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "theme";
      input.value = theme.id;
      input.checked = settings.appearance.theme === theme.id;
      input.addEventListener("change", () => {
        settings.appearance.theme = theme.id;
        applyTheme(theme.id);
      });
      const title = document.createElement("strong");
      title.textContent = theme.name;
      const description = document.createElement("span");
      description.textContent = theme.description;
      label.append(input, title, description);
      return label;
    })
  );
}

function renderProviderSelect() {
  activeProviderSelect.replaceChildren(
    ...settings.providers.map((provider) => {
      const option = document.createElement("option");
      option.value = provider.id;
      option.textContent = provider.label || "Unnamed provider";
      option.selected = provider.id === settings.activeProviderId;
      return option;
    })
  );
}

function renderModelOptions(models = []) {
  discoveredModels.replaceChildren(
    ...models.map((model) => {
      const option = document.createElement("option");
      option.value = model;
      return option;
    })
  );
}

function populateProviderForm() {
  const provider = activeProvider();
  providerLabelField.value = provider.label;
  baseUrlField.value = provider.baseUrl;
  apiKeyField.value = provider.apiKey;
  modelField.value = provider.model;
  renderModelOptions(provider.models);
  document.querySelector("#remove-provider").disabled = settings.providers.length <= 1;
}

function populateGeneralForm() {
  controls.temperature.value = settings.agent.temperature;
  controls.temperatureOutput.value = Number(settings.agent.temperature).toFixed(1);
  controls.maxOutputTokens.value = settings.agent.maxOutputTokens;
  controls.includeSelection.checked = settings.agent.includeSelectionByDefault;
  controls.showToolActivity.checked = settings.agent.showToolActivity;
  controls.confirmPageWrite.checked = settings.privacy.confirmBeforePageWrite;
  controls.confirmRepositoryAction.checked = settings.privacy.confirmBeforeRepositoryAction;
  controls.redactSecrets.checked = settings.privacy.redactSecretsBeforeSend;
  controls.allowPageContext.checked = settings.privacy.allowPageContext;
  controls.githubAssistant.checked = settings.features.githubAssistant;
  controls.developerAdapters.checked = settings.features.developerSiteAdapters;
  controls.pageEditor.checked = settings.features.pageEditor;
  controls.floatingLauncher.checked = settings.features.floatingLauncher;
  controls.puterChat.checked = settings.features.puterChat;
  controls.compactMode.checked = settings.appearance.compactMode;
  controls.codeFontSize.value = settings.appearance.codeFontSize;
  controls.fontSizeOutput.value = `${settings.appearance.codeFontSize} px`;
  applyTheme(settings.appearance.theme);
  renderThemeChoices();
}

function captureProviderForm() {
  const provider = activeProvider();
  provider.label = providerLabelField.value.trim() || "Unnamed provider";
  provider.baseUrl = baseUrlField.value.trim();
  provider.apiKey = apiKeyField.value.trim();
  provider.model = modelField.value.trim();
}

function captureGeneralForm() {
  settings.agent = {
    temperature: Number(controls.temperature.value),
    maxOutputTokens: Number(controls.maxOutputTokens.value),
    includeSelectionByDefault: controls.includeSelection.checked,
    showToolActivity: controls.showToolActivity.checked
  };
  settings.privacy = {
    confirmBeforePageWrite: controls.confirmPageWrite.checked,
    confirmBeforeRepositoryAction: controls.confirmRepositoryAction.checked,
    redactSecretsBeforeSend: controls.redactSecrets.checked,
    allowPageContext: controls.allowPageContext.checked
  };
  settings.features = {
    puterChat: controls.puterChat.checked,
    floatingLauncher: controls.floatingLauncher.checked,
    pageEditor: controls.pageEditor.checked,
    githubAssistant: controls.githubAssistant.checked,
    developerSiteAdapters: controls.developerAdapters.checked
  };
  settings.appearance = {
    theme: settings.appearance.theme,
    compactMode: controls.compactMode.checked,
    codeFontSize: Number(controls.codeFontSize.value)
  };
}

async function saveSettings(message = "Configuration saved locally.") {
  captureProviderForm();
  captureGeneralForm();
  settings = normaliseSettings(settings);
  await chrome.runtime.sendMessage({ type: "alexandria:save-settings", settings });
  setStatus(saveStatus, message);
}

async function ensureProviderPermission(baseUrl) {
  const origin = permissionPatternFor(baseUrl);
  const alreadyGranted = await chrome.permissions.contains({ origins: [origin] });
  return alreadyGranted || chrome.permissions.request({ origins: [origin] });
}

async function fetchModels({ announceSuccess = true } = {}) {
  try {
    captureProviderForm();
    const provider = activeProvider();
    provider.baseUrl = normaliseBaseUrl(provider.baseUrl);
    discoveryStatus.textContent = "Requesting access to this provider origin…";
    const granted = await ensureProviderPermission(provider.baseUrl);

    if (!granted) {
      setStatus(discoveryStatus, "Provider access was not granted. No request was sent.", true);
      return [];
    }

    discoveryStatus.textContent = "Contacting the provider…";
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}
    });
    if (!response.ok) {
      throw new Error(`The provider returned HTTP ${response.status}.`);
    }

    const payload = await response.json();
    provider.models = Array.isArray(payload.data)
      ? [...new Set(payload.data.map((item) => item?.id).filter((id) => typeof id === "string"))].sort((a, b) => a.localeCompare(b))
      : [];
    renderModelOptions(provider.models);
    if (!provider.model && provider.models.length) {
      provider.model = provider.models[0];
      modelField.value = provider.model;
    }
    setStatus(
      discoveryStatus,
      provider.models.length
        ? `${provider.models.length} model${provider.models.length === 1 ? "" : "s"} discovered${announceSuccess ? "." : "; provider is reachable."}`
        : "Provider is reachable but did not return an OpenAI-compatible model list."
    );
    await saveSettings("Provider profile and discovered models saved locally.");
    await renderPermissions();
    return provider.models;
  } catch (error) {
    setStatus(discoveryStatus, error?.message || "Unable to reach the provider.", true);
    return [];
  }
}

async function renderPermissions() {
  const { origins = [] } = await chrome.permissions.getAll();
  const hostOrigins = origins.filter((origin) => /^https?:/.test(origin)).sort();

  if (!hostOrigins.length) {
    permissionList.replaceChildren(Object.assign(document.createElement("li"), {
      className: "muted",
      textContent: "No provider or website origins are currently granted."
    }));
    return;
  }

  permissionList.replaceChildren(
    ...hostOrigins.map((origin) => {
      const item = document.createElement("li");
      item.className = "permission-item";
      const label = document.createElement("span");
      label.textContent = origin;
      const revoke = document.createElement("button");
      revoke.className = "revoke-button";
      revoke.type = "button";
      revoke.textContent = "Revoke";
      revoke.addEventListener("click", async () => {
        const removed = await chrome.permissions.remove({ origins: [origin] });
        setStatus(dataStatus, removed ? `Revoked ${origin}.` : `No permission was removed for ${origin}.`, !removed);
        await renderPermissions();
      });
      item.append(label, revoke);
      return item;
    })
  );
}

function uniqueProviderId() {
  return `provider-${crypto.randomUUID()}`;
}

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: "alexandria:get-settings" });
  settings = normaliseSettings(response.settings);
  renderProviderSelect();
  populateProviderForm();
  populateGeneralForm();
  await renderPermissions();
}

activeProviderSelect.addEventListener("change", () => {
  captureProviderForm();
  settings.activeProviderId = activeProviderSelect.value;
  renderProviderSelect();
  populateProviderForm();
  discoveryStatus.textContent = "Switch profiles to configure a different provider.";
});

document.querySelector("#new-provider").addEventListener("click", () => {
  captureProviderForm();
  const newProvider = {
    ...structuredClone(DEFAULT_PROVIDER),
    id: uniqueProviderId(),
    label: `Provider ${settings.providers.length + 1}`,
    baseUrl: "",
    apiKey: "",
    model: "",
    models: []
  };
  settings.providers.push(newProvider);
  settings.activeProviderId = newProvider.id;
  renderProviderSelect();
  populateProviderForm();
  discoveryStatus.textContent = "Configure the new provider profile, then discover its models.";
  providerLabelField.focus();
});

document.querySelector("#remove-provider").addEventListener("click", () => {
  if (settings.providers.length <= 1) {
    return;
  }
  const provider = activeProvider();
  if (!window.confirm(`Remove the “${provider.label}” provider profile? Its locally stored API key will be removed from Alexandria settings.`)) {
    return;
  }
  settings.providers = settings.providers.filter((item) => item.id !== provider.id);
  settings.activeProviderId = settings.providers[0].id;
  renderProviderSelect();
  populateProviderForm();
  setStatus(discoveryStatus, "Provider profile removed. Save configuration to persist the change.");
});

discoverButton.addEventListener("click", () => fetchModels());
testButton.addEventListener("click", () => fetchModels({ announceSuccess: false }));

document.querySelector("#refresh-permissions").addEventListener("click", renderPermissions);

document.querySelector("#reset-settings").addEventListener("click", async () => {
  if (!window.confirm("Reset all Alexandria settings stored in this browser? Website permissions will remain granted until you revoke them above.")) {
    return;
  }
  settings = createDefaultSettings();
  await chrome.runtime.sendMessage({ type: "alexandria:save-settings", settings });
  renderProviderSelect();
  populateProviderForm();
  populateGeneralForm();
  setStatus(dataStatus, "Local Alexandria settings were reset.");
  setStatus(saveStatus, "");
});

controls.temperature.addEventListener("input", () => {
  controls.temperatureOutput.value = Number(controls.temperature.value).toFixed(1);
});
controls.codeFontSize.addEventListener("input", () => {
  controls.fontSizeOutput.value = `${controls.codeFontSize.value} px`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(saveStatus, "");

  try {
    captureProviderForm();
    const provider = activeProvider();
    if (provider.baseUrl) {
      provider.baseUrl = normaliseBaseUrl(provider.baseUrl);
    }
    await saveSettings();
    renderProviderSelect();
    populateProviderForm();
    populateGeneralForm();
  } catch (error) {
    setStatus(saveStatus, error?.message || "Unable to save configuration.", true);
  }
});

loadSettings().catch((error) => {
  console.error("Unable to load Alexandria settings.", error);
  setStatus(saveStatus, "Unable to load local settings.", true);
});
