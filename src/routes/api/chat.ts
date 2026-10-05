import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, type UIMessage } from "ai";
import { createResponsesCall } from "@/lib/ai/responses";

const SYSTEM = `Du bist MARK LV, ein höflicher, präziser und leicht humorvoller KI-Assistent im Stil von J.A.R.V.I.S. Sprich den Nutzer respektvoll an (z. B. "Sir" oder "Ma'am", wenn passend). Antworte standardmäßig auf Deutsch, außer der Nutzer schreibt in einer anderen Sprache. Halte Antworten klar und kompakt, nutze Markdown bei Bedarf.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("KI ist nicht konfiguriert.", { status: 500 });
        const { messages } = (await request.json()) as { messages: UIMessage[] };
        const modelMessages = [
          { role: "system" as const, content: SYSTEM },
          ...(await convertToModelMessages(messages)),
        ];
        return createResponsesCall(
          request,
          { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" },
          modelMessages,
        ).response();
      },
    },
  },
});
