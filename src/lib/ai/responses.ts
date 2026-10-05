import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.ts";

export function createResponsesCall(
  request: Request,
  config: { baseURL: string; apiKey: string; model: string },
  messages: ModelMessage[],
  system?: string,
) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: `${config.baseURL.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`,
    apiKey: config.apiKey,
    headers: { "Lovable-API-Key": config.apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const reasoning = config.model !== "openai/chat-latest";
  const result = streamText({
    model: provider.responses(config.model),
    ...(system ? { system } : {}),
    abortSignal: request.signal,
    // A stopped or reloaded chat aborts the request; that is expected, not a failure.
    onError: ({ error }) => {
      if (isAbort(error) || request.signal.aborted) return;
      console.error("[chat] stream error", error);
    },
    messages,
    providerOptions: {
      openai: {
        store: false,
        ...(reasoning
          ? {
              forceReasoning: true,
              reasoningEffort: "medium",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            }
          : {}),
      },
    },
  });
  return {
    result,
    response: () =>
      withLovableAiGatewayRunIdHeader(
        result.toUIMessageStreamResponse({
          sendReasoning: true,
          onError: (error) =>
            isAbort(error) ? "Abgebrochen." : error instanceof Error ? error.message : "Unbekannter Fehler.",
        }),
        runIdFetch,
      ).catch((error) => {
        if (isAbort(error) || request.signal.aborted) return new Response(null, { status: 499 });
        throw error;
      }),
  };
}

function isAbort(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.name === "ResponseAborted");
}
