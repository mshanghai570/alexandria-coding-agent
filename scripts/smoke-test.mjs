import assert from "node:assert/strict";
import { normaliseSettings } from "../src/shared/defaults.js";
import { AGENT_TOOLS } from "../src/agent/tool-contract.js";
import { ProviderError, createChatCompletion } from "../src/providers/openai-compatible.js";

const migrated = normaliseSettings({
  providers: [{ id: "legacy", label: "Legacy", baseUrl: "https://example.test/v1", apiKey: "", model: "demo" }],
  activeProviderId: "legacy"
});

assert.equal(migrated.appearance.theme, "midnight");
assert.equal(migrated.agent.maxOutputTokens, 1200);
assert.equal(migrated.privacy.confirmBeforePageWrite, true);
assert.equal(migrated.features.floatingLauncher, true);
assert.equal(migrated.providers[0].id, "legacy");
assert.deepEqual(
  AGENT_TOOLS.map((tool) => tool.function.name),
  ["get_page_context", "list_editable_regions", "read_editable_region", "propose_page_edit"]
);

await assert.rejects(
  createChatCompletion({
    provider: { baseUrl: "https://example.test/v1", model: "" },
    messages: []
  }),
  (error) => error instanceof ProviderError && /Choose a model/.test(error.message)
);

console.log("Smoke tests passed.");
