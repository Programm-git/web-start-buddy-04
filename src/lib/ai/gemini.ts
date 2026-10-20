import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, type ModelMessage } from "ai";

export function createGeminiCall(request: Request, apiKey: string, messages: ModelMessage[], system: string) {
  const google = createGoogleGenerativeAI({ apiKey });
  return streamText({
    model: google("gemini-3.1-flash-lite"),
    system,
    messages,
    abortSignal: request.signal,
    onError: () => {}, // Provider errors may contain credentials; never log them.
  }).toUIMessageStreamResponse({
    onError: () => request.signal.aborted ? "Abgebrochen." : "Gemini konnte nicht antworten. Bitte API-Schlüssel, Kontingent und Zugriffsrechte bei Google AI Studio prüfen.",
  });
}