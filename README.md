# Alexandria:Coding Agent

**Alexandria:Coding Agent** is a Microsoft Edge Manifest V3 extension for privacy-conscious, browser-based coding assistance. It provides configurable **OpenAI-compatible** provider profiles, a side-panel agent workspace, consent-gated developer-site context, and an edit-review flow that requires user approval before changing a browser field.

## Implemented capabilities

| Capability | Current behavior |
|---|---|
| OpenAI-compatible providers | Configure multiple named profiles with a base URL, API key, model, model discovery, endpoint test, and active-profile selection. |
| Chat completions | Sends the agent conversation to the active provider’s `/chat/completions` endpoint after the provider origin has been granted. |
| Page-aware tools | The agent can inspect a narrow page summary, list editable regions, read one editable region, and propose an edit. |
| Approval-gated edits | The side panel presents original text, replacement, and rationale. The field changes only after **Approve and apply**; the user still submits or saves the web page manually. |
| Developer-site detection | Recognizes GitHub, GitLab, Bitbucket, Tampermonkey, CodeSandbox, StackBlitz, Replit, and VS Code for the Web, with a generic editable-field fallback. |
| Floating launcher | Shows a draggable Alexandria icon on sites the user explicitly enables. Its per-origin position is stored locally, and clicking it opens a compact in-page chat window. |
| Privacy controls | Provides per-origin access, individual origin revocation, page-context controls, secret-pattern redaction, and confirmation defaults. |
| Appearance | Includes Midnight Terminal, Cloud Paper, Ember Forge, and Synthwave Grid themes, plus compact spacing and configurable code-font size. |
| Optional Puter setting | Exposes an opt-in visibility preference only. It does not yet authenticate with or send data to Puter. |

## Security and permission posture

Alexandria uses **Manifest V3** with a least-privilege default. Provider hosts and coding sites are declared under `optional_host_permissions`, so the extension asks for access to the specific origin only when it is required. It does not receive blanket website access at installation.

The agent treats webpage content, repository text, user scripts, issue comments, and pasted text as **untrusted data**. Its local tool contract disallows silent edits and explicitly limits tool access. Common token and private-key patterns are redacted from page context before it is returned to the provider, but users should still inspect context and proposed edits before proceeding.

> Alexandria does **not** automatically submit pull requests, issues, forms, or any external repository action. It only changes an editable browser field after an explicit approval in the side panel.

## Project structure

```text
alexandria-coding-agent/
├── manifest.json                     # Edge/Chromium Manifest V3 declaration
├── package.json                      # Validation and packaging commands
├── src/
│   ├── adapters/page-adapter.js       # On-demand coding-page inspection and field editing
│   ├── agent/                         # Bounded tool loop and approval-gated proposal bridge
│   ├── background/service-worker.js   # Commands, settings, provider and page-tool routing
│   ├── options/                       # Full configuration center
│   ├── panel/                         # Agent conversation and edit review workspace
│   ├── popup/                         # Current-site access and quick launch controls
│   ├── providers/                     # OpenAI-compatible completion client
│   └── shared/defaults.js             # Settings schema, themes, and migration defaults
├── docs/
│   ├── agent-execution.md             # Architecture, tools, settings, and safety model
│   └── permissions.md                 # Manifest permission rationale
└── scripts/                           # Local validation and clean packaging utilities
```

## Load in Microsoft Edge for development

1. Navigate to `edge://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the `alexandria-coding-agent` project root.
5. Open the extension’s **Details** view to review its baseline permissions and pin it if desired.
6. Select the toolbar icon, open **Provider and privacy settings**, add an OpenAI-compatible profile, discover or select a model, then save.
7. On a coding site, choose **Enable on this site** from the popup. Alexandria immediately adds its draggable launcher to the active page and restores it on future visits to that enabled origin.
8. Drag the launcher to a comfortable location. Select it to open the compact in-page chat; use the minimize control to collapse it again.

## Configuration center

The settings page is organized around six areas: **Provider**, **Agent**, **Privacy**, **Integrations**, **Appearance**, and **Data**. Provider discovery requests the selected API origin before contacting its `/models` endpoint. The Privacy section lists all currently granted provider and website origins and lets users revoke them individually.

Agent preferences control completion temperature, output length, active-selection behavior, and tool-activity visibility. Appearance preferences are applied after saving across the settings page, side panel, popup, and floating launcher. The Integrations section includes a switch to disable the floating launcher entirely; this immediately removes it from open pages and unregisters it for future visits.

## Development commands

```bash
npm run validate
npm run package
```

`npm run validate` checks JSON syntax, Manifest V3 requirements, least-privilege host configuration, expected extension surfaces, and execution-layer module presence. `npm run package` reruns validation and writes a clean ZIP to `dist/`; it excludes the repository, dependencies, generated output, and conventional local credential files.

## Current boundaries and next work

The completion, page-adapter, and approval-flow foundations are implemented. Dedicated repository mutations, local file-system operations, persistent agent jobs, streaming completion output, and the optional Puter provider adapter remain future work. Any future repository or external action should preserve the same explicit, user-visible approval model.

For a detailed technical flow, see [Agent Execution and Settings Model](docs/agent-execution.md) and [Permission Design](docs/permissions.md).
