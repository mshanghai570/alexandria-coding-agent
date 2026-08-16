export const EXTENSION_NAME = "Alexandria:Coding Agent";

export const THEMES = Object.freeze([
  {
    id: "midnight",
    name: "Midnight Terminal",
    description: "A focused blue-black developer workspace."
  },
  {
    id: "cloud",
    name: "Cloud Paper",
    description: "A high-clarity light surface for long reviews."
  },
  {
    id: "ember",
    name: "Ember Forge",
    description: "Warm charcoal with copper highlights."
  },
  {
    id: "synthwave",
    name: "Synthwave Grid",
    description: "Deep violet with neon cyan accents."
  }
]);

export const DEFAULT_PROVIDER = Object.freeze({
  id: "openai-compatible",
  label: "OpenAI-compatible",
  kind: "openai-compatible",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "",
  models: [],
  enabled: true
});

export const DEFAULT_SETTINGS = Object.freeze({
  providers: [DEFAULT_PROVIDER],
  activeProviderId: DEFAULT_PROVIDER.id,
  privacy: {
    confirmBeforePageWrite: true,
    confirmBeforeRepositoryAction: true,
    redactSecretsBeforeSend: true,
    allowPageContext: true
  },
  appearance: {
    theme: "midnight",
    compactMode: false,
    codeFontSize: 13
  },
  agent: {
    temperature: 0.2,
    maxOutputTokens: 1200,
    includeSelectionByDefault: true,
    showToolActivity: true
  },
  features: {
    puterChat: false,
    pageEditor: true,
    githubAssistant: true,
    developerSiteAdapters: true
  }
});

export const OPTIONAL_HOST_PERMISSION_PATTERNS = [
  "http://*/*",
  "https://*/*"
];

export function createDefaultSettings() {
  return structuredClone(DEFAULT_SETTINGS);
}

export function normaliseSettings(candidate) {
  const defaults = createDefaultSettings();
  const raw = candidate && typeof candidate === "object" ? candidate : {};
  const providers = Array.isArray(raw.providers) && raw.providers.length
    ? raw.providers.map((provider, index) => ({
      ...structuredClone(DEFAULT_PROVIDER),
      ...provider,
      id: typeof provider?.id === "string" && provider.id ? provider.id : `provider-${index + 1}`,
      models: Array.isArray(provider?.models) ? provider.models.filter((model) => typeof model === "string") : []
    }))
    : defaults.providers;
  const activeProviderId = providers.some((provider) => provider.id === raw.activeProviderId)
    ? raw.activeProviderId
    : providers[0].id;

  return {
    ...defaults,
    ...raw,
    providers,
    activeProviderId,
    privacy: { ...defaults.privacy, ...(raw.privacy ?? {}) },
    appearance: { ...defaults.appearance, ...(raw.appearance ?? {}) },
    agent: { ...defaults.agent, ...(raw.agent ?? {}) },
    features: { ...defaults.features, ...(raw.features ?? {}) }
  };
}
