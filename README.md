# Alexandria:Coding Agent

**Alexandria:Coding Agent** is a Microsoft Edge extension designed to become a privacy-conscious coding agent for GitHub, GitLab, browser-based IDEs, documentation pages, Tampermonkey, and other developer workflows. The project uses **Manifest V3** and begins with local-first provider configuration, consent-gated website access, and a side-panel workspace.

## Current scaffold

| Area | Included now | Planned responsibility |
|---|---|---|
| Manifest V3 | Yes | Declares the extension surface, least-privilege baseline permissions, optional host access, keyboard commands, popup, side panel, settings page, and service worker. |
| Provider settings | Yes | Stores a configurable OpenAI-compatible base URL, API key, selected model, and discovered model list locally. |
| Model discovery | Yes | On explicit user action, requests access to the configured provider origin and calls its OpenAI-compatible `/models` endpoint. |
| Developer context | Yes | Adds context-menu commands and keyboard shortcuts that capture selection/page context only after user interaction. |
| Site access | Yes | Requests an origin-specific grant for the active site from the popup instead of receiving blanket web access at installation. |
| Coding-agent execution | Not yet | Provider requests, tool routing, page adapters, edit review, and confirmation-gated write actions. |
| Puter Chat | Configuration flag only | A future opt-in provider adapter and its explicit authorization workflow. |

## Project structure

```text
alexandria-coding-agent/
├── manifest.json                     # Edge/Chromium Manifest V3 declaration
├── package.json                      # Validation and packaging scripts
├── src/
│   ├── background/service-worker.js  # Menus, commands, settings initialization
│   ├── options/                      # Provider, privacy, and integration settings
│   ├── panel/                        # Side-panel coding-agent workspace
│   ├── popup/                        # Extension action popup and per-site grant
│   └── shared/defaults.js            # Default provider and privacy settings
├── docs/permissions.md               # Permission rationale and user-control model
└── scripts/                          # Local validation and packaging utilities
```

## Load in Microsoft Edge for development

1. Navigate to `edge://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this project’s root directory, `alexandria-coding-agent`.
5. Open **Details** to review the requested permissions, then pin the extension if desired.

After loading the extension, select its toolbar icon to open the popup. Use **Provider and privacy settings** to set an OpenAI-compatible base URL, API key, and model. Use **Enable on this site** only on websites where Alexandria should be page-aware.

## Development commands

```bash
npm run validate
npm run package
```

`npm run validate` checks the required Manifest V3 keys, expected entrypoints, permission boundaries, and JSON syntax without any external dependency. `npm run package` first validates, then creates a distributable ZIP under `dist/`; it deliberately omits development artifacts and local credentials.

## Security posture

Alexandria is structured so that a user must deliberately grant access to each provider or coding-site origin. The initial code does not execute arbitrary remote JavaScript, does not write into a page automatically, and does not implement any repository submission flow. Sensitive mutations must remain confirmation-gated as the agent’s capabilities are added.

See [Permission Design](docs/permissions.md) for the rationale behind each declared permission.
