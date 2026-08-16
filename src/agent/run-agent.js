import { createChatCompletion } from "../providers/openai-compatible.js";
import {
  AGENT_TOOLS,
  ALEXANDRIA_SYSTEM_PROMPT,
  toolResultMessage
} from "./tool-contract.js";

const MAX_TOOL_ROUNDS = 4;
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 14_000;

function boundedText(value, limit = MAX_MESSAGE_CHARS) {
  return String(value ?? "").slice(0, limit);
}

function normaliseHistory(history = []) {
  return history
    .filter((message) => ["user", "assistant"].includes(message?.role))
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: boundedText(message.content)
    }));
}

function parseToolArguments(toolCall) {
  try {
    const parsed = JSON.parse(toolCall.function.arguments || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return null;
  }
}

export async function runAgent({ provider, prompt, history = [], behavior = {}, executeTool, signal }) {
  if (typeof executeTool !== "function") {
    throw new Error("Agent execution requires a local tool executor.");
  }

  const temperature = Math.min(1, Math.max(0, Number(behavior.temperature ?? 0.2)));
  const maxTokens = Math.min(8_000, Math.max(256, Number(behavior.maxOutputTokens ?? 1_200)));
  const messages = [
    { role: "system", content: ALEXANDRIA_SYSTEM_PROMPT },
    ...normaliseHistory(history),
    { role: "user", content: boundedText(prompt) }
  ];
  const events = [];
  const proposals = [];
  let usage = null;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const completion = await createChatCompletion({
      provider,
      messages,
      tools: AGENT_TOOLS,
      temperature,
      maxTokens,
      signal
    });
    usage = completion.usage ?? usage;
    const assistantMessage = completion.message;

    messages.push({
      role: "assistant",
      content: assistantMessage.content,
      tool_calls: assistantMessage.tool_calls.length ? assistantMessage.tool_calls : undefined
    });

    if (!assistantMessage.tool_calls.length) {
      return {
        content: assistantMessage.content || "I completed the available analysis.",
        events,
        proposals,
        usage
      };
    }

    if (round === MAX_TOOL_ROUNDS) {
      return {
        content: "I reached the configured limit for page-inspection steps. Please refine the request or approve an available proposal.",
        events,
        proposals,
        usage
      };
    }

    for (const toolCall of assistantMessage.tool_calls) {
      const args = parseToolArguments(toolCall);
      let result;

      if (!args) {
        result = { ok: false, error: "Tool arguments must be valid JSON." };
      } else {
        try {
          result = await executeTool(toolCall.function.name, args);
        } catch (error) {
          result = { ok: false, error: error?.message || "The requested local tool could not run." };
        }
      }

      if (toolCall.function.name === "propose_page_edit" && result?.proposal) {
        proposals.push(result.proposal);
      }

      events.push({
        name: toolCall.function.name,
        ok: Boolean(result?.ok),
        summary: result?.summary || result?.error || "Tool completed."
      });
      messages.push(toolResultMessage(toolCall.id, result));
    }
  }

  return {
    content: "The agent stopped before completing a response.",
    events,
    proposals,
    usage
  };
}
