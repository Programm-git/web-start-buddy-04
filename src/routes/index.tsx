import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import ReactMarkdown from "react-markdown";
import {
  Camera,
  ChevronRight,
  FilePlus2,
  ImagePlus,
  MapPin,
  Mic,
  MicOff,
  Paperclip,
  Send,
  Square,
  SunMedium,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { FileUIPart } from "ai";
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
  return m.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("")
    .replace(/\n\n\(System:[^)]*\)$/, "");
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
            try {
              recRef.current?.start();
            } catch {
              listeningRef.current = false;
              setListening(false);
            }
          }
        };
      }

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => {
    listeningRef.current = false;
    recRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  const addFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!selected.length) return;

    const allowed = selected.filter(
      (f) =>
        [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "application/pdf",
          "text/plain",
          "text/markdown",
          "text/csv",
          "application/json",
        ].includes(f.type) || /\.(txt|md|csv|json)$/i.test(f.name),
    );

    if (allowed.length !== selected.length) {
      setAttachmentError("Dieses Dateiformat wird nicht unterstützt. Bitte Bild, PDF, TXT, MD, CSV oder JSON wählen.");
    } else {
      setAttachmentError("");
    }

    const withinLimit = allowed.filter((f) => f.size <= 5 * 1024 * 1024);
    if (withinLimit.length !== allowed.length) {
      setAttachmentError("Dateien dürfen höchstens 5 MB groß sein.");
    }

    setAttachments((current) => [...current, ...withinLimit].slice(0, 3));
  };

  const readDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
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

        void sendMessage({
          text: [t || "Bitte sieh dir diese Datei an.", ...texts].join("\n\n"),
          ...(files.length ? { files } : {}),
        });
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
    if (!SR) {
      setAttachmentError("Spracheingabe wird von diesem Browser nicht unterstützt. Bitte Safari oder Chrome aktualisieren.");
      return;
    }

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
        try {
          rec.start();
        } catch {
          listeningRef.current = false;
          setListening(false);
        }
      }
    };

    recRef.current = rec;
    listeningRef.current = true;
    setListening(true);
    setAttachmentError("");

    try {
      rec.start();
    } catch {
      listeningRef.current = false;
      setListening(false);
      setAttachmentError("Mikrofon konnte nicht gestartet werden.");
    }
  };

  return (
    <div className="jarvis-screen">
      <aside className="jarvis-sidebar">
        <div className="jarvis-brand-row">
          <div className="jarvis-brand-mark">J</div>
          <div className="jarvis-brand-text">
            <span className="jarvis-brand-main">J.A.R.V.I.S.</span>
            <span className="jarvis-brand-sub">PERSONAL OPERATIONS</span>
          </div>
        </div>

        <div className="jarvis-card weather-card">
          <div className="jarvis-card-title">WETTER</div>
          <div className="weather-location-row">
            <MapPin size={16} />
            <span>München</span>
          </div>

          <div className="weather-main-row">
            <div className="weather-temp">21</div>
            <div className="weather-degree">°</div>
            <div className="weather-icon-wrap">
              <div className="weather-sun" />
            </div>
          </div>

          <div className="weather-state">Leicht bewölkt</div>

          <div className="weather-forecast">
            <div className="forecast-day">
              <span>Heute</span>
              <SunMedium size={18} />
              <strong>21°</strong>
              <small>12°</small>
            </div>
            <div className="forecast-day">
              <span>Mi</span>
              <SunMedium size={18} />
              <strong>23°</strong>
              <small>13°</small>
            </div>
            <div className="forecast-day">
              <span>Do</span>
              <SunMedium size={18} />
              <strong>19°</strong>
              <small>11°</small>
            </div>
            <div className="forecast-day">
              <span>Fr</span>
              <SunMedium size={18} />
              <strong>22°</strong>
              <small>20°</small>
            </div>
            <div className="forecast-day">
              <span>Sa</span>
              <SunMedium size={18} />
              <strong>20°</strong>
              <small>11°</small>
            </div>
          </div>
        </div>

        <div className="jarvis-card task-card">
          <div className="jarvis-card-title with-meta">
            <span>HEUTE</span>
            <span className="meta-date">Di, 15. Apr. 2025</span>
          </div>

          <div className="task-item task-item-active">
            <div className="task-time">10:00</div>
            <div className="task-copy">
              <span className="task-label">Projektbesprechung</span>
              <small>Besprechungsraum 3. OG</small>
            </div>
          </div>

          <div className="task-item">
            <div className="task-time">16:30</div>
            <div className="task-copy">
              <span className="task-label">Training</span>
              <small>Fitnessstudio</small>
            </div>
          </div>
        </div>

        <div className="jarvis-card compact-card">
          <div className="jarvis-card-title">FOKUSMODUS</div>
          <div className="focus-row">
            <span>Ablenkungen minimieren</span>
            <span className="toggle-pill" />
          </div>
        </div>

        <div className="jarvis-footnote">„GROSSE ZIELE BRAUCHEN KLARE FOKUSSIERUNG.“</div>
      </aside>

      <div className="jarvis-main">
        <header className="jarvis-header">
          <div className="header-left">
            <span className="header-kicker">INTELLIGENCE // PLANNING // PRODUCTIVITY // A MORE FOCUSED YOU</span>
          </div>
          <div className="header-right">
            <div className="online-pill">
              <span className="online-dot" />
              System bereit
            </div>
            <div className="time-pill">19:42</div>
            <button type="button" className="settings-btn">EINSTELLUNGEN</button>
          </div>
        </header>

        <div className="jarvis-stage">
          <div className="jarvis-center-panel">
            <div className="orbital-header">
              <div className="orbital-tag">JARVIS / ONLINE</div>
              <div className="orbital-meta">VERTRAULICH // PERSÖNLICHE ASSISTENTIN // SICHER // IMMER AN DEINER SEITE</div>
            </div>

            <div className="core-scene-wrap">
              <div className={`core3d ${busy ? "core-active" : ""}`} aria-hidden="true">
                <div className="core-scene">
                  <div className="core-ring r1" />
                  <div className="core-ring r2" />
                  <div className="core-ring r3" />
                  <div className="core-ring r4" />
                  <div className="core-orbit o1"><span /></div>
                  <div className="core-orbit o2"><span /></div>
                  <div className="core-heart" />
                </div>
              </div>
            </div>

            <div className="hero-text-block">
              <p className="hero-greeting">Guten Abend.</p>
              <p className="hero-question">Wie kann ich dir helfen?</p>
            </div>

            <div className="jarvis-chat-box">
              <div className="chat-label">JARVIS · ANTWORT</div>
              <div className="chat-bubble">
                {messages.length > 0 ? (
                  <div className="chat-message-stack">
                    {messages.map((m) => (
                      <div key={m.id} className={`chat-line ${m.role}`}>
                        {m.role === "user" ? (
                          <div className="chat-user">{textOf(m as any)}</div>
                        ) : (
                          <div className="chat-assistant">
                            <ReactMarkdown>{textOf(m as any) || "…"}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="chat-placeholder">Alle Systeme sind bereit. Du hast heute zwei Termine. Soll ich dir einen Tag planen?</div>
                )}
              </div>
            </div>
          </div>

          <div className="jarvis-side-stack">
            <div className="jarvis-card system-card">
              <div className="jarvis-card-title">SYSTEMSTATUS</div>

              <div className="system-row">
                <span>CPU</span>
                <div className="bar-wrap"><span style={{ width: "24%" }} /></div>
                <strong>24%</strong>
              </div>
              <div className="system-row">
                <span>RAM</span>
                <div className="bar-wrap"><span style={{ width: "62%" }} /></div>
                <strong>62%</strong>
              </div>

              <div className="device-list">
                <div className="device-item"><span className="device-dot online" /> <span>KI-Kern</span> <strong>Online</strong></div>
                <div className="device-item"><span className="device-dot online" /> <span>Sprachverarbeitung</span> <strong>Online</strong></div>
                <div className="device-item"><span className="device-dot online" /> <span>Datenzugriff</span> <strong>Online</strong></div>
                <div className="device-item"><span className="device-dot online" /> <span>Smart Home</span> <strong>Verbunden</strong></div>
              </div>
            </div>

            <div className="jarvis-card quick-card">
              <div className="jarvis-card-title">SCHNELLZUGRIFF</div>
              <div className="quick-list">
                <button type="button" className="quick-row" onClick={() => fileRef.current?.click()}>
                  <span className="quick-icon">☰</span>
                  <span>Kalender</span>
                  <ChevronRight size={15} />
                </button>
                <button type="button" className="quick-row" onClick={() => fileRef.current?.click()}>
                  <span className="quick-icon">🗂</span>
                  <span>Dateien</span>
                  <ChevronRight size={15} />
                </button>
                <button type="button" className="quick-row" onClick={() => photoRef.current?.click()}>
                  <span className="quick-icon">◌</span>
                  <span>Notiz</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            <div className="jarvis-card secure-card">
              <div className="secure-row">
                <span className="secure-check">✓</span>
                <span>VERBINDUNG SICHER</span>
                <ChevronRight size={15} />
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void submit(input); }} className="jarvis-composer-form">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.txt,.md,.csv,.json" multiple hidden onChange={addFiles} aria-label="Datei einfügen" />
          <input ref={photoRef} type="file" accept="image/*" hidden onChange={addFiles} aria-label="Foto auswählen" />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={addFiles} aria-label="Foto aufnehmen" />

          {(attachments.length > 0 || attachmentError) && (
            <div className="new-ui-attachment-bar">
              {attachments.map((file, i) => (
                <span key={`${file.name}-${i}`} className="new-ui-file-tag">
                  {file.name}
                  <button type="button" className="new-ui-remove-attachment" onClick={() => setAttachments((current) => current.filter((_, idx) => idx !== i))} aria-label={`Datei ${file.name} entfernen`}>
                    <X size={12} />
                  </button>
                </span>
              ))}
              {attachmentError && <span role="alert" className="new-ui-error-inline">{attachmentError}</span>}
            </div>
          )}

          <div className="jarvis-composer">
            <button type="button" className="composer-icon-button" onClick={() => fileRef.current?.click()} aria-label="Datei anhängen">
              <Paperclip size={18} />
            </button>
            <button type="button" className={`composer-icon-button ${listening ? "is-listening" : ""}`} onClick={toggleMic} aria-label="Mikrofon">
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit(input);
                }
              }}
              rows={1}
              placeholder="Frag JARVIS oder gib einen Befehl ein..."
              className="jarvis-input"
            />

            {busy ? (
              <button type="button" className="composer-send stop" onClick={stop} aria-label="Stopp"><Square size={18} /></button>
            ) : (
              <button type="submit" className="composer-send" disabled={!input.trim() && !attachments.length} aria-label="Senden"><Send size={18} /></button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
