import { describe, expect, it, vi } from "vitest";

const { provider, stream, response } = vi.hoisted(() => ({
  provider: vi.fn(() => "gemini-model"),
  stream: vi.fn(),
  response: vi.fn((_options: { onError: (error: unknown) => string }) => new Response()),
}));
vi.mock("@ai-sdk/google", () => ({ createGoogleGenerativeAI: () => provider }));
vi.mock("ai", () => ({ streamText: stream }));
import { createGeminiCall } from "@/lib/ai/gemini";

describe("Gemini chat", () => {
  it("uses Gemini for the streamed conversation and returns a safe error", () => {
    stream.mockReturnValue({ toUIMessageStreamResponse: response });
    const request = new Request("http://localhost/api/chat");
    createGeminiCall(request, "synthetic-test-only", [{ role: "user", content: "Hallo" }], "MARK LV");
    expect(provider).toHaveBeenCalledWith("gemini-3.1-flash-lite");
    expect(stream.mock.calls[0]?.[0].system).toBe("MARK LV");
    const onError = response.mock.calls[0]?.[0]?.onError;
    expect(onError?.(new Error("sensitive-provider-payload"))).not.toContain("sensitive-provider-payload");
  });
});