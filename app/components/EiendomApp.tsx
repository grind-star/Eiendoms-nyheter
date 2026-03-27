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
  const today = SCHEDULE_HOURS.map((h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d; });
  const upcoming = today.find((d) => d > now);
  if (upcoming) return upcoming;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(7, 0, 0, 0);
  return tomorrow;
}

function formatNextFetch(dt: Date) {
  const diff = Math.round((dt.getTime() - Date.now()) / 60000);
  if (diff < 1) return "nå";
  if (diff < 60) return `om ${diff} min`;
  return `om ${Math.round(diff / 60)} t`;
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
  if (diff < 60) return `for ${diff} min siden`;
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
  const [nextFetch] = useState(nextScheduledFetch());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadArticles = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const url = activeCategory === "Alt" ? "/api/news" : `/api/news?category=${encodeURIComponent(activeCategory)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.articles?.length > 0) {
        setNews(data.articles);
        setLastFetch(new Date(data.articles[0].fetched_at));
        setError(null);
      }
    } catch { setError("Kunne ikke laste nyheter."); }
    if (showSpinner) setLoading(false);
  }, [activeCategory]);

  const triggerFetch = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      await fetch("/api/fetch-news");
      let attempts = 0;
      pollingRef.current = setInterval(async () => {
        attempts++;
        await loadArticles(false);
        if (attempts >= 20) { clearInterval(pollingRef.current!); setRefreshing(false); }
      }, 3000);
    } catch { setError("Kunne ikke hente nyheter."); setRefreshing(false); }
  }, [refreshing, loadArticles]);

  useEffect(() => { if (!refreshing && pollingRef.current) clearInterval(pollingRef.current); }, [refreshing]);
  useEffect(() => { loadArticles(true); }, [activeCategory]);
  useEffect(() => {
    const t = setInterval(() => loadArticles(false), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [loadArticles]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080e08",
      fontFamily: "'Georgia', 'Times New Roman', serif",
    }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px 60px" }}>

        {/* Article Detail */}
        {selectedArticle ? (
          <div style={{ paddingTop: 24 }}>
            <button onClick={() => setSelectedArticle(null)} style={{
              background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)",
              color: "#4ade80", padding: "8px 16px", borderRadius: 20,
              cursor: "pointer", fontSize: 13, fontFamily: "system-ui", marginBottom: 24,
            }}>← Tilbake</button>

            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: "rgba(74,222,128,0.12)", color: "#4ade80", fontFamily: "system-ui", letterSpacing: 0.8, textTransform: "uppercase" }}>
                {selectedArticle.category}
              </span>
              <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", fontFamily: "system-ui" }}>
                {sourceIcon(selectedArticle.source)} {selectedArticle.source}
              </span>
            </div>

            <h1 style={{ color: "#f0fff0", fontSize: 26, fontWeight: 700, margin: "0 0 16px", lineHeight: 1.3, letterSpacing: "-0.5px" }}>
              {selectedArticle.headline}
            </h1>

            <div style={{ display: "flex", gap: 10, alignItems: "center", fontFamily: "system-ui", fontSize: 13, marginBottom: 24 }}>
              <span style={{ color: sentimentColor(selectedArticle.sentiment), fontWeight: 700 }}>
                {sentimentIcon(selectedArticle.sentiment)} {selectedArticle.sentiment}
              </span>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
              <span style={{ color: "rgba(255,255,255,0.35)" }}>{timeAgo(selectedArticle.fetched_at)}</span>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
              <span style={{ color: "rgba(255,255,255,0.35)" }}>{selectedArticle.read_time} min</span>
            </div>

            <div style={{ height: 1, background: "linear-gradient(90deg, rgba(74,222,128,0.4), transparent)", marginBottom: 24 }} />

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
                <p style={{ color: "#4ade80", fontSize: 13, fontFamily: "system-ui", margin: 0, wordBreak: "break-all" }}>{selectedArticle.source_url}</p>
              </a>
            )}
          </div>

        ) : (
          <>
            {/* Header */}
            <div style={{ padding: "28px 0 0", marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div>
                  <h1 style={{
                    margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: "-1.2px",
                    background: "linear-gradient(135deg, #f0fff0 0%, #4ade80 100%)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1,
                  }}>Eiendomsnyheter</h1>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "system-ui", marginTop: 4 }}>
                    {refreshing
                      ? <span style={{ color: "#4ade80" }}>⟳ Henter ferske nyheter...</span>
                      : lastFetch
                        ? `Oppdatert ${timeAgo(lastFetch.toISOString())} · Neste ${formatNextFetch(nextFetch)}`
                        : "Klar"
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
              <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "12px 0 6px", scrollbarWidth: "none" }}>
                {SOURCES.map((s) => (
                  <div key={s.name} style={{
                    whiteSpace: "nowrap", padding: "4px 11px", borderRadius: 12,
                    background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.12)",
                    color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "system-ui",
                  }}>{s.icon} {s.name}</div>
                ))}
              </div>

              {/* Category pills */}
              <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "6px 0 14px", scrollbarWidth: "none" }}>
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
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid rgba(74,222,128,0.15)", borderTopColor: "#4ade80", animation: "spin 0.8s linear infinite" }} />
              </div>
            ) : error ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <p style={{ color: "#f87171", fontFamily: "system-ui", fontSize: 14, marginBottom: 16 }}>{error}</p>
                <button onClick={() => loadArticles(true)} style={{ padding: "10px 24px", borderRadius: 20, background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", fontFamily: "system-ui", fontSize: 14, cursor: "pointer" }}>Prøv igjen</button>
              </div>
            ) : news.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>📭</div>
                <p style={{ color: "rgba(255,255,255,0.25)", fontFamily: "system-ui", fontSize: 14, marginBottom: 16 }}>Ingen nyheter ennå.</p>
                <button onClick={triggerFetch} style={{ padding: "10px 24px", borderRadius: 20, background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", fontFamily: "system-ui", fontSize: 14, cursor: "pointer" }}>Hent nyheter nå</button>
              </div>
            ) : (
              <>
                {/* Featured */}
                <div onClick={() => setSelectedArticle(news[0])} style={{
                  background: "linear-gradient(135deg, #0d1f0d 0%, #0f2010 100%)", borderRadius: 20,
                  padding: "20px", marginBottom: 10, cursor: "pointer",
                  border: "1px solid rgba(74,222,128,0.2)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 10, fontFamily: "system-ui", fontWeight: 800, color: "#4ade80", textTransform: "uppercase", letterSpacing: 1.2, background: "rgba(74,222,128,0.1)", padding: "3px 8px", borderRadius: 6 }}>TOPPNYHET</span>
                      <span style={{ fontSize: 10, fontFamily: "system-ui", color: "rgba(255,255,255,0.4)", padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.04)" }}>{news[0].category}</span>
                    </div>
                    <span style={{ fontSize: 20 }}>{news[0].sentiment === "positiv" ? "📈" : news[0].sentiment === "negativ" ? "📉" : "📊"}</span>
                  </div>
                  <h2 style={{ color: "#f0fff0", fontSize: 20, fontWeight: 700, margin: "0 0 9px", lineHeight: 1.33 }}>{news[0].headline}</h2>
                  <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.5, margin: "0 0 14px", fontFamily: "system-ui", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>{news[0].summary}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontFamily: "system-ui", color: "rgba(255,255,255,0.28)" }}>{sourceIcon(news[0].source)} {news[0].source} · {timeAgo(news[0].fetched_at)}</span>
                    <span style={{ color: "#4ade80", fontSize: 13, fontFamily: "system-ui", fontWeight: 600 }}>Les →</span>
                  </div>
                </div>

                {/* Rest */}
                {news.slice(1).map((article) => (
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
                </div>
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
        body { margin: 0; }
      `}</style>
    </div>
  );
}
