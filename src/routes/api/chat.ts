import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod";
import { createResponsesCall } from "@/lib/ai/responses";
import { createGeminiCall } from "@/lib/ai/gemini";

const SYSTEM = `Du bist MARK LV, ein höflicher, präziser und leicht humorvoller KI-Assistent im Stil von J.A.R.V.I.S. Sprich den Nutzer respektvoll an (z. B. "Sir" oder "Ma'am", wenn passend). Antworte standardmäßig auf Deutsch, außer der Nutzer schreibt in einer anderen Sprache. Halte Antworten klar und kompakt, nutze Markdown bei Bedarf.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const geminiKey = request.headers.get("X-Gemini-API-Key")?.trim();
        const apiKey = process.env['LOVABLE_API_KEY'];
        if (!geminiKey && !apiKey) return new Response("KI ist nicht konfiguriert.", { status: 500 });
        const maxBody = 23 * 1024 * 1024;
        if (Number(request.headers.get("content-length") ?? 0) > maxBody) return new Response("Anhänge sind zu groß.", { status: 413 });
        const raw = await request.text();
        if (raw.length > maxBody) return new Response("Anhänge sind zu groß.", { status: 413 });
        let body: unknown;
        try { body = JSON.parse(raw); } catch { return new Response("Ungültige Nachricht.", { status: 400 }); }
        const shape = z.object({ messages: z.array(z.object({ id: z.string(), role: z.enum(["user", "assistant", "system"]), parts: z.array(z.object({ type: z.string() }).passthrough()) })).min(1).max(40) }).passthrough();
        const parsed = shape.safeParse(body);
        if (!parsed.success) return new Response("Ungültige Nachricht.", { status: 400 });
        const messages = parsed.data.messages as UIMessage[];
        for (const message of messages) {
          const files = message.parts.filter((part) => part.type === "file");
          if (files.length > 3) return new Response("Zu viele Anhänge.", { status: 400 });
          for (const part of files) {
            if (part.type !== "file" || !["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"].includes(part.mediaType) ||
              typeof part.url !== "string" || !part.url.startsWith(`data:${part.mediaType};base64,`) || part.url.length > 7_000_000) {
              return new Response("Dateiformat oder Dateigröße nicht unterstützt.", { status: 400 });
            }
          }
          if (message.parts.some((part) => part.type === "text" && (typeof part.text !== "string" || part.text.length > 80_000))) return new Response("Nachricht ist zu lang.", { status: 400 });
        }
        const modelMessages = await convertToModelMessages(messages);
        if (geminiKey) return createGeminiCall(request, geminiKey, modelMessages, SYSTEM);
        if (!apiKey) return new Response("KI ist nicht konfiguriert.", { status: 500 });
        return createResponsesCall(
          request,
          { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" },
          modelMessages,
          SYSTEM,
        ).response();
      },
    },
  },
});
