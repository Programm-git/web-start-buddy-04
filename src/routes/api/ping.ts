import { createFileRoute } from "@tanstack/react-router";
import { createResponsesCall } from "@/lib/ai/responses";
export const Route = createFileRoute("/api/ping")({
  server: { handlers: { GET: async ({ request }) => {
    const t0 = Date.now();
    console.log("PING start");
    const c = createResponsesCall(request, { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: process.env.LOVABLE_API_KEY!, model: "openai/gpt-6-astra" }, [{ role: "user", content: "Hallo" }]);
    console.log("PING created", Date.now()-t0);
    const r = await c.response();
    console.log("PING resp", Date.now()-t0);
    return r;
  } } },
});
