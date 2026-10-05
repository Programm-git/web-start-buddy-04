import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Mic, MicOff, Send, Square, Volume2, VolumeX } from "lucide-react";
import { matchAppCommand, openLink } from "@/lib/app-links";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MARK LV – KI-Assistent im Browser" },
      { name: "description", content: "Sprich oder schreibe mit MARK LV, deinem futuristischen KI-Assistenten mit Sprachausgabe." },
      { property: "og:title", content: "MARK LV – KI-Assistent im Browser" },
      { property: "og:description", content: "Futuristischer KI-Assistent mit Chat, Spracheingabe und Sprachausgabe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function textOf(m: { parts: Array<{ type: string; text?: string }> }) {
  return m.parts.filter((p) => p.type === "text").map((p) => p.text).join("");
}

function Index() {
  const [input, setInput] = useState("");
  const [voice, setVoice] = useState(true);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: ({ message }) => {
      if (!voice || typeof window === "undefined" || !window.speechSynthesis) return;
      const t = textOf(message as any).replace(/[#*`_>]/g, "");
      const u = new SpeechSynthesisUtterance(t);
      u.lang = "de-DE";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    },
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    const app = matchAppCommand(t);
    if (app) {
      openLink(app.url);
      sendMessage({ text: `${t}\n\n(System: ${app.label} wurde bereits geöffnet. Bestätige kurz.)` });
    } else {
      sendMessage({ text: t });
    }
    setInput("");
  };

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return alert("Spracheingabe wird von diesem Browser nicht unterstützt (Chrome empfohlen).");
    if (listening) return recRef.current?.stop();
    const rec = new SR();
    rec.lang = "de-DE";
    rec.interimResults = false;
    rec.onresult = (e: any) => submit(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <div className="hud-bg min-h-screen text-foreground flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-primary/20">
        <h1 className="font-display text-xl tracking-[0.3em] text-primary hud-glow">MARK LV</h1>
        <div className="flex items-center gap-3 text-xs tracking-widest text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${busy ? "bg-accent animate-pulse" : "bg-primary"}`} />
          {busy ? "VERARBEITE" : "BEREIT"}
          <button onClick={() => { setVoice(!voice); window.speechSynthesis?.cancel(); }} className="ml-3 p-2 rounded-md hover:bg-primary/10 text-primary" aria-label="Sprachausgabe umschalten">
            {voice ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center text-center pt-10">
              <div className={`arc-reactor ${busy ? "arc-active" : ""}`}><div /></div>
              <p className="mt-8 font-display tracking-[0.2em] text-primary">GUTEN TAG.</p>
              <p className="mt-2 text-muted-foreground max-w-md">Alle Systeme online. Wie kann ich Ihnen behilflich sein?</p>
              <div className="mt-8 grid gap-2 sm:grid-cols-2 w-full max-w-xl">
                {["Erkläre mir Quantencomputer kurz", "Plane meinen produktiven Tag", "Schreibe eine höfliche E-Mail-Absage", "Gib mir 3 Ideen fürs Wochenende"].map((s) => (
                  <button key={s} onClick={() => submit(s)} className="hud-panel text-left text-sm px-4 py-3 hover:border-primary/60 transition">{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
              {m.role === "user" ? (
                <div className="max-w-[80%] rounded-lg bg-primary text-primary-foreground px-4 py-2">{textOf(m as any)}</div>
              ) : (
                <div>
                  <div className="font-display text-[10px] tracking-[0.3em] text-primary mb-1">MARK LV</div>
                  <div className="prose prose-invert max-w-none prose-p:my-2 text-foreground">
                    <ReactMarkdown>{textOf(m as any) || "…"}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}
          {status === "submitted" && <div className="text-primary animate-pulse font-display text-xs tracking-widest">ANALYSIERE…</div>}
          {error && <div className="hud-panel border-destructive/60 text-destructive px-4 py-3 text-sm">Fehler: {error.message}</div>}
          <div ref={endRef} />
        </div>
      </main>

      <form onSubmit={(e) => { e.preventDefault(); submit(input); }} className="border-t border-primary/20 p-4">
        <div className="mx-auto max-w-3xl hud-panel flex items-end gap-2 p-2">
          <button type="button" onClick={toggleMic} className={`p-3 rounded-md ${listening ? "bg-accent text-accent-foreground animate-pulse" : "text-primary hover:bg-primary/10"}`} aria-label="Spracheingabe">
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(input); } }}
            rows={1}
            placeholder="Befehl eingeben…"
            className="flex-1 resize-none bg-transparent outline-none py-3 px-2 placeholder:text-muted-foreground"
          />
          {busy ? (
            <button type="button" onClick={stop} className="p-3 rounded-md bg-accent text-accent-foreground" aria-label="Stopp"><Square size={18} /></button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="p-3 rounded-md bg-primary text-primary-foreground disabled:opacity-40" aria-label="Senden"><Send size={18} /></button>
          )}
        </div>
      </form>
    </div>
  );
}
