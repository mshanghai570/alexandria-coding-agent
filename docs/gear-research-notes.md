# Gear Browser Distribution Notes

**Source reviewed:** [Gear Browser Extension Documentation](https://gear4.app/doc), accessed 2026-08-16.

Gear documents support for standards-based **Manifest V3 Web Extensions** on WebKit for iOS. The documentation instructs authors to verify manifest keys, permissions, background logic, and WebExtension API availability against WebKit before publication. It specifically advises event-driven MV3 background logic and durable extension storage.

Gear can install extensions from the Chrome Web Store, Microsoft Edge Add-ons, Firefox Browser Add-ons, or a directly hosted **`.crx`** package. For direct installation, the host should return a recognized extension MIME type, including `application/x-chrome-extension`. Gear checks the original direct-download URL for updates, so an iOS distribution endpoint should remain stable while its package version increases.

Gear also offers a UserScript runtime compatible with Tampermonkey, Greasemonkey, and Violentmonkey. Its documented metadata includes `@match`, `@run-at`, `@connect`, `@grant`, `@updateURL`, and `@downloadURL`. The documented `GM_xmlhttpRequest` API supports provider requests, while `GM_getValue` and `GM_setValue` provide script-isolated local storage. A Gear-specific fallback can therefore offer a draggable in-page chat without depending on desktop-only extension APIs.

The initial Gear release should include a full Chromium package for testing, a direct-install `.crx` build, and a clearly scoped UserScript fallback. The UserScript must explicitly collect and store the user’s provider configuration locally; it must not bundle credentials.
