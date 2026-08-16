const REQUEST_TIMEOUT_MS = 60_000;

export class ProviderError extends Error {
  constructor(message, { status, code, retryable = false } = {}) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function endpointFor(baseUrl, path) {
  const normalisedBaseUrl = String(baseUrl || "").trim().replace(/\/+$/, "");

  if (!normalisedBaseUrl) {
    throw new ProviderError("Configure a provider base URL before sending a request.");
  }

  let parsed;
  try {
    parsed = new URL(normalisedBaseUrl);
  } catch {
    throw new ProviderError("The configured provider base URL is invalid.");
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new ProviderError("The provider base URL must use HTTP or HTTPS.");
  }

  return `${normalisedBaseUrl}${path}`;
}

function normaliseToolCalls(toolCalls = []) {
  if (!Array.isArray(toolCalls)) {
    return [];
  }

  return toolCalls
    .filter((toolCall) => toolCall?.type === "function" && toolCall.function?.name)
    .map((toolCall) => ({
      id: typeof toolCall.id === "string" ? toolCall.id : crypto.randomUUID(),
      type: "function",
      function: {
        name: toolCall.function.name,
        arguments: typeof toolCall.function.arguments === "string"
          ? toolCall.function.arguments
          : JSON.stringify(toolCall.function.arguments ?? {})
      }
    }));
}

async function parseProviderError(response) {
  let body = "";

  try {
    const payload = await response.json();
    body = payload?.error?.message || payload?.message || JSON.stringify(payload);
  } catch {
    body = await response.text();
  }

  const suffix = body ? `: ${String(body).slice(0, 600)}` : "";
  return new ProviderError(`Provider request failed with HTTP ${response.status}${suffix}`, {
    status: response.status,
    retryable: response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500
  });
}

export async function createChatCompletion({
  provider,
  messages,
  tools = [],
  signal,
  temperature = 0.2,
  maxTokens = 1_200
}) {
  if (!provider?.model?.trim()) {
    throw new ProviderError("Choose a model before sending a request.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const relayAbort = () => controller.abort();

  if (signal) {
    signal.addEventListener("abort", relayAbort, { once: true });
  }

  try {
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };

    if (provider.apiKey?.trim()) {
      headers.Authorization = `Bearer ${provider.apiKey.trim()}`;
    }

    const response = await fetch(endpointFor(provider.baseUrl, "/chat/completions"), {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: provider.model.trim(),
        messages,
        tools: tools.length ? tools : undefined,
        tool_choice: tools.length ? "auto" : undefined,
        temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      throw await parseProviderError(response);
    }

    const payload = await response.json();
    const choice = payload?.choices?.[0];

    if (!choice?.message) {
      throw new ProviderError("The provider response did not include a chat-completion message.");
    }

    return {
      id: payload.id ?? crypto.randomUUID(),
      finishReason: choice.finish_reason ?? null,
      usage: payload.usage ?? null,
      message: {
        role: "assistant",
        content: typeof choice.message.content === "string" ? choice.message.content : "",
        tool_calls: normaliseToolCalls(choice.message.tool_calls)
      }
    };
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }

    if (error?.name === "AbortError") {
      throw new ProviderError("The provider request timed out or was cancelled.", { retryable: true });
    }

    throw new ProviderError(error?.message || "The provider request could not be completed.");
  } finally {
    clearTimeout(timeout);
    if (signal) {
      signal.removeEventListener("abort", relayAbort);
    }
  }
}
