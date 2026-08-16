(() => {
  if (globalThis.__alexandriaPageAdapterInstalled) {
    return;
  }
  globalThis.__alexandriaPageAdapterInstalled = true;

  const MAX_CONTEXT_CHARS = 6_000;
  const MAX_EDITOR_CHARS = 14_000;
  const elementIds = new WeakMap();
  let nextElementId = 1;

  const SECRET_PATTERNS = [
    /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g,
    /\b(?:sk|rk|pk)-[A-Za-z0-9_-]{16,}\b/g,
    /\bAKIA[0-9A-Z]{16}\b/g,
    /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z]+)? PRIVATE KEY-----/g,
    /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}\b/gi
  ];

  function adapterForLocation() {
    const hostname = location.hostname.toLowerCase();

    if (hostname === "github.com" || hostname.endsWith(".github.com")) {
      return { id: "github", label: "GitHub" };
    }
    if (hostname === "gitlab.com" || hostname.endsWith(".gitlab.com")) {
      return { id: "gitlab", label: "GitLab" };
    }
    if (hostname.includes("bitbucket")) {
      return { id: "bitbucket", label: "Bitbucket" };
    }
    if (hostname.includes("tampermonkey")) {
      return { id: "tampermonkey", label: "Tampermonkey" };
    }
    if (hostname.includes("codesandbox")) {
      return { id: "codesandbox", label: "CodeSandbox" };
    }
    if (hostname.includes("stackblitz")) {
      return { id: "stackblitz", label: "StackBlitz" };
    }
    if (hostname.includes("replit")) {
      return { id: "replit", label: "Replit" };
    }
    if (hostname === "vscode.dev" || hostname.endsWith(".vscode.dev")) {
      return { id: "vscode-web", label: "VS Code for the Web" };
    }

    return { id: "generic", label: "Generic web editor" };
  }

  function clampText(value, limit = MAX_CONTEXT_CHARS) {
    const normalised = String(value ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\u0000/g, "")
      .trim();
    const redacted = SECRET_PATTERNS.reduce(
      (text, pattern) => text.replace(pattern, "[REDACTED_SECRET]"),
      normalised
    );

    return redacted.length > limit ? `${redacted.slice(0, limit)}\n…[truncated]` : redacted;
  }

  function contentHash(value) {
    let hash = 2_166_136_261;
    const text = String(value ?? "");

    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16_777_619);
    }

    return `${hash >>> 0}:${text.length}`;
  }

  function targetIdFor(element) {
    if (!elementIds.has(element)) {
      elementIds.set(element, `editable-${nextElementId}`);
      nextElementId += 1;
    }

    return elementIds.get(element);
  }

  function isVisible(element) {
    const style = getComputedStyle(element);
    const rectangle = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rectangle.width > 0 && rectangle.height > 0;
  }

  function editorKindFor(element) {
    if (element.matches("textarea")) {
      return "textarea";
    }
    if (element.matches("input")) {
      return "input";
    }
    if (element.matches(".cm-content[contenteditable='true'], .CodeMirror-code[contenteditable='true']")) {
      return "code-editor";
    }
    if (element.isContentEditable) {
      return "contenteditable";
    }
    return "unknown";
  }

  function labelForElement(element, index) {
    const labelledBy = element.getAttribute("aria-labelledby");
    const labelledElement = labelledBy ? document.getElementById(labelledBy) : null;
    const label = element.getAttribute("aria-label")
      || element.getAttribute("placeholder")
      || element.getAttribute("name")
      || labelledElement?.textContent
      || element.closest("form")?.querySelector("label")?.textContent
      || `Editable region ${index + 1}`;

    return clampText(label, 120);
  }

  function readElement(element) {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      return element.value;
    }
    return element.innerText ?? element.textContent ?? "";
  }

  function editableElements() {
    const selector = [
      "textarea:not([disabled]):not([readonly])",
      "input[type='text']:not([disabled]):not([readonly])",
      "input[type='search']:not([disabled]):not([readonly])",
      "input[type='url']:not([disabled]):not([readonly])",
      "[contenteditable='true']"
    ].join(",");

    return [...document.querySelectorAll(selector)]
      .filter((element) => isVisible(element))
      .filter((element) => !element.matches("[type='password']"))
      .filter((element) => !element.closest("[aria-hidden='true']"));
  }

  function descriptorFor(element, index) {
    const value = readElement(element);
    return {
      targetId: targetIdFor(element),
      label: labelForElement(element, index),
      kind: editorKindFor(element),
      characters: value.length,
      contentHash: contentHash(value),
      focused: document.activeElement === element || element.contains(document.activeElement),
      editable: true
    };
  }

  function findTarget(targetId) {
    return editableElements().find((element) => targetIdFor(element) === targetId) ?? null;
  }

  function activeEditor() {
    const elements = editableElements();
    const focused = elements.find((element) => document.activeElement === element || element.contains(document.activeElement));
    return focused ?? elements.find((element) => editorKindFor(element) === "code-editor") ?? elements[0] ?? null;
  }

  function selectedText() {
    const selection = window.getSelection()?.toString() ?? "";
    return clampText(selection, MAX_CONTEXT_CHARS);
  }

  function pageSummary(scope) {
    const adapter = adapterForLocation();
    const summary = {
      adapter,
      title: clampText(document.title, 300),
      url: `${location.origin}${location.pathname}`,
      selection: selectedText(),
      editableRegionCount: editableElements().length
    };

    if (scope === "active_editor") {
      const editor = activeEditor();
      if (editor) {
        const raw = readElement(editor);
        summary.activeEditor = {
          ...descriptorFor(editor, 0),
          content: clampText(raw, MAX_EDITOR_CHARS)
        };
      }
    }

    return summary;
  }

  function setNativeValue(element, replacement) {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

    if (setter) {
      setter.call(element, replacement);
    } else {
      element.value = replacement;
    }
  }

  function dispatchEditEvents(element) {
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: null }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function applyEdit({ targetId, replacement, expectedHash }) {
    const target = findTarget(targetId);

    if (!target) {
      return { ok: false, error: "The selected editable region is no longer available." };
    }

    if (typeof replacement !== "string") {
      return { ok: false, error: "A page edit must contain replacement text." };
    }

    const current = readElement(target);
    if (expectedHash && contentHash(current) !== expectedHash) {
      return {
        ok: false,
        conflict: true,
        error: "The editable region changed after Alexandria inspected it. Refresh the proposal before applying it."
      };
    }

    target.focus();
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      setNativeValue(target, replacement);
    } else {
      target.textContent = replacement;
    }
    dispatchEditEvents(target);

    return {
      ok: true,
      summary: "Approved edit applied to the page. Submit or save it manually after reviewing the page.",
      targetId,
      contentHash: contentHash(readElement(target))
    };
  }

  function executeTool(action, args = {}) {
    if (action === "get_page_context") {
      return { ok: true, result: pageSummary(args.scope || "summary") };
    }

    if (action === "list_editable_regions") {
      return {
        ok: true,
        result: {
          adapter: adapterForLocation(),
          regions: editableElements().map(descriptorFor)
        }
      };
    }

    if (action === "read_editable_region") {
      const target = findTarget(args.targetId);
      if (!target) {
        return { ok: false, error: "The requested editable region was not found." };
      }
      const raw = readElement(target);
      return {
        ok: true,
        result: {
          ...descriptorFor(target, 0),
          content: clampText(raw, MAX_EDITOR_CHARS),
          contentHash: contentHash(raw)
        }
      };
    }

    if (action === "apply_page_edit") {
      return applyEdit(args);
    }

    return { ok: false, error: `Unsupported page-adapter action: ${action}` };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "alexandria:page-tool") {
      return false;
    }

    try {
      sendResponse(executeTool(message.action, message.args));
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || "The page adapter failed." });
    }
    return false;
  });
})();
