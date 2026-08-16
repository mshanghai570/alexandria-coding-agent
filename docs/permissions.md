# Permission Design

**Alexandria:Coding Agent** follows a least-privilege model. The manifest uses Manifest V3, where the extension manifest declares the extension’s capabilities, background service worker, and host-access model.[1]

| Permission category | Initial state | Intended purpose | User-control boundary |
|---|---|---|---|
| `activeTab` | Granted at install | Inspect or inject into the current tab after the user invokes a command or extension action. | Limited to the user-activated current tab. |
| `scripting` | Granted at install | Perform on-demand, user-initiated page-context capture and future editor actions. | Requires `activeTab` or a user-granted site origin. |
| `storage` | Granted at install | Store local extension settings, provider configuration, privacy preferences, and session context. | No remote synchronization is enabled by this scaffold. |
| `sidePanel` | Granted at install | Present the coding-agent interface alongside a coding site. | The user opens the panel through the popup or keyboard shortcut. |
| `contextMenus` | Granted at install | Add the “Ask about selected code” and “Analyze this coding page” actions. | Actions appear only when the user opens the browser context menu. |
| `alarms` | Granted at install | Reserve lightweight scheduling for future agent workflow timers. | No scheduled network action is implemented in this scaffold. |
| Optional host origins | Not granted at install | Reach the user-selected OpenAI-compatible API endpoint or user-enabled coding site. | Each origin is requested interactively when a relevant action requires it. |
| Optional API permissions | Not granted at install | Support future clipboard, download, notification, full tab metadata, or navigation-aware workflows. | No optional API capability may run until separately granted. |

The broad HTTP and HTTPS patterns are listed **only** under `optional_host_permissions`. They establish the set of origins that Alexandria may ask the user to approve at runtime; the extension does not receive blanket website access from this declaration. The popup enables the active site explicitly, while provider model discovery requests only the configured provider origin before making a `GET /models` call.

> **Credential boundary.** API keys are intentionally stored in `chrome.storage.local` rather than project files. The `.gitignore` excludes common local credential files, and no API key is bundled in the manifest, source tree, or build scripts.

## Future permission gates

Future repository actions, form-field writing, pull-request creation, issue submission, uploads, downloads, clipboard access, and provider calls must retain explicit confirmation in the UI. The scaffold defaults `confirmBeforePageWrite`, `confirmBeforeRepositoryAction`, and `redactSecretsBeforeSend` to `true`.

## References

[1] [Microsoft Learn, “Manifest file format for extensions”](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/manifest-format)
