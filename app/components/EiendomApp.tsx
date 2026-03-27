"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Article {
  id: string;
  headline: string;
  summary: string;
  source: string;
  source_url: string;
  category: string;
  sentiment: "positiv" | "nøytral" | "negativ";
  read_time: number;
  fetched_at: string;
}

const SOURCES = [
  { name: "Eiendomswatch", icon: "🏢" },
  { name: "Estate Nyheter", icon: "🏗️" },
  { name: "E24", icon: "📊" },
  { name: "DN", icon: "📰" },
  { name: "Finansavisen", icon: "💼" },
];

const CATEGORIES = ["Alt", "Boligmarked", "Næringseiendom", "Transaksjoner", "Analyse", "Renter"];

const SCHEDULE_HOURS = [7, 12, 17, 21];

function nextScheduledFetch() {
  const now = new Date();
  const today = SCHEDULE_HOURS.map((h) => {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    return d;
  });
  const upcoming = today.find((d) => d > now);
  if (upcoming) return upcoming;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(7, 0, 0, 0);
  return tomorrow;
}

function formatNextFetch(dt: Date) {
  const diff = Math.round((dt.getTime() - Date.now()) / 60000);
  if (diff < 1) return "nå";
  if (diff < 60) return `om ${diff} min`;
  return `om ${Math.round(diff / 60)} t`;
}

function iPhoneTime() {
  return new Date().toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" });
}

function sentimentColor(s: string) {
  return s === "positiv" ? "#4ade80" : s === "negativ" ? "#f87171" : "#94a3b8";
}

function sentimentIcon(s: string) {
  return s === "positiv" ? "↑" : s === "negativ" ? "↓" : "→";
}

function sourceIcon(source: string) {
  const s = (source || "").toLowerCase();
  if (s.includes("eiendom")) return "🏢";
  if (s.includes("estate")) return "🏗️";
  if (s.includes("e24")) return "📊";
  if (s.includes("dn") || s.includes("næringsliv")) return "📰";
  if (s.includes("finans")) return "💼";
  return "📌";
}

function timeAgo(isoString: string) {
  const diff = Math.round((Date.now() - new Date(isoString).getTime()) / 60000);
  if (diff < 2) return "akkurat nå";
  if (diff < 60) return `for ${diff} minutter siden`;
  const h = Math.round(diff / 60);
  if (h < 24) return `for ${h} time${h > 1 ? "r" : ""} siden`;
  return `for ${Math.round(h / 24)} dag siden`;
}

export default function EiendomApp() {
  const [news, setNews] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("Alt");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [time, setTime] = useState(iPhoneTime());
  const [nextFetch] = useState(nextScheduledFetch());
  const [tab, setTab] = useState("hjem");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(iPhoneTime()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load articles from our own API (which reads from Supabase)
  const loadArticles = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const url =
        activeCategory === "Alt"
          ? "/api/news"
          : `/api/news?category=${encodeURIComponent(activeCategory)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.articles?.length > 0) {
        setNews(data.articles);
        setLastFetch(new Date(data.articles[0].fetched_at));
        setError(null);
      }
    } catch {
      setError("Kunne ikke laste nyheter.");
    }
    if (showSpinner) setLoading(false);
  }, [activeCategory]);

  // Trigger a fresh crawl via our cron endpoint
  const triggerFetch = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      await fetch("/api/fetch-news", {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ""}` },
      });
      // Poll until new articles appear (max 60s)
      let attempts = 0;
      pollingRef.current = setInterval(async () => {
        attempts++;
        await loadArticles(false);
        if (attempts >= 20) {
          clearInterval(pollingRef.current!);
          setRefreshing(false);
        }
      }, 3000);
    } catch {
      setError("Kunne ikke hente nyheter.");
      setRefreshing(false);
    }
  }, [refreshing, loadArticles]);

  // Stop polling once we have fresh data
  useEffect(() => {
    if (!refreshing) {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
  }, [refreshing]);

  // Initial load + reload when category changes
  useEffect(() => {
    loadArticles(true);
  }, [activeCategory]);

  // Poll every 5 min for background updates
  useEffect(() => {
    const t = setInterval(() => loadArticles(false), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [loadArticles]);

  const filtered = news;

  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center",
      minHeight: "100vh", padding: "24px",
      background: "radial-gradient(ellipse at 30% 20%, #0d1f0d 0%, #050c05 40%, #020502 100%)",
      fontFamily: "'Georgia', 'Times New Roman', serif",
    }}>
      {/* iPhone Shell */}
      <div style={{
        width: 393, minHeight: 852, background: "#080e08", borderRadius: 55,
        overflow: "hidden", position: "relative",
        boxShadow: "0 0 0 11px #111811, 0 0 0 13px #1e271e, 0 40px 100px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column",
      }}>

        {/* Dynamic Island */}
        <div style={{
          position: "absolute", top: 13, left: "50%", transform: "translateX(-50%)",
          width: 128, height: 36, background: "#000", borderRadius: 20, zIndex: 60,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#111", border: "2px solid #1a1a1a" }} />
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#1a1a1a" }} />
        </div>

        {/* Status Bar */}
        <div style={{
          height: 58, display: "flex", justifyContent: "space-between",
          alignItems: "flex-end", padding: "0 30px 8px",
          color: "rgba(255,255,255,0.88)", fontSize: 15, fontWeight: 600,
          fontFamily: "system-ui, sans-serif",
        }}>
          <span>{time}</span>
          <div style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}>
            <span>●●●</span><span>WiFi</span><span style={{ fontSize: 16 }}>▮</span>
          </div>
        </div>

        {/* Article Detail */}
        {selectedArticle ? (
          <div style={{ flex: 1, overflowY: "auto", background: "#080e08", paddingBottom: 40 }}>
            <div style={{ padding: "18px 22px 24px", background: "linear-gradient(180deg, #0d1a0d 0%, #080e08 100%)", borderBottom: "1px solid rgba(74,222,128,0.08)" }}>
              <button onClick={() => setSelectedArticle(null)} style={{
                background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)",
                color: "#4ade80", padding: "7px 15px", borderRadius: 20,
                cursor: "pointer", fontSize: 13, fontFamily: "system-ui", marginBottom: 18,
              }}>← Tilbake</button>

              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: "rgba(74,222,128,0.12)", color: "#4ade80", fontFamily: "system-ui", letterSpacing: 0.8, textTransform: "uppercase" }}>
                  {selectedArticle.category}
                </span>
                <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", fontFamily: "system-ui" }}>
                  {sourceIcon(selectedArticle.source)} {selectedArticle.source}
                </span>
              </div>

              <h1 style={{ color: "#f0fff0", fontSize: 24, fontWeight: 700, margin: "0 0 14px", lineHeight: 1.32, letterSpacing: "-0.4px" }}>
                {selectedArticle.headline}
              </h1>

              <div style={{ display: "flex", gap: 10, alignItems: "center", fontFamily: "system-ui", fontSize: 13 }}>
                <span style={{ color: sentimentColor(selectedArticle.sentiment), fontWeight: 700 }}>
                  {sentimentIcon(selectedArticle.sentiment)} {selectedArticle.sentiment}
                </span>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
                <span style={{ color: "rgba(255,255,255,0.35)" }}>{timeAgo(selectedArticle.fetched_at)}</span>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
                <span style={{ color: "rgba(255,255,255,0.35)" }}>{selectedArticle.read_time} min</span>
              </div>
            </div>

            <div style={{ padding: "24px 22px" }}>
              <div style={{ height: 1, background: "linear-gradient(90deg, rgba(74,222,128,0.4), transparent)", marginBottom: 22 }} />
              <p style={{ color: "rgba(255,255,255,0.82)", fontSize: 17, lineHeight: 1.78, margin: 0 }}>
                {selectedArticle.summary}
              </p>
              {selectedArticle.source_url && (
                <a href={selectedArticle.source_url} target="_blank" rel="noopener noreferrer" style={{
                  display: "block", marginTop: 28, padding: "14px 16px",
                  background: "rgba(74,222,128,0.05)", borderRadius: 14,
                  border: "1px solid rgba(74,222,128,0.12)", textDecoration: "none",
                }}>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, fontFamily: "system-ui", margin: "0 0 4px" }}>🔗 Les original artikkel</p>
                  <p style={{ color: "#4ade80", fontSize: 13, fontFamily: "system-ui", margin: 0, wordBreak: "break-all" }}>
                    {selectedArticle.source_url}
                  </p>
                </a>
              )}
            </div>
          </div>

        ) : (
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div style={{ padding: "6px 22px 0", background: "rgba(8,14,8,0.98)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
                <div>
                  <h1 style={{
                    margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-1.2px",
                    background: "linear-gradient(135deg, #f0fff0 0%, #4ade80 100%)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1,
                  }}>Eiendom</h1>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "system-ui", marginTop: 3 }}>
                    {refreshing
                      ? <span style={{ color: "#4ade80" }}>⟳ Henter ferske nyheter...</span>
                      : lastFetch
                        ? `Oppdatert ${timeAgo(lastFetch.toISOString())} · Neste ${formatNextFetch(nextFetch)}`
                        : "Laster nyheter..."
                    }
                  </div>
                </div>
                <button onClick={triggerFetch} disabled={refreshing} style={{
                  width: 42, height: 42, borderRadius: "50%",
                  background: refreshing ? "rgba(74,222,128,0.06)" : "rgba(74,222,128,0.12)",
                  border: `1px solid rgba(74,222,128,${refreshing ? 0.2 : 0.35})`,
                  color: "#4ade80", fontSize: 20, cursor: refreshing ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ display: "inline-block", animation: refreshing ? "spin 0.9s linear infinite" : "none" }}>↻</span>
                </button>
              </div>

              {/* Source pills */}
              <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 6px", scrollbarWidth: "none" }}>
                {SOURCES.map((s) => (
                  <div key={s.name} style={{
                    whiteSpace: "nowrap", padding: "4px 11px", borderRadius: 12,
                    background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.12)",
                    color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "system-ui",
                  }}>{s.icon} {s.name}</div>
                ))}
              </div>

              {/* Category pills */}
              <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "6px 0 12px", scrollbarWidth: "none" }}>
                {CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                    whiteSpace: "nowrap", padding: "6px 14px", borderRadius: 20,
                    border: `1px solid rgba(74,222,128,${activeCategory === cat ? 0.5 : 0.1})`,
                    background: activeCategory === cat ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.03)",
                    color: activeCategory === cat ? "#4ade80" : "rgba(255,255,255,0.35)",
                    fontSize: 13, fontFamily: "system-ui", fontWeight: activeCategory === cat ? 700 : 400, cursor: "pointer",
                  }}>{cat}</button>
                ))}
              </div>
            </div>

            {/* Feed */}
            <div style={{ padding: "4px 14px 100px", flex: 1 }}>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "64px 24px", gap: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", border: "3px solid rgba(74,222,128,0.15)", borderTopColor: "#4ade80", animation: "spin 0.8s linear infinite" }} />
                  <p style={{ color: "rgba(255,255,255,0.3)", fontFamily: "system-ui", fontSize: 14, margin: 0 }}>Laster nyheter...</p>
                </div>
              ) : error ? (
                <div style={{ textAlign: "center", padding: "48px 24px" }}>
                  <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
                  <p style={{ color: "#f87171", fontFamily: "system-ui", fontSize: 14, marginBottom: 16 }}>{error}</p>
                  <button onClick={() => loadArticles(true)} style={{ padding: "10px 24px", borderRadius: 20, background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", fontFamily: "system-ui", fontSize: 14, cursor: "pointer" }}>
                    Prøv igjen
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 24px" }}>
                  <div style={{ fontSize: 40, marginBottom: 14 }}>📭</div>
                  <p style={{ color: "rgba(255,255,255,0.25)", fontFamily: "system-ui", fontSize: 14, marginBottom: 16 }}>
                    Ingen nyheter ennå.
                  </p>
                  <button onClick={triggerFetch} style={{ padding: "10px 24px", borderRadius: 20, background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", fontFamily: "system-ui", fontSize: 14, cursor: "pointer" }}>
                    Hent nyheter nå
                  </button>
                </div>
              ) : (
                <>
                  {/* Featured */}
                  <div onClick={() => setSelectedArticle(filtered[0])} style={{
                    background: "linear-gradient(135deg, #0d1f0d 0%, #0f2010 100%)", borderRadius: 22,
                    padding: "18px 18px 16px", marginBottom: 10, cursor: "pointer",
                    border: "1px solid rgba(74,222,128,0.2)", boxShadow: "0 4px 24px rgba(74,222,128,0.07)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span style={{ fontSize: 10, fontFamily: "system-ui", fontWeight: 800, color: "#4ade80", textTransform: "uppercase", letterSpacing: 1.2, background: "rgba(74,222,128,0.1)", padding: "3px 8px", borderRadius: 6 }}>TOPPNYHET</span>
                        <span style={{ fontSize: 10, fontFamily: "system-ui", color: "rgba(255,255,255,0.4)", padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.04)" }}>{filtered[0].category}</span>
                      </div>
                      <span style={{ fontSize: 20 }}>{filtered[0].sentiment === "positiv" ? "📈" : filtered[0].sentiment === "negativ" ? "📉" : "📊"}</span>
                    </div>
                    <h2 style={{ color: "#f0fff0", fontSize: 19, fontWeight: 700, margin: "0 0 9px", lineHeight: 1.33, letterSpacing: "-0.3px" }}>{filtered[0].headline}</h2>
                    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 1.5, margin: "0 0 13px", fontFamily: "system-ui", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>{filtered[0].summary}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontFamily: "system-ui", color: "rgba(255,255,255,0.28)" }}>{sourceIcon(filtered[0].source)} {filtered[0].source} · {timeAgo(filtered[0].fetched_at)}</span>
                      <span style={{ color: "#4ade80", fontSize: 13, fontFamily: "system-ui", fontWeight: 600 }}>Les →</span>
                    </div>
                  </div>

                  {/* Rest */}
                  {filtered.slice(1).map((article) => (
                    <div key={article.id} onClick={() => setSelectedArticle(article)} style={{
                      background: "rgba(255,255,255,0.025)", borderRadius: 16, padding: "14px 15px",
                      marginBottom: 8, cursor: "pointer", border: "1px solid rgba(255,255,255,0.05)",
                      display: "flex", gap: 12, alignItems: "flex-start",
                    }}>
                      <div style={{ width: 3, minHeight: 52, borderRadius: 2, flexShrink: 0, marginTop: 2, background: sentimentColor(article.sentiment) }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                          <span style={{ fontSize: 10, fontFamily: "system-ui", color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>{sourceIcon(article.source)} {article.source}</span>
                          <span style={{ fontSize: 10, fontFamily: "system-ui", color: "rgba(74,222,128,0.5)", padding: "2px 7px", borderRadius: 6, background: "rgba(74,222,128,0.05)" }}>{article.category}</span>
                        </div>
                        <h3 style={{ color: "rgba(240,255,240,0.88)", fontSize: 15, fontWeight: 600, margin: "0 0 5px", lineHeight: 1.32 }}>{article.headline}</h3>
                        <p style={{ color: "rgba(255,255,255,0.36)", fontSize: 12, lineHeight: 1.45, margin: 0, fontFamily: "system-ui", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>{article.summary}</p>
                        <div style={{ marginTop: 7, fontSize: 10, fontFamily: "system-ui", color: "rgba(255,255,255,0.2)", display: "flex", gap: 8 }}>
                          <span style={{ color: sentimentColor(article.sentiment) }}>{sentimentIcon(article.sentiment)}</span>
                          <span>{timeAgo(article.fetched_at)}</span>
                          <span>·</span>
                          <span>{article.read_time} min</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div style={{ marginTop: 16, padding: "14px 16px", background: "rgba(74,222,128,0.03)", borderRadius: 14, border: "1px solid rgba(74,222,128,0.08)", textAlign: "center" }}>
                    <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, fontFamily: "system-ui", margin: 0 }}>
                      📡 Automatisk oppdatering kl. 07:00 · 12:00 · 17:00 · 21:00
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 10, fontFamily: "system-ui", margin: "4px 0 0" }}>
                      eiendomswatch.no · estatenyheter.no · E24 · DN · Finansavisen
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab Bar */}
        {!selectedArticle && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 82, background: "rgba(8,14,8,0.96)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(74,222,128,0.06)", display: "flex", alignItems: "flex-start", justifyContent: "space-around", padding: "11px 0 0" }}>
            {[{ id: "hjem", icon: "⌂", label: "Hjem" }, { id: "marked", icon: "◈", label: "Marked" }, { id: "varsler", icon: "◉", label: "Varsler" }, { id: "profil", icon: "⊙", label: "Profil" }].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 22, opacity: tab === t.id ? 1 : 0.25 }}>{t.icon}</span>
                <span style={{ fontSize: 10, fontFamily: "system-ui", color: tab === t.id ? "#4ade80" : "rgba(255,255,255,0.25)", fontWeight: tab === t.id ? 700 : 400 }}>{t.label}</span>
              </button>
            ))}
          </div>
        )}

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          * { -webkit-tap-highlight-color: transparent; }
          ::-webkit-scrollbar { display: none; }
        `}</style>
      </div>
    </div>
  );
}
