export const EXTENSION_NAME = "Alexandria:Coding Agent";

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
