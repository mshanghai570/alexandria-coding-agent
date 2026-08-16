const PAGE_ADAPTER_FILE = "src/adapters/page-adapter.js";
const PROPOSALS_STORAGE_KEY = "agentProposals";
const MAX_PROPOSALS = 20;
const MAX_REPLACEMENT_CHARS = 100_000;

function proposalSummary(proposal) {
  return {
    id: proposal.id,
    targetId: proposal.targetId,
    rationale: proposal.rationale,
    replacement: proposal.replacement,
    original: proposal.original,
    originalHash: proposal.originalHash,
    createdAt: proposal.createdAt,
    tabId: proposal.tabId
  };
}

async function sendToAdapter(tabId, action, args) {
  return chrome.tabs.sendMessage(tabId, {
    type: "alexandria:page-tool",
    action,
    args
  });
}

export async function dispatchPageTool(tabId, action, args = {}) {
  if (!Number.isInteger(tabId)) {
    return { ok: false, error: "No active coding tab is available." };
  }

  try {
    return await sendToAdapter(tabId, action, args);
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [PAGE_ADAPTER_FILE]
      });
      return await sendToAdapter(tabId, action, args);
    } catch (error) {
      return {
        ok: false,
        error: "Alexandria needs access to this page before it can inspect or edit it. Select ‘Enable on this site’ from the extension popup, then try again.",
        detail: error?.message || "Page adapter injection failed."
      };
    }
  }
}

async function readProposals() {
  const { [PROPOSALS_STORAGE_KEY]: proposals = [] } = await chrome.storage.session.get(PROPOSALS_STORAGE_KEY);
  return Array.isArray(proposals) ? proposals : [];
}

async function writeProposals(proposals) {
  await chrome.storage.session.set({
    [PROPOSALS_STORAGE_KEY]: proposals.slice(-MAX_PROPOSALS)
  });
}

async function createProposal({ tabId, targetId, replacement, rationale, originalHash, original }) {
  if (typeof replacement !== "string" || !replacement.length) {
    return { ok: false, error: "A proposed edit must include replacement text." };
  }
  if (replacement.length > MAX_REPLACEMENT_CHARS) {
    return { ok: false, error: "The proposed edit exceeds Alexandria’s 100,000-character safety limit." };
  }
  if (!originalHash) {
    return { ok: false, error: "Read the editable region before proposing a change." };
  }

  const proposal = {
    id: crypto.randomUUID(),
    tabId,
    targetId,
    replacement,
    original: String(original || "").slice(0, MAX_REPLACEMENT_CHARS),
    rationale: String(rationale || "Proposed by Alexandria.").slice(0, 1_000),
    originalHash,
    createdAt: new Date().toISOString()
  };
  const proposals = await readProposals();
  await writeProposals([...proposals, proposal]);

  return {
    ok: true,
    summary: "Edit proposal created; explicit user approval is required before the page changes.",
    proposal: proposalSummary(proposal)
  };
}

export function createAgentToolExecutor(tabId, policy = {}) {
  const inspectedRegions = new Map();
  const features = policy.features ?? {};
  const privacy = policy.privacy ?? {};

  return async (name, args) => {
    if (["get_page_context", "list_editable_regions", "read_editable_region"].includes(name)) {
      if (privacy.allowPageContext === false) {
        return { ok: false, error: "Page-context access is disabled in Alexandria settings." };
      }
      const response = await dispatchPageTool(tabId, name, args);

      if (name === "read_editable_region" && response?.ok && response.result?.targetId && response.result?.contentHash) {
        inspectedRegions.set(response.result.targetId, {
          hash: response.result.contentHash,
          content: response.result.content ?? ""
        });
      }

      return response?.ok
        ? { ok: true, summary: "Page context read.", ...response.result }
        : response;
    }

    if (name === "propose_page_edit") {
      if (features.pageEditor === false) {
        return { ok: false, error: "Page-edit proposals are disabled in Alexandria settings." };
      }
      const inspectedRegion = inspectedRegions.get(args.targetId);
      return createProposal({
        tabId,
        targetId: args.targetId,
        replacement: args.replacement,
        rationale: args.rationale,
        originalHash: inspectedRegion?.hash,
        original: inspectedRegion?.content
      });
    }

    return { ok: false, error: `Unsupported Alexandria tool: ${name}` };
  };
}

export async function applyApprovedProposal(proposalId, tabId) {
  const proposals = await readProposals();
  const proposal = proposals.find((item) => item.id === proposalId);

  if (!proposal) {
    return { ok: false, error: "This edit proposal is unavailable or has expired." };
  }
  if (proposal.tabId !== tabId) {
    return { ok: false, error: "This proposal belongs to a different browser tab." };
  }

  const response = await dispatchPageTool(tabId, "apply_page_edit", {
    targetId: proposal.targetId,
    replacement: proposal.replacement,
    expectedHash: proposal.originalHash
  });

  if (response?.ok) {
    await writeProposals(proposals.filter((item) => item.id !== proposal.id));
  }

  return response;
}
