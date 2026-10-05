import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import { Camera, FilePlus2, ImagePlus, Mic, MicOff, Paperclip, Send, Square, Volume2, VolumeX, X } from "lucide-react";
import type { FileUIPart } from "ai";
import { Button } from "@/components/ui/button";
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
  return m.parts.filter((p) => p.type === "text").map((p) => p.text).join("").replace(/\n\n\(System:[^)]*\)$/, "");
}

function Index() {
  const [input, setInput] = useState("");
  const [voice, setVoice] = useState(true);
  const voiceRef = useRef(true);
  const [listening, setListening] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const recRef = useRef<any>(null);
  const submitRef = useRef<(text: string) => Promise<void>>(async () => {});
  const listeningRef = useRef(false);
  const speakingRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: ({ message }) => {
      if (!voiceRef.current || typeof window === "undefined" || !window.speechSynthesis) return;
      const t = textOf(message as any).replace(/[#*`_>]/g, "");
      const u = new SpeechSynthesisUtterance(t);
      u.lang = "de-DE";
      if (listeningRef.current) {
        speakingRef.current = true;
        recRef.current?.stop();
        u.onend = u.onerror = () => {
          speakingRef.current = false;
          if (listeningRef.current) {
            try { recRef.current?.start(); } catch { listeningRef.current = false; setListening(false); }
          }
        };
      }
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    },
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  useEffect(() => () => {
    listeningRef.current = false;
    recRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  const addFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!selected.length) return;
    const allowed = selected.filter((f) =>
      ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain", "text/markdown", "text/csv", "application/json"].includes(f.type) || /\.(txt|md|csv|json)$/i.test(f.name)
    );
    if (allowed.length !== selected.length) setAttachmentError("Dieses Dateiformat wird nicht unterstützt. Bitte Bild, PDF, TXT, MD, CSV oder JSON wählen.");
    else setAttachmentError("");
    const withinLimit = allowed.filter((f) => f.size <= 5 * 1024 * 1024);
    if (withinLimit.length !== allowed.length) setAttachmentError("Dateien dürfen höchstens 5 MB groß sein.");
    setAttachments((current) => [...current, ...withinLimit].slice(0, 3));
  };

  const readDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });

  const submit = async (text: string) => {
    const t = text.trim();
    if ((!t && !attachments.length) || busy) return;
    const app = attachments.length ? null : matchAppCommand(t);
    if (app) {
      openLink(app.url);
      void sendMessage({ text: `${t}\n\n(System: ${app.label} wurde bereits geöffnet. Bestätige kurz.)` });
    } else {
      try {
        const files: FileUIPart[] = [];
        const texts: string[] = [];
        for (const file of attachments) {
          if (file.type.startsWith("image/") || file.type === "application/pdf") {
            files.push({ type: "file", mediaType: file.type, filename: file.name, url: await readDataUrl(file) });
          } else {
            texts.push(`Datei: ${file.name}\n${(await file.text()).slice(0, 25000)}`);
          }
        }
        void sendMessage({ text: [t || "Bitte sieh dir diese Datei an.", ...texts].join("\n\n"), ...(files.length ? { files } : {}) });
        setAttachments([]);
        setAttachmentError("");
      } catch {
        setAttachmentError("Datei konnte nicht gelesen werden. Bitte erneut wählen.");
        return;
      }
    }
    setInput("");
  };
  submitRef.current = submit;

  const toggleMic = () => {
    if (listeningRef.current) {
      listeningRef.current = false;
      setListening(false);
      recRef.current?.stop();
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setAttachmentError("Spracheingabe wird von diesem Browser nicht unterstützt. Bitte Safari oder Chrome aktualisieren."); return; }
    const rec = new SR();
    rec.lang = "de-DE";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) void submitRef.current(e.results[i][0].transcript);
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        listeningRef.current = false;
        setListening(false);
        setAttachmentError("Mikrofonzugriff verweigert. Bitte in den Browser-Einstellungen erlauben.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setAttachmentError("Spracheingabe gerade nicht verfügbar. Bitte erneut versuchen.");
      }
    };
    rec.onend = () => {
      if (listeningRef.current && !speakingRef.current) {
        try { rec.start(); } catch { listeningRef.current = false; setListening(false); }
      }
    };
    recRef.current = rec;
    listeningRef.current = true;
    setListening(true);
    setAttachmentError("");
    try { rec.start(); } catch { listeningRef.current = false; setListening(false); setAttachmentError("Mikrofon konnte nicht gestartet werden."); }
  };

  return (
    <div className="hud-bg min-h-screen text-foreground flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-primary/20">
        <h1 className="font-display text-xl tracking-[0.3em] text-primary hud-glow">MARK LV</h1>
        <div className="flex items-center gap-3 text-xs tracking-widest text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${busy ? "bg-accent animate-pulse" : "bg-primary"}`} />
          {busy ? "VERARBEITE" : "BEREIT"}
          <Button variant="ghost" size="icon" onClick={() => { voiceRef.current = !voice; setVoice(!voice); window.speechSynthesis?.cancel(); }} className="ml-3 text-primary" aria-label="Sprachausgabe umschalten" title="Sprachausgabe umschalten">
            {voice ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center text-center pt-10">
              <div className={`arc-reactor ${busy ? "arc-active" : ""}`}><div /></div>
              <p className="mt-8 font-display tracking-[0.2em] text-primary">GUTEN TAG.</p>
              <p className="mt-2 text-muted-foreground max-w-md">Alle Systeme online. Wie kann ich Ihnen behilflich sein?</p>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-xl">
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="hud-panel h-12 text-primary"><FilePlus2 /> Datei einfügen</Button>
                <Button type="button" variant="outline" onClick={() => cameraRef.current?.click()} className="hud-panel h-12 text-primary"><Camera /> Foto aufnehmen</Button>
                <Button type="button" variant="outline" onClick={() => photoRef.current?.click()} className="hud-panel h-12 text-primary"><ImagePlus /> Foto auswählen</Button>
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
              {m.role === "user" ? (
                <div className="max-w-[80%] rounded-lg bg-primary text-primary-foreground px-4 py-2">
                  {m.parts.filter((p) => p.type === "file").map((p, i) => p.type === "file" ? (
                    <div key={i} className="mb-2">
                      {p.mediaType.startsWith("image/") ? <img src={p.url} alt={p.filename || "Gesendetes Foto"} className="max-h-64 max-w-full object-contain rounded" /> : <span className="text-sm">📎 {p.filename || "Dokument"}</span>}
                    </div>
                  ) : null)}
                  {textOf(m as any)}
                </div>
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

      <form onSubmit={(e) => { e.preventDefault(); void submit(input); }} className="border-t border-primary/20 p-4">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.txt,.md,.csv,.json" multiple hidden onChange={addFiles} aria-label="Datei einfügen" />
        <input ref={photoRef} type="file" accept="image/*" hidden onChange={addFiles} aria-label="Foto auswählen" />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={addFiles} aria-label="Foto aufnehmen" />
        {(attachments.length > 0 || attachmentError) && <div className="mx-auto max-w-3xl mb-2 flex flex-wrap gap-2 items-center text-sm">
          {attachments.map((file, i) => <span key={`${file.name}-${i}`} className="hud-panel inline-flex items-center gap-1 px-2 py-1 text-primary max-w-full truncate">{file.name}<Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-primary" aria-label={`${file.name} entfernen`} onClick={() => setAttachments((a) => a.filter((_, index) => index !== i))}><X size={14} /></Button></span>)}
          {attachmentError && <span role="alert" className="text-destructive">{attachmentError}</span>}
        </div>}
        <div className="mx-auto max-w-3xl hud-panel flex items-end gap-2 p-2">
          <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} className="h-11 w-11 text-primary" aria-label="Datei anhängen" title="Datei anhängen"><Paperclip size={18} /></Button>
          <Button type="button" onClick={toggleMic} variant="ghost" size="icon" className={`h-11 w-11 ${listening ? "bg-accent text-accent-foreground animate-pulse" : "text-primary"}`} aria-label={listening ? "Zuhören beenden" : "Zuhören starten"} title={listening ? "Zuhören beenden" : "Zuhören starten"} aria-pressed={listening}>
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
          </Button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(input); } }}
            rows={1}
            placeholder="Befehl eingeben…"
            className="flex-1 resize-none bg-transparent outline-none py-3 px-2 placeholder:text-muted-foreground"
          />
          {busy ? (
            <Button type="button" onClick={stop} size="icon" className="h-11 w-11 bg-accent text-accent-foreground" aria-label="Stopp"><Square size={18} /></Button>
          ) : (
            <Button type="submit" disabled={!input.trim() && !attachments.length} size="icon" className="h-11 w-11" aria-label="Senden"><Send size={18} /></Button>
          )}
        </div>
      </form>
    </div>
  );
}
