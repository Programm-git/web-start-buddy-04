import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/ping")({
  server: { handlers: { GET: async () => {
    const t0 = Date.now();
    try { const r = await fetch("https://ai.gateway.lovable.dev/v1/models", { headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}` } }); return new Response(`ok ${r.status} ${Date.now()-t0} key=${!!process.env.LOVABLE_API_KEY}`); }
    catch (e) { return new Response(`err ${e}`); }
  } } },
});
