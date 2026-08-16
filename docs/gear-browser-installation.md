# Gear Browser Distribution Guide

Alexandria:Coding Agent supports two Gear Browser installation routes. Gear documents support for Manifest V3 Web Extensions on iOS and a UserScript engine compatible with Tampermonkey, Greasemonkey, and Violentmonkey.[1]

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---:|---|
| **Full WebExtension (`.crx`)** | Provides the complete Alexandria architecture: provider profiles, permission gates, approval-gated page edits, popup, side panel where supported, and the floating launcher. WebKit API availability must still be tested. | No application cost. A distribution host or store account may have separate costs. | Moderate. Package the extension, preserve its signing key, and host the package from a stable URL. |
| **Gear UserScript fallback** | Provides a draggable in-page chat and OpenAI-compatible requests with local configuration. It is deliberately read-only: no extension popup, provider discovery, approval-gated field write, or repository submission. | No application cost. | Low. Import one `.user.js` file and configure the provider inside the chat. |

## Full extension installation

Gear can install a WebExtension from supported add-on stores or a directly hosted `.crx` package.[1] Alexandria creates its direct-install package with the following command:

```bash
npm run package:gear
```

The output is written to:

```text
dist/alexandria-coding-agent-gear-v<version>.crx
```

Open the hosted `.crx` link in Gear’s extension dashboard or use its direct-file installation flow. Test it on a normal HTTPS coding site, then enable Alexandria on that site from the extension popup to show the floating launcher.

> **Signing-key requirement.** Gear uses the original download URL and a higher extension version to offer an update.[1] The `.crx` must also retain the same extension signing key to remain the same extension. `npm run package:gear` creates a local `.gear-local-signing-key.pem` on first use and excludes it from Git. Keep that key private, backed up, and available for every future release. Do **not** commit it, attach it to GitHub Releases, or paste it into issues.

For a release workflow, save the PEM’s content as the GitHub Actions secret `GEAR_EXTENSION_PRIVATE_KEY`. The included workflow uses that secret only to generate the signed `.crx` during a tagged release. If no secret is configured, it still validates the source and publishes the ZIP and UserScript assets, but skips the CRX job.

## UserScript fallback installation

Gear’s UserScript runtime supports `GM_getValue`, `GM_setValue`, and `GM_xmlhttpRequest`, which Alexandria uses to keep provider configuration in script-isolated storage and send OpenAI-compatible requests.[1]

1. Open `userscripts/alexandria-coding-agent.user.js` from this repository or a GitHub Release in Gear.
2. Use Gear’s import/install action for the script.
3. Visit a coding page. The draggable **A** launcher appears on HTTP and HTTPS pages.
4. Select the launcher, choose the settings control, and enter the OpenAI-compatible base URL, API key if required, and model.
5. Save the provider configuration, then send a test prompt.

The script redacts common token and private-key patterns from captured selected text and the active editable field before sending context to the provider. This is best-effort protection; users should still avoid selecting sensitive text.

## GitHub releases and stable updates

GitHub is appropriate for hosting Alexandria’s source, release notes, ZIP package, and UserScript fallback. Gear’s direct-install update system checks the **same package URL** that was originally installed.[1] A production direct-install URL should therefore remain stable across releases and return one of Gear’s recognized extension MIME types, such as `application/x-chrome-extension`.[1]

A tagged GitHub Actions workflow is included at `.github/workflows/release.yml`. It publishes the extension ZIP and UserScript with every `v*` tag. When `GEAR_EXTENSION_PRIVATE_KEY` is configured, it also signs and attaches the Gear `.crx` artifact. Before relying on GitHub Release downloads for seamless Gear updates, verify Gear’s handling of the release asset URL and its response MIME type; otherwise use a small stable download endpoint or supported add-on store for the CRX.

## Compatibility checklist

Gear advises reviewing WebExtension manifest keys, background behavior, permissions, and API usage against WebKit support before publication.[1] Alexandria should be tested in Gear for the following flows before a public release:

| Test | Expected result |
|---|---|
| Package install | Gear previews and installs the `.crx` without a manifest error. |
| Provider settings | The active provider configuration is saved and a basic completion succeeds. |
| Floating launcher | The icon appears on an enabled HTTPS coding site, can be dragged, and opens the chat window. |
| Permission boundary | The icon does not appear on non-enabled sites or browser-internal pages. |
| Page context | The agent receives the requested page summary only after the site has been enabled. |
| UserScript | The fallback imports, saves provider settings locally, and returns a completion. |

## References

[1] [Gear Browser Extension Documentation](https://gear4.app/doc)
