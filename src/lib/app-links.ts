// Maps spoken/typed app names to URLs that iPad/Safari is allowed to open.
const APPS: Array<{ names: string[]; url: (q?: string) => string; label: string }> = [
  { label: "YouTube", names: ["youtube"], url: (q) => q ? `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` : "https://www.youtube.com" },
  { label: "Karten", names: ["karten", "maps", "apple maps"], url: (q) => q ? `https://maps.apple.com/?q=${encodeURIComponent(q)}` : "https://maps.apple.com" },
  { label: "Google Maps", names: ["google maps"], url: (q) => q ? `https://www.google.com/maps/search/${encodeURIComponent(q)}` : "https://maps.google.com" },
  { label: "Mail", names: ["mail", "e-mail", "email"], url: () => "mailto:" },
  { label: "Google", names: ["google", "safari", "browser", "suche"], url: (q) => q ? `https://www.google.com/search?q=${encodeURIComponent(q)}` : "https://www.google.com" },
  { label: "Wikipedia", names: ["wikipedia"], url: (q) => q ? `https://de.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}` : "https://de.wikipedia.org" },
  { label: "Spotify", names: ["spotify"], url: (q) => q ? `https://open.spotify.com/search/${encodeURIComponent(q)}` : "https://open.spotify.com" },
  { label: "Netflix", names: ["netflix"], url: () => "https://www.netflix.com" },
  { label: "WhatsApp", names: ["whatsapp"], url: () => "https://web.whatsapp.com" },
  { label: "Instagram", names: ["instagram"], url: () => "https://www.instagram.com" },
  { label: "Amazon", names: ["amazon"], url: (q) => q ? `https://www.amazon.de/s?k=${encodeURIComponent(q)}` : "https://www.amazon.de" },
  { label: "Wetter", names: ["wetter"], url: (q) => `https://www.google.com/search?q=${encodeURIComponent("Wetter " + (q ?? ""))}` },
];

export function matchAppCommand(text: string): { label: string; url: string } | null {
  const t = text.toLowerCase().trim().replace(/[.!?]+$/, "");
  const m = t.match(/^(?:bitte\s+)?(?:öffne|oeffne|starte|zeig(?:e)?(?:\s+mir)?|geh(?:e)?\s+zu|such(?:e)?(?:\s+auf)?)\s+(.+)$/);
  if (!m) return null;
  const rest = m[1];
  const sorted = [...APPS].sort((a, b) => Math.max(...b.names.map((n) => n.length)) - Math.max(...a.names.map((n) => n.length)));
  for (const app of sorted) {
    for (const n of app.names) {
      const idx = rest.indexOf(n);
      if (idx === -1) continue;
      const q = (rest.slice(0, idx) + " " + rest.slice(idx + n.length))
        .replace(/\b(nach|auf|in|mit|und|suche|such|für|fuer|die|der|das|app)\b/g, " ")
        .replace(/\s+/g, " ").trim();
      return { label: app.label, url: app.url(q || undefined) };
    }
  }
  return null;
}

export function openLink(url: string) {
  const w = window.open(url, "_blank");
  if (!w) window.location.href = url;
}
