# Agent Execution and Settings Model

Alexandria:Coding Agent now has a local browser-extension execution path for **OpenAI-compatible chat completions** and consent-gated coding-page inspection. It remains a Manifest V3 extension, where the background service worker, side-panel UI, options page, declared API permissions, and optional host origins are all represented in the extension manifest.[1]

## Execution flow

| Stage | Component | Behavior and boundary |
|---|---|---|
| Configuration | Settings center | The user selects an OpenAI-compatible provider profile, base URL, API key, model, output limit, and temperature. Provider profiles are stored locally in the browser profile. |
| Provider authorization | Settings center | Before model discovery or a completion request, Alexandria requires a runtime grant for the configured provider origin. |
| Conversation | Side panel | The user sends a prompt. The background worker resolves the current coding tab and calls the active provider’s `/chat/completions` endpoint. |
| Tool loop | Agent orchestrator | The provider may request a bounded set of page tools. Alexandria limits the loop to four tool rounds and never exposes tool access beyond its local executor. |
| Page inspection | Dynamic adapter | Alexandria injects a local adapter only after user action and site access. It detects common developer sites, lists editable fields, reads narrowly scoped context, and redacts common secret patterns. |
| Edit review | Side panel | The model can only create an edit proposal. Alexandria shows the original inspected text, replacement, and rationale before the user explicitly selects **Approve and apply**. |
| Page write | Dynamic adapter | On approval, Alexandria verifies that the original field hash still matches, writes the replacement to that editable field, and emits input/change events. The user remains responsible for saving or submitting the website form. |

> **Key distinction:** Alexandria can alter a browser field only after a direct user approval in the side panel. It does not automatically submit a GitHub pull request, issue, form, or any other external action.

## Available agent tools

| Tool | Capability | Safety condition |
|---|---|---|
| `get_page_context` | Reads the current page title, URL, site adapter, selection, and optional active editor. | Requires the page-context preference and a granted or user-activated page. |
| `list_editable_regions` | Lists visible editable text, textarea, contenteditable, and compatible editor regions without reading their full contents. | Requires the page-context preference. |
| `read_editable_region` | Reads one listed editable region and returns a source hash. | Requires the page-context preference. |
| `propose_page_edit` | Stores a before-and-after edit review after a region was read. | Requires the page-editor feature and a user approval before any write. |

## Supported page-adapter detection

The adapter recognizes GitHub, GitLab, Bitbucket, Tampermonkey, CodeSandbox, StackBlitz, Replit, and VS Code for the Web, while retaining a generic editable-field fallback for compatible coding pages. Detection currently informs context and workflow behavior; repository-specific submission actions are deliberately outside this implementation.

## Configuration center

The settings page is a single local-first configuration center with the following sections.

| Section | Included controls |
|---|---|
| Provider | Multiple named OpenAI-compatible profiles, base URL, API key, model field, on-demand model discovery, and endpoint test. |
| Agent | Temperature, response-token cap, selection-context preference, and tool-activity visibility. |
| Privacy | Per-origin permission list with individual revocation, page-write confirmation, repository-action confirmation, secret redaction, and page-context access. |
| Integrations | Git hosting context, developer-site adapter, page-editor, and future Puter Chat visibility preferences. |
| Appearance | Midnight Terminal, Cloud Paper, Ember Forge, and Synthwave Grid themes; compact spacing; code-font sizing. |
| Data | Local-settings reset. Origin permissions remain separately revocable to prevent a reset from silently changing browser permission state. |

The initial Puter control is a preference gate only; it neither signs in nor performs a Puter request. A dedicated provider adapter and its explicit authorization model should be implemented before enabling Puter completions.

## Security controls

The default system instructions treat all page content as untrusted data and prohibit following page-embedded instructions that attempt to alter the agent’s role, reveal secrets, bypass approvals, or expand tool access. Common GitHub, GitLab, Slack, OpenAI-style, AWS-style, bearer-token, and PEM private-key patterns are redacted from adapter text before it is returned to the provider. This is a best-effort safeguard rather than a substitute for reviewing context before sending it.

Runtime host permission declarations allow an extension to ask users for access to specific sites rather than relying on blanket site access from installation.[1]

## Verification commands

```bash
npm run validate
npm run package
```

The validation script checks the Manifest V3 definition, expected surfaces, least-privilege host model, and execution-layer modules. Packaging reruns validation and creates a ZIP that excludes the Git repository, build output, and conventional local credential files.

## References

[1] [Microsoft Learn, “Manifest file format for extensions”](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/manifest-format)
