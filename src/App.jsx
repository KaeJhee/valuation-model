import { useState, useEffect, useRef, useCallback } from "react";

/* ══════════════════════════════════════════
   DATA DEFAULTS
   ══════════════════════════════════════════ */
const DEFAULT_STOCK = {
  ticker: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ",
  price: 179.45, prevClose: 175.20, shares: 24.35, ttmRevenue: 216, ttmEPS: 4.90,
  grossMargin: 75, netMargin: 56, high52w: 212.19, low52w: 86.62,
  dayHigh: 179.84, dayLow: 176.85, currentRevLabel: "FY26",
};
const DEFAULT_ANALYST = { consensus: "Strong Buy", avgTarget: 234, buyRating: 42, totalAnalysts: 45, highTarget: 300, lowTarget: 160 };
const mkScenario = (label, emoji, color, tp, pe, rev, eps, cagr, gm, nm, mr1, mr2, thesis, risks, drivers) => ({
  label, emoji, color, colorLight: color.replace(")", ",0.08)").replace("rgb", "rgba"),
  targetPrice: tp, impliedPE: pe, fyRevenue: rev, fyEPS: eps, revenueCAGR: cagr, grossMargin: gm, netMargin: nm,
  midRevenue1: mr1, midRevenue2: mr2, thesis, risks, drivers,
});
const DEFAULT_SCENARIOS = {
  bull: mkScenario("BULL", "\u{1F402}", "rgb(34,197,94)", 411, 38, 550, 10.80, 37, 76, 48, 320, 430,
    "AI infrastructure spending accelerates. Captures 70%+ of data center GPU market through successive platform transitions.",
    "Execution risk on next-gen ramp; geopolitical disruption; valuation overshoot",
    [{ metric: "Capex (2028E)", value: "$2.0T+", detail: "Hyperscaler + sovereign" }, { metric: "Market Share", value: "70%+", detail: "Dominant position holds" }, { metric: "Revenue Target", value: "$550B", detail: "~2.5x current" }, { metric: "Product Cycle", value: "Full ramp", detail: "ASP uplift" }]),
  base: mkScenario("BASE", "\u2696\uFE0F", "rgb(59,130,246)", 287, 33, 400, 8.70, 23, 73, 45, 280, 340,
    "Growth continues but moderates. Custom alternatives capture 15-20% incremental demand. Multiple compresses.",
    "Competition faster than expected; efficiency breakthroughs; macro slowdown",
    [{ metric: "Capex (2028E)", value: "$1.5T", detail: "Growth decelerates" }, { metric: "Market Share", value: "60-65%", detail: "Competitors take share" }, { metric: "Revenue Target", value: "$400B", detail: "~1.85x current" }, { metric: "Multiple", value: "33x P/E", detail: "Compression" }]),
  bear: mkScenario("BEAR", "\u{1F43B}", "rgb(239,68,68)", 205, 26, 320, 7.90, 14, 68, 40, 260, 290,
    "Spending cycle peaks. Competition erodes share. Margins compress. Regulatory headwinds.",
    "This IS the downside \u2014 further deterioration possible if spending is a bubble",
    [{ metric: "Capex (2028E)", value: "$1.1T", detail: "Cycle peaks" }, { metric: "Market Share", value: "50-55%", detail: "Material competition" }, { metric: "Revenue Target", value: "$320B", detail: "~1.5x current" }, { metric: "Margin Pressure", value: "68% GM", detail: "Down from current" }]),
};

const M = "JetBrains Mono, monospace";
const DIM = "rgba(255,255,255,0.35)";

/* ══════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════ */
function getMarketStatus() {
  const et = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay(), mins = et.getHours() * 60 + et.getMinutes();
  if (day === 0 || day === 6) return { status: "closed", label: "WEEKEND", color: "#6b7280" };
  if (mins >= 570 && mins < 960) return { status: "open", label: "MARKET OPEN", color: "#22c55e" };
  if (mins >= 240 && mins < 570) return { status: "pre", label: "PRE-MARKET", color: "#fbbf24" };
  if (mins >= 960 && mins < 1200) return { status: "after", label: "AFTER HOURS", color: "#f97316" };
  return { status: "closed", label: "MARKET CLOSED", color: "#6b7280" };
}

async function safeFetch(url) {
  try {
    const r = await fetch(url);
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) { return { ok: false, status: r.status, data: null, error: text.slice(0, 100) }; }
    return { ok: r.ok, status: r.status, data };
  } catch (e) { return { ok: false, status: 0, data: null, error: e.message }; }
}

/* ══════════════════════════════════════════
   UI COMPONENTS
   ══════════════════════════════════════════ */
function EF({ value, onChange, type = "text", width = 80, suffix = "", prefix = "", fontSize = 13, color = "#e4e4e7" }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 2 }}>
      {prefix && <span style={{ fontSize: fontSize - 2, color: DIM, fontFamily: M }}>{prefix}</span>}
      <input type={type} value={value} onChange={(e) => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
        style={{ width, padding: "2px 4px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color, fontSize, fontWeight: 600, fontFamily: M, outline: "none" }}
        onFocus={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.3)"; e.target.style.background = "rgba(255,255,255,0.1)"; }}
        onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.15)"; e.target.style.background = "rgba(255,255,255,0.06)"; }} />
      {suffix && <span style={{ fontSize: fontSize - 2, color: DIM, fontFamily: M }}>{suffix}</span>}
    </div>
  );
}
function TA({ value, onChange }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#e4e4e7", fontSize: 11.5, lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif", resize: "vertical", outline: "none" }} />;
}
function MiniBar({ value, max, color }) {
  return <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
    <div style={{ width: `${Math.min(100, Math.max(0, (value / max) * 100))}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
  </div>;
}
function RevChart({ stock, scenarios, activeScenario }) {
  const maxV = Math.max(scenarios.bull.fyRevenue, stock.ttmRevenue, 10) * 1.15;
  const cW = 340, cH = 200, pL = 48, pR = 16, pT = 16, pB = 44;
  const iW = cW - pL - pR, iH = cH - pT - pB;
  const gY = v => pT + iH - (v / maxV) * iH, gX = i => pL + (i / 3) * iW;
  const mkP = d => d.map((v, i) => `${i === 0 ? "M" : "L"}${gX(i).toFixed(1)},${gY(v).toFixed(1)}`).join(" ");
  const mkA = d => `M${d.map((v, i) => `${gX(i).toFixed(1)},${gY(v).toFixed(1)}`).join(" L")} L${gX(3).toFixed(1)},${gY(0).toFixed(1)} L${gX(0).toFixed(1)},${gY(0).toFixed(1)} Z`;
  const step = maxV > 400 ? 100 : maxV > 200 ? 50 : maxV > 100 ? 25 : maxV > 40 ? 10 : 5;
  const grid = []; for (let v = 0; v <= maxV; v += step) grid.push(v);
  const labels = [stock.currentRevLabel || "TTM", "Year 1E", "Year 2E", "Target"];
  const order = activeScenario ? [...["bear", "base", "bull"].filter(s => s !== activeScenario), activeScenario] : ["bear", "base", "bull"];
  return (
    <svg viewBox={`0 0 ${cW} ${cH}`} style={{ width: "100%", maxWidth: 420 }}>
      {grid.map(v => <g key={v}><line x1={pL} y1={gY(v)} x2={cW - pR} y2={gY(v)} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} /><text x={pL - 6} y={gY(v) + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="monospace">${v}B</text></g>)}
      {labels.map((l, i) => <text key={i} x={gX(i)} y={cH - 6} textAnchor="middle" fill={DIM} fontSize={8.5} fontFamily="monospace">{l}</text>)}
      {order.map(k => {
        const sc = scenarios[k], d = [stock.ttmRevenue, sc.midRevenue1, sc.midRevenue2, sc.fyRevenue];
        const isA = k === activeScenario, op = activeScenario ? (isA ? 1 : 0.15) : 0.7;
        return <g key={k}><path d={mkA(d)} fill={sc.color} opacity={op * 0.1} /><path d={mkP(d)} fill="none" stroke={sc.color} strokeWidth={isA ? 2.5 : 1.5} opacity={op} strokeLinecap="round" strokeLinejoin="round" />
          {d.map((v, i) => <circle key={i} cx={gX(i)} cy={gY(v)} r={isA ? 3.5 : 2} fill={sc.color} opacity={op} />)}
          {(isA || !activeScenario) && <text x={gX(3) + 6} y={gY(d[3]) + 3} fill={sc.color} fontSize={9} fontWeight={600} fontFamily="monospace" opacity={op}>${d[3]}B</text>}
        </g>;
      })}
    </svg>
  );
}
function DriverEditor({ drivers, onChange, color }) {
  const up = (i, f, v) => onChange(drivers.map((d, j) => j === i ? { ...d, [f]: v } : d));
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
    {drivers.map((d, i) => <div key={i} style={{ padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: 8 }}>
      <input value={d.metric} onChange={e => up(i, "metric", e.target.value)} style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: M, textTransform: "uppercase", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.1)", width: "100%", outline: "none" }} />
      <input value={d.value} onChange={e => up(i, "value", e.target.value)} style={{ fontSize: 16, fontWeight: 700, color, fontFamily: M, marginTop: 4, background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.1)", width: "100%", outline: "none" }} />
      <input value={d.detail} onChange={e => up(i, "detail", e.target.value)} style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 4, background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.1)", width: "100%", outline: "none" }} />
    </div>)}
  </div>;
}
function DebugPanel({ log, onClose }) {
  if (!log) return null;
  return <div style={{ marginTop: 12, padding: 10, background: "rgba(0,0,0,0.4)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
      <span style={{ fontSize: 9, color: DIM, fontFamily: M, textTransform: "uppercase" }}>Lookup: {log.ticker}</span>
      <button onClick={onClose} style={{ fontSize: 9, color: DIM, background: "none", border: "none", cursor: "pointer" }}>{"\u2715"}</button>
    </div>
    {Object.entries(log.endpoints).map(([ep, r]) => {
      const hasData = r.data && (Array.isArray(r.data) ? r.data.length > 0 : typeof r.data === "object" && Object.keys(r.data).length > 0);
      return <div key={ep} style={{ marginBottom: 4, padding: "4px 8px", background: "rgba(255,255,255,0.02)", borderRadius: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: (r.ok && hasData) ? "#22c55e" : "#ef4444", fontFamily: M }}>{(r.ok && hasData) ? "\u2713" : "\u2717"} {ep}</span>
          <span style={{ fontSize: 9, color: DIM, fontFamily: M }}>{r.error || `${r.status}${hasData ? "" : " empty"}`}</span>
        </div>
        {hasData && <details style={{ marginTop: 2 }}><summary style={{ fontSize: 8, color: DIM, cursor: "pointer", fontFamily: M }}>data</summary>
          <pre style={{ fontSize: 7, color: "rgba(255,255,255,0.4)", fontFamily: M, marginTop: 2, padding: 4, background: "rgba(0,0,0,0.3)", borderRadius: 3, maxHeight: 120, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{JSON.stringify(Array.isArray(r.data) ? r.data.slice(0, 2) : r.data, null, 2).slice(0, 800)}</pre>
        </details>}
      </div>;
    })}
  </div>;
}

/* ══════════════════════════════════════════
   MAIN APP
   ══════════════════════════════════════════ */
export default function UniversalModel() {
  const [stock, setStock] = useState(DEFAULT_STOCK);
  const [analyst, setAnalyst] = useState(DEFAULT_ANALYST);
  const [sc, setSc] = useState(DEFAULT_SCENARIOS);
  const [probs, setProbs] = useState({ bull: 25, base: 50, bear: 25 });
  const [active, setActive] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [savedModels, setSavedModels] = useState({});
  const [loadMenuOpen, setLoadMenuOpen] = useState(false);
  const [finnhubKey, setFinnhubKey] = useState("");
  const [fmpKey, setFmpKey] = useState("");
  const [finnhubInput, setFinnhubInput] = useState("");
  const [fmpInput, setFmpInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [feedStatus, setFeedStatus] = useState("disconnected");
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tickDir, setTickDir] = useState(null);
  const [mktStatus, setMktStatus] = useState(getMarketStatus());
  const [fetchCount, setFetchCount] = useState(0);
  const [lookupStatus, setLookupStatus] = useState(null);
  const [lookupMsg, setLookupMsg] = useState("");
  const [debugLog, setDebugLog] = useState(null);
  const intervalRef = useRef(null);
  const mktRef = useRef(null);
  const prevPrice = useRef(null);
  const tickerRef = useRef(stock.ticker);
  const isLive = feedStatus === "live";

  // Init
  useEffect(() => {
    try { const k = localStorage.getItem("gs_fh_key"); if (k) { setFinnhubKey(k); setFinnhubInput(k); } } catch (e) {}
    try { const k = localStorage.getItem("gs_fmp_key"); if (k) { setFmpKey(k); setFmpInput(k); } } catch (e) {}
    try { const s = localStorage.getItem("gs_models"); if (s) setSavedModels(JSON.parse(s)); } catch (e) {}
  }, []);
  useEffect(() => { mktRef.current = setInterval(() => setMktStatus(getMarketStatus()), 30000); return () => clearInterval(mktRef.current); }, []);
  useEffect(() => { tickerRef.current = stock.ticker; }, [stock.ticker]);

  /* ── FINNHUB: LIVE QUOTE POLLING ── */
  const fetchQuote = useCallback(async () => {
    if (!finnhubKey || !tickerRef.current) return;
    setFeedStatus("connecting");
    try {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${tickerRef.current}&token=${finnhubKey}`);
      const d = await r.json();
      if (d.c > 0) {
        if (prevPrice.current !== null) { setTickDir(d.c > prevPrice.current ? "up" : d.c < prevPrice.current ? "down" : null); setTimeout(() => setTickDir(null), 1200); }
        prevPrice.current = d.c;
        setStock(prev => ({ ...prev, price: d.c, prevClose: d.pc || prev.prevClose, dayHigh: d.h || prev.dayHigh, dayLow: d.l || prev.dayLow }));
        setFeedStatus("live"); setLastUpdate(new Date()); setFetchCount(c => c + 1);
      }
    } catch (e) { setFeedStatus("error"); }
  }, [finnhubKey]);

  useEffect(() => {
    if (!finnhubKey) { setFeedStatus("disconnected"); return; }
    fetchQuote();
    const ms = mktStatus.status === "open" ? 15000 : 60000;
    intervalRef.current = setInterval(fetchQuote, ms);
    return () => clearInterval(intervalRef.current);
  }, [finnhubKey, fetchQuote, mktStatus.status]);

  /* ══════════════════════════════════════════
     TICKER LOOKUP
     Finnhub (free): quote, profile, metrics, recommendations
     FMP Starter ($19/mo): price targets, grades, income statements
     ══════════════════════════════════════════ */
  const lookupTicker = async (rawTicker) => {
    const ticker = (rawTicker || "").trim().toUpperCase();
    if (!ticker) return;
    if (!finnhubKey && !fmpKey) { setLookupStatus("error"); setLookupMsg("Connect at least one API key"); setTimeout(() => setLookupStatus(null), 3000); return; }
    setLookupStatus("loading"); setLookupMsg(`Looking up ${ticker}...`);
    const debug = { ticker, endpoints: {} };

    // ── Fire all requests in parallel ──
    const reqs = {};

    // FINNHUB (free tier)
    if (finnhubKey) {
      reqs.fh_profile = safeFetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${finnhubKey}`);
      reqs.fh_quote = safeFetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${finnhubKey}`);
      reqs.fh_metric = safeFetch(`https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${finnhubKey}`);
      reqs.fh_rec = safeFetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${ticker}&token=${finnhubKey}`);
    }

    // FMP Starter ($19/mo)
    if (fmpKey) {
      reqs.fmp_pt = safeFetch(`https://financialmodelingprep.com/stable/price-target-consensus?symbol=${ticker}&apikey=${fmpKey}`);
      reqs.fmp_grades = safeFetch(`https://financialmodelingprep.com/stable/grades-summary?symbol=${ticker}&apikey=${fmpKey}`);
      reqs.fmp_income = safeFetch(`https://financialmodelingprep.com/api/v3/income-statement/${ticker}?limit=4&period=quarter&apikey=${fmpKey}`);
    }

    // Await all
    const keys = Object.keys(reqs);
    const values = await Promise.all(Object.values(reqs));
    const res = {};
    keys.forEach((k, i) => { res[k] = values[i]; debug.endpoints[k.replace("_", "/")] = values[i]; });
    setDebugLog(debug);

    // ── Parse Finnhub ──
    const profile = res.fh_profile?.data;
    const quote = res.fh_quote?.data;
    const met = res.fh_metric?.data?.metric || {};
    const rec = res.fh_rec?.data;

    if (!profile?.name && !(quote?.c > 0)) {
      setLookupStatus("error"); setLookupMsg(`"${ticker}" not found`);
      setTimeout(() => setLookupStatus(null), 3000); return;
    }

    // Shares: Finnhub returns in MILLIONS
    const sharesM = profile?.shareOutstanding || 0;
    const sharesB = +(sharesM / 1000).toFixed(3);

    // ── REVENUE CALCULATION (multi-source) ──
    let revB = 0;

    // Source 1: FMP quarterly income statements — sum last 4 quarters
    const incData = res.fmp_income?.data;
    if (Array.isArray(incData) && incData.length >= 4) {
      const ttmRev = incData.slice(0, 4).reduce((sum, q) => sum + (q.revenue || 0), 0);
      if (ttmRev > 0) revB = +(ttmRev / 1e9).toFixed(1);
    }

    // Source 2 fallback: Finnhub metric revenueTTM (in millions)
    if (revB === 0 && met.revenueTTM) {
      revB = +(met.revenueTTM / 1000).toFixed(1);
    }

    // Source 3 fallback: Finnhub revenuePerShareTTM × shares
    if (revB === 0 && met.revenuePerShareTTM && sharesM > 0) {
      revB = +(met.revenuePerShareTTM * sharesM / 1000).toFixed(1);
    }

    // ── EPS + MARGINS from Finnhub metric ──
    const newEPS = met.epsInclExtraItemsTTM || met.epsTTM || met.epsBasicExclExtraItemsTTM || 0;
    const newGM = met.grossMarginTTM ? +met.grossMarginTTM.toFixed(1) : 0;
    const newNM = met.netProfitMarginTTM ? +met.netProfitMarginTTM.toFixed(1) : 0;

    // Also try computing margins from FMP income statement if Finnhub returns 0
    let gmFromFMP = newGM, nmFromFMP = newNM;
    if ((newGM === 0 || newNM === 0) && Array.isArray(incData) && incData.length >= 4) {
      const ttmRev = incData.slice(0, 4).reduce((s, q) => s + (q.revenue || 0), 0);
      const ttmGP = incData.slice(0, 4).reduce((s, q) => s + (q.grossProfit || 0), 0);
      const ttmNI = incData.slice(0, 4).reduce((s, q) => s + (q.netIncome || 0), 0);
      if (ttmRev > 0) {
        if (newGM === 0 && ttmGP > 0) gmFromFMP = +((ttmGP / ttmRev) * 100).toFixed(1);
        if (newNM === 0 && ttmNI !== 0) nmFromFMP = +((ttmNI / ttmRev) * 100).toFixed(1);
      }
    }

    // Also compute EPS from FMP if Finnhub missed it
    let epsFromFMP = newEPS;
    if (newEPS === 0 && Array.isArray(incData) && incData.length >= 4 && sharesM > 0) {
      const ttmNI = incData.slice(0, 4).reduce((s, q) => s + (q.netIncome || 0), 0);
      if (ttmNI !== 0) epsFromFMP = +(ttmNI / (sharesM * 1e6) * 1e6).toFixed(4); // netIncome in dollars, shares in millions
    }

    const newPrice = (quote?.c > 0) ? quote.c : 0;

    setStock({
      ticker, name: profile?.name || ticker, exchange: profile?.exchange || "\u2014",
      price: newPrice || stock.price, prevClose: quote?.pc || newPrice, dayHigh: quote?.h || newPrice, dayLow: quote?.l || newPrice,
      shares: sharesB || 0.001, high52w: met["52WeekHigh"] || newPrice, low52w: met["52WeekLow"] || newPrice,
      ttmRevenue: revB, ttmEPS: epsFromFMP || newEPS, grossMargin: gmFromFMP || newGM, netMargin: nmFromFMP || newNM,
      currentRevLabel: "TTM",
    });

    // ── ANALYST PRICE TARGETS from FMP Starter ──
    let avgTarget = 0, highTarget = 0, lowTarget = 0;
    const ptData = res.fmp_pt?.data;
    if (Array.isArray(ptData) && ptData.length > 0) {
      const pt = ptData[0];
      avgTarget = pt.targetConsensus || pt.targetMean || pt.targetMedian || 0;
      highTarget = pt.targetHigh || 0;
      lowTarget = pt.targetLow || 0;
    }
    // Fallback: Finnhub metric (sometimes has these on free tier)
    if (avgTarget === 0) avgTarget = met.targetMeanPrice || met.targetMedianPrice || 0;
    if (highTarget === 0) highTarget = met.targetHighPrice || 0;
    if (lowTarget === 0) lowTarget = met.targetLowPrice || 0;

    // ── ANALYST GRADES from FMP Starter ──
    let buyCount = 0, totalCount = 0, consensusLabel = "\u2014";
    const grData = res.fmp_grades?.data;
    if (Array.isArray(grData) && grData.length > 0) {
      const g = grData[0];
      const sb = g.strongBuy || 0, b = g.buy || 0, h = g.hold || 0, s = g.sell || 0, ss = g.strongSell || 0;
      buyCount = sb + b; totalCount = sb + b + h + s + ss;
      consensusLabel = g.consensus || (totalCount > 0 ? (buyCount / totalCount >= 0.75 ? "Strong Buy" : buyCount / totalCount >= 0.55 ? "Buy" : "Hold") : "\u2014");
    }
    // Fallback: Finnhub recommendation
    else if (rec && Array.isArray(rec) && rec.length > 0) {
      const latest = rec[0];
      const sb = latest.strongBuy || 0, b = latest.buy || 0, h = latest.hold || 0, s = latest.sell || 0, ss = latest.strongSell || 0;
      buyCount = sb + b; totalCount = sb + b + h + s + ss;
      const ratio = totalCount > 0 ? buyCount / totalCount : 0;
      consensusLabel = ratio >= 0.75 ? "Strong Buy" : ratio >= 0.55 ? "Buy" : ratio >= 0.4 ? "Hold" : ratio >= 0.2 ? "Sell" : "Strong Sell";
    }

    setAnalyst({ consensus: consensusLabel, avgTarget: +avgTarget.toFixed(2), buyRating: buyCount, totalAnalysts: totalCount, highTarget: +highTarget.toFixed(2), lowTarget: +lowTarget.toFixed(2) });

    // ── AUTO-GENERATE SCENARIO DEFAULTS ──
    const p = newPrice || 1;
    const bullTP = highTarget > 0 ? Math.round(highTarget * 1.1) : Math.round(p * 1.5);
    const baseTP = avgTarget > 0 ? Math.round(avgTarget) : Math.round(p * 1.2);
    const bearTP = lowTarget > 0 ? Math.round(lowTarget * 0.9) : Math.round(p * 0.85);
    const rev = revB || 1;
    const eps = epsFromFMP || newEPS || 0.01;

    setSc(prev => ({
      bull: { ...prev.bull, targetPrice: bullTP, fyRevenue: +(rev * 2).toFixed(1), fyEPS: +(eps * 2.2).toFixed(2), impliedPE: eps > 0 ? Math.round(bullTP / (eps * 2.2)) : 35, midRevenue1: +(rev * 1.3).toFixed(1), midRevenue2: +(rev * 1.6).toFixed(1) },
      base: { ...prev.base, targetPrice: baseTP, fyRevenue: +(rev * 1.5).toFixed(1), fyEPS: +(eps * 1.5).toFixed(2), impliedPE: eps > 0 ? Math.round(baseTP / (eps * 1.5)) : 30, midRevenue1: +(rev * 1.15).toFixed(1), midRevenue2: +(rev * 1.3).toFixed(1) },
      bear: { ...prev.bear, targetPrice: bearTP, fyRevenue: +(rev * 1.1).toFixed(1), fyEPS: +(eps * 1.1).toFixed(2), impliedPE: eps > 0 ? Math.round(bearTP / (eps * 1.1)) : 20, midRevenue1: +(rev * 1.05).toFixed(1), midRevenue2: +(rev * 1.08).toFixed(1) },
    }));

    prevPrice.current = newPrice || null;
    const loaded = [];
    if (profile?.name) loaded.push("profile");
    if (quote?.c) loaded.push("quote");
    if (revB > 0) loaded.push(`revenue ($${revB}B)`);
    if (avgTarget > 0) loaded.push(`target ($${avgTarget.toFixed(0)})`);
    if (totalCount > 0) loaded.push(`grades (${buyCount}/${totalCount})`);
    setLookupStatus("success");
    setLookupMsg(`${profile?.name || ticker} \u2713 [${loaded.join(", ")}]`);
    setTimeout(() => setLookupStatus(null), 6000);
  };

  /* ── SAVE / LOAD ── */
  const saveModel = () => { const k = stock.ticker; const n = { ...savedModels, [k]: { stock, analyst, sc, probs, savedAt: new Date().toISOString() } }; setSavedModels(n); try { localStorage.setItem("gs_models", JSON.stringify(n)); } catch (e) {} };
  const loadModel = k => { const m = savedModels[k]; if (m) { setStock(m.stock); setAnalyst(m.analyst); setSc(m.sc); setProbs(m.probs || { bull: 25, base: 50, bear: 25 }); prevPrice.current = m.stock.price; } setLoadMenuOpen(false); };
  const deleteModel = k => { const n = { ...savedModels }; delete n[k]; setSavedModels(n); try { localStorage.setItem("gs_models", JSON.stringify(n)); } catch (e) {} };
  const resetToTemplate = () => { setStock(DEFAULT_STOCK); setAnalyst(DEFAULT_ANALYST); setSc(DEFAULT_SCENARIOS); setProbs({ bull: 25, base: 50, bear: 25 }); };
  const connectKeys = () => { setFinnhubKey(finnhubInput); setFmpKey(fmpInput); try { if (finnhubInput) localStorage.setItem("gs_fh_key", finnhubInput); if (fmpInput) localStorage.setItem("gs_fmp_key", fmpInput); } catch (e) {} setShowSettings(false); };
  const disconnectAll = () => { setFinnhubKey(""); setFmpKey(""); setFinnhubInput(""); setFmpInput(""); setFeedStatus("disconnected"); setFetchCount(0); prevPrice.current = null; try { localStorage.removeItem("gs_fh_key"); localStorage.removeItem("gs_fmp_key"); } catch (e) {} };

  /* ── DERIVED ── */
  const price = stock.price, dayChange = price - (stock.prevClose || price), dayChangePct = stock.prevClose > 0 ? (dayChange / stock.prevClose) * 100 : 0;
  const mcap = (price * stock.shares / 1000), pe = stock.ttmEPS > 0 ? (price / stock.ttmEPS) : 0;
  const analystMcap = (analyst.avgTarget * stock.shares / 1000);
  const upsidePct = tp => price > 0 ? (((tp - price) / price) * 100).toFixed(0) : "0";
  const scenarioMcap = tp => (tp * stock.shares / 1000);
  const updateSc = (key, field, val) => setSc(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));
  const updateStock = (field, val) => setStock(prev => ({ ...prev, [field]: val }));
  const updateAnalyst = (field, val) => setAnalyst(prev => ({ ...prev, [field]: val }));
  const updateProb = (key, nv) => { const oth = Object.keys(probs).filter(k => k !== key); const rem = 100 - nv; const os = oth.reduce((s, k) => s + probs[k], 0); const np = { ...probs, [key]: nv }; if (os === 0) { np[oth[0]] = Math.round(rem / 2); np[oth[1]] = rem - np[oth[0]]; } else oth.forEach((k, i) => { if (i === oth.length - 1) np[k] = rem - oth.slice(0, -1).reduce((a, ok) => a + np[ok], 0); else np[k] = Math.max(0, Math.min(rem, Math.round((probs[k] / os) * rem))); }); setProbs(np); };
  const evMcap = (probs.bull * scenarioMcap(sc.bull.targetPrice) + probs.base * scenarioMcap(sc.base.targetPrice) + probs.bear * scenarioMcap(sc.bear.targetPrice)) / 100;
  const evPrice = (probs.bull * sc.bull.targetPrice + probs.base * sc.base.targetPrice + probs.bear * sc.bear.targetPrice) / 100;
  const evEPS = (probs.bull * sc.bull.fyEPS + probs.base * sc.base.fyEPS + probs.bear * sc.bear.fyEPS) / 100;
  const evRevenue = (probs.bull * sc.bull.fyRevenue + probs.base * sc.base.fyRevenue + probs.bear * sc.bear.fyRevenue) / 100;
  const evUpside = price > 0 ? ((evPrice - price) / price) * 100 : 0;
  const activeSc = active ? sc[active] : null;

  /* ═══════════ RENDER ═══════════ */
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e4e4e7", fontFamily: "'DM Sans','Helvetica Neue',sans-serif", padding: "24px 16px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 540, margin: "0 auto" }}>

        {/* TOOLBAR */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg,#c084fc,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", fontFamily: M }}>GS</div>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: M, letterSpacing: "0.06em" }}>GHOST STRATEGIES</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowSettings(!showSettings)} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${showSettings ? "#fbbf24" : "rgba(255,255,255,0.1)"}`, background: showSettings ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.03)", color: showSettings ? "#fbbf24" : DIM, fontSize: 10, fontWeight: 600, fontFamily: M }}>{"\u2699"} API</button>
            <button onClick={() => setEditMode(!editMode)} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${editMode ? "#c084fc" : "rgba(255,255,255,0.1)"}`, background: editMode ? "rgba(192,132,252,0.12)" : "rgba(255,255,255,0.03)", color: editMode ? "#c084fc" : DIM, fontSize: 10, fontWeight: 600, fontFamily: M }}>{editMode ? "EDITING" : "EDIT"}</button>
            <button onClick={saveModel} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)", color: "#22c55e", fontSize: 10, fontWeight: 600, fontFamily: M }}>SAVE</button>
            <div style={{ position: "relative" }}>
              <button onClick={() => setLoadMenuOpen(!loadMenuOpen)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: DIM, fontSize: 10, fontWeight: 600, fontFamily: M }}>LOAD</button>
              {loadMenuOpen && <div style={{ position: "absolute", top: "110%", right: 0, minWidth: 180, padding: 8, background: "#1a1a24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, zIndex: 10, animation: "fadeIn 0.15s ease" }}>
                {Object.keys(savedModels).length === 0 ? <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", padding: 8, textAlign: "center" }}>No saved models</div>
                : Object.keys(savedModels).map(k => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", borderRadius: 4, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span onClick={() => loadModel(k)} style={{ fontSize: 11, fontWeight: 600, color: "#e4e4e7", fontFamily: M, flex: 1 }}>{k}</span>
                  <button onClick={e => { e.stopPropagation(); deleteModel(k); }} style={{ fontSize: 9, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>{"\u2715"}</button>
                </div>)}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 4, paddingTop: 4 }}>
                  <button onClick={resetToTemplate} style={{ width: "100%", padding: "6px 8px", borderRadius: 4, border: "none", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)", fontSize: 9, fontFamily: M, cursor: "pointer", textAlign: "left" }}>Reset to NVDA template</button>
                </div>
              </div>}
            </div>
          </div>
        </div>

        {/* STATUS */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: isLive ? "#22c55e" : feedStatus === "error" ? "#ef4444" : "#6b7280", boxShadow: isLive ? "0 0 8px #22c55e66" : "none", animation: isLive ? "pulse 2s infinite" : "none" }} />
              <span style={{ fontSize: 9, fontWeight: 600, fontFamily: M, color: isLive ? "#22c55e" : "#6b7280" }}>{isLive ? "LIVE" : "STATIC"}</span>
            </div>
            <span style={{ fontSize: 9, color: DIM }}>{"\u00B7"}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: mktStatus.color }} />
              <span style={{ fontSize: 9, fontWeight: 600, color: mktStatus.color, fontFamily: M }}>{mktStatus.label}</span>
            </div>
            {finnhubKey && <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", fontFamily: M }}>{"\u00B7"} FH</span>}
            {fmpKey && <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", fontFamily: M }}>{"\u00B7"} FMP</span>}
          </div>
          {lastUpdate && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: M }}>{lastUpdate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
        </div>

        {/* SETTINGS */}
        {showSettings && <div style={{ marginBottom: 12, padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, animation: "fadeIn 0.2s ease" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: DIM, fontWeight: 600, marginBottom: 12 }}>API Configuration</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 12, lineHeight: 1.5 }}>
            <b style={{ color: "#22c55e" }}>Finnhub</b> (free): live quotes, profile, EPS, margins, buy/sell/hold.<br />
            <b style={{ color: "#3b82f6" }}>FMP Starter</b> ($19/mo): <b>analyst price targets</b>, grades, revenue, income statements.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", fontFamily: M, minWidth: 28 }}>FH</span>
              <input type="password" value={finnhubInput} onChange={e => setFinnhubInput(e.target.value)} placeholder="finnhub.io/register" style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e4e4e7", fontSize: 11, fontFamily: M, outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#3b82f6", fontFamily: M, minWidth: 28 }}>FMP</span>
              <input type="password" value={fmpInput} onChange={e => setFmpInput(e.target.value)} placeholder="financialmodelingprep.com (Starter $19/mo)" style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#e4e4e7", fontSize: 11, fontFamily: M, outline: "none" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={connectKeys} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: (finnhubInput || fmpInput) ? "#22c55e" : "rgba(255,255,255,0.1)", color: (finnhubInput || fmpInput) ? "#000" : "#666", fontSize: 11, fontWeight: 700, fontFamily: M }}>CONNECT</button>
            {(finnhubKey || fmpKey) && <button onClick={disconnectAll} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: 10, fontWeight: 600, fontFamily: M }}>DISCONNECT</button>}
          </div>
          <DebugPanel log={debugLog} onClose={() => setDebugLog(null)} />
        </div>}

        {/* HEADER + FETCH */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg,#76b900,#4a7a00)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: M }}>
            {editMode ? <input value={stock.ticker} onChange={e => updateStock("ticker", e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === "Enter") lookupTicker(stock.ticker); }} style={{ width: 36, textAlign: "center", background: "transparent", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: M, outline: "none" }} /> : stock.ticker.slice(0, 4)}
          </div>
          <div style={{ flex: 1 }}>
            {editMode ? <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input value={stock.name} onChange={e => updateStock("name", e.target.value)} style={{ fontSize: 17, fontWeight: 700, background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.15)", color: "#e4e4e7", flex: 1, outline: "none" }} />
                {(finnhubKey || fmpKey) && <button onClick={() => lookupTicker(stock.ticker)} disabled={lookupStatus === "loading"} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(59,130,246,0.4)", background: "rgba(59,130,246,0.1)", color: lookupStatus === "loading" ? "#666" : "#3b82f6", fontSize: 9, fontWeight: 700, fontFamily: M, whiteSpace: "nowrap" }}>{lookupStatus === "loading" ? "..." : "\u21BB FETCH"}</button>}
              </div>
              <input value={stock.exchange} onChange={e => updateStock("exchange", e.target.value)} style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: M, background: "transparent", border: "none", width: "100%", outline: "none", marginTop: 2 }} />
            </> : <>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>{stock.name}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: M }}>{stock.exchange}: {stock.ticker}</div>
            </>}
          </div>
        </div>

        {lookupStatus && <div style={{ padding: "6px 12px", borderRadius: 6, marginBottom: 8, fontSize: 10, fontFamily: M, fontWeight: 600, animation: "fadeIn 0.2s ease",
          background: lookupStatus === "success" ? "rgba(34,197,94,0.08)" : lookupStatus === "error" ? "rgba(239,68,68,0.08)" : "rgba(59,130,246,0.08)",
          color: lookupStatus === "success" ? "#22c55e" : lookupStatus === "error" ? "#ef4444" : "#3b82f6",
          border: `1px solid ${lookupStatus === "success" ? "rgba(34,197,94,0.2)" : lookupStatus === "error" ? "rgba(239,68,68,0.2)" : "rgba(59,130,246,0.2)"}` }}>{lookupMsg}</div>}

        {/* PRICE HERO */}
        <div style={{ marginTop: 8, padding: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 36, fontWeight: 700, fontFamily: M, color: tickDir === "up" ? "#22c55e" : tickDir === "down" ? "#ef4444" : "#fff", transition: "color 0.3s" }}>${price.toFixed(2)}</span>
            {isLive && <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: M, color: dayChange >= 0 ? "#22c55e" : "#ef4444" }}>{dayChange >= 0 ? "+" : ""}{dayChange.toFixed(2)}</span>
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: M, color: dayChange >= 0 ? "#22c55e" : "#ef4444", padding: "2px 6px", borderRadius: 4, background: dayChange >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" }}>{dayChange >= 0 ? "+" : ""}{dayChangePct.toFixed(2)}%</span>
            </div>}
          </div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: DIM, marginBottom: 10, fontWeight: 600 }}>{editMode ? "Fundamental Inputs" : "Current Snapshot"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: editMode ? 14 : 12 }}>
            {[
              { label: "Mkt Cap", value: `$${mcap.toFixed(2)}T` },
              { label: "P/E (TTM)", value: pe > 0 ? `${pe.toFixed(1)}x` : "\u2014" },
              { label: "TTM Rev ($B)", value: `$${stock.ttmRevenue}B`, field: "ttmRevenue", prefix: "$", suffix: "B" },
              { label: "TTM EPS", value: `$${stock.ttmEPS}`, field: "ttmEPS", prefix: "$" },
              { label: "Shares (B)", value: `${stock.shares}B`, field: "shares", suffix: "B" },
              { label: "Gross Margin", value: `${stock.grossMargin}%`, field: "grossMargin", suffix: "%" },
              { label: "Net Margin", value: `${stock.netMargin}%`, field: "netMargin", suffix: "%" },
              { label: isLive ? "Day Range" : "52W Range", value: isLive ? `$${stock.dayLow.toFixed(0)}\u2013$${stock.dayHigh.toFixed(0)}` : `$${stock.low52w}\u2013$${stock.high52w}` },
              { label: "52W Range", value: `$${stock.low52w}\u2013$${stock.high52w}` },
            ].map((item, i) => <div key={i}>
              <div style={{ fontSize: 9, color: DIM, fontFamily: M, textTransform: "uppercase", marginBottom: 3 }}>{item.label}</div>
              {editMode && item.field ? <EF value={stock[item.field]} onChange={v => updateStock(item.field, v)} type="number" width={70} prefix={item.prefix} suffix={item.suffix} />
              : <div style={{ fontSize: 15, fontWeight: 600, fontFamily: M }}>{item.value}</div>}
            </div>)}
          </div>
        </div>

        {/* VALUATION SPECTRUM + ANALYST */}
        <div style={{ marginTop: 16, padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: DIM, fontWeight: 600, marginBottom: 14 }}>Valuation Spectrum</div>
          {(() => {
            const vals = [mcap, analystMcap, scenarioMcap(sc.bear.targetPrice), scenarioMcap(sc.base.targetPrice), scenarioMcap(sc.bull.targetPrice)].filter(v => v > 0);
            if (vals.length === 0) return null;
            const mn = Math.min(...vals) * 0.8, mx = Math.max(...vals) * 1.1, rng = mx - mn || 1;
            const pct = v => Math.max(0, Math.min(100, ((v - mn) / rng) * 100));
            const marks = [
              { label: "CURRENT", value: mcap, mcap: `$${mcap.toFixed(1)}T`, pr: `$${price.toFixed(0)}`, color: "#a78bfa" },
              ...(analyst.avgTarget > 0 ? [{ label: "ANALYST", value: analystMcap, mcap: `$${analystMcap.toFixed(1)}T`, pr: `$${analyst.avgTarget.toFixed(0)}`, color: "#fbbf24" }] : []),
              { label: "BEAR", value: scenarioMcap(sc.bear.targetPrice), mcap: `$${scenarioMcap(sc.bear.targetPrice).toFixed(1)}T`, pr: `$${sc.bear.targetPrice}`, color: "#ef4444" },
              { label: "BASE", value: scenarioMcap(sc.base.targetPrice), mcap: `$${scenarioMcap(sc.base.targetPrice).toFixed(1)}T`, pr: `$${sc.base.targetPrice}`, color: "#3b82f6" },
              { label: "BULL", value: scenarioMcap(sc.bull.targetPrice), mcap: `$${scenarioMcap(sc.bull.targetPrice).toFixed(1)}T`, pr: `$${sc.bull.targetPrice}`, color: "#22c55e" },
            ];
            return <div style={{ position: "relative", marginBottom: 8 }}>
              <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.04)", position: "relative", marginTop: 42, marginBottom: 36 }}>
                {marks.map((m, i) => <div key={i} style={{ position: "absolute", left: `${pct(m.value)}%`, top: "50%", transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ position: "absolute", bottom: 14, whiteSpace: "nowrap", textAlign: "center" }}>
                    <div style={{ fontSize: 7, fontWeight: 700, color: m.color, fontFamily: M }}>{m.label}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.6)", fontFamily: M }}>{m.mcap}</div>
                  </div>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: m.color, boxShadow: `0 0 8px ${m.color}44`, zIndex: 2 }} />
                  <div style={{ position: "absolute", top: 14, whiteSpace: "nowrap", fontSize: 8, color: DIM, fontFamily: M }}>{m.pr}</div>
                </div>)}
              </div>
            </div>;
          })()}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, padding: "12px", background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.12)", borderRadius: 8, marginTop: 4 }}>
            {[
              { l: "Consensus", v: analyst.consensus, f: "consensus", type: "text", w: 75 },
              { l: "Avg Target", v: analyst.avgTarget > 0 ? `$${analyst.avgTarget.toFixed(0)}` : "\u2014", f: "avgTarget", type: "number", w: 55, prefix: "$" },
              { l: "Buy / Total", v: `${analyst.buyRating}/${analyst.totalAnalysts}` },
              { l: "Range", v: analyst.highTarget > 0 ? `$${analyst.lowTarget.toFixed(0)}\u2013${analyst.highTarget.toFixed(0)}` : "\u2014" },
            ].map((x, i) => <div key={i}>
              <div style={{ fontSize: 8, color: DIM, fontFamily: M, textTransform: "uppercase" }}>{x.l}</div>
              {editMode && x.f ? <EF value={analyst[x.f]} onChange={v => updateAnalyst(x.f, v)} type={x.type} width={x.w} prefix={x.prefix} fontSize={11} color="#fbbf24" />
              : <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", fontFamily: M, marginTop: 2 }}>{x.v}</div>}
            </div>)}
          </div>
        </div>

        {/* SCENARIO TABS */}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {["bull", "base", "bear"].map(key => {
            const s = sc[key], isA = active === key, sMcap = scenarioMcap(s.targetPrice);
            return <button key={key} onClick={() => setActive(isA ? null : key)} style={{ flex: 1, padding: "14px 8px", borderRadius: 12, border: `1.5px solid ${isA ? s.color : "rgba(255,255,255,0.08)"}`, background: isA ? s.colorLight : "rgba(255,255,255,0.02)", transition: "all 0.25s", textAlign: "center" }}>
              <div style={{ fontSize: 20 }}>{s.emoji}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: isA ? s.color : "rgba(255,255,255,0.5)", letterSpacing: "0.08em", marginTop: 2, fontFamily: M }}>{s.label}</div>
              {editMode ? <div style={{ marginTop: 4 }}><EF value={s.targetPrice} onChange={v => updateSc(key, "targetPrice", v)} type="number" width={60} prefix="$" fontSize={16} color={isA ? "#fff" : "rgba(255,255,255,0.7)"} /></div>
              : <div style={{ fontSize: 20, fontWeight: 700, color: isA ? "#fff" : "rgba(255,255,255,0.7)", marginTop: 4, fontFamily: M }}>${sMcap.toFixed(1)}T</div>}
              <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>~${s.targetPrice}/sh</div>
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: s.color, fontFamily: M }}>{upsidePct(s.targetPrice) >= 0 ? "+" : ""}{upsidePct(s.targetPrice)}%</div>
            </button>;
          })}
        </div>

        {/* REVENUE CHART */}
        <div style={{ marginTop: 20, padding: "16px 12px 8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: DIM, fontWeight: 600, marginBottom: 4, paddingLeft: 4 }}>Revenue Path</div>
          <RevChart stock={stock} scenarios={sc} activeScenario={active} />
        </div>

        {/* SCENARIO DETAIL */}
        {activeSc && <div style={{ marginTop: 16, animation: "fadeIn 0.3s ease" }}>
          <div style={{ padding: 16, background: activeSc.colorLight, border: `1px solid ${activeSc.color}33`, borderRadius: 12 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: activeSc.color, fontWeight: 700, marginBottom: 12 }}>{activeSc.label} Case {"\u2014"} Key Assumptions</div>
            {editMode ? <DriverEditor drivers={activeSc.drivers} onChange={d => updateSc(active, "drivers", d)} color={activeSc.color} /> : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {activeSc.drivers.map((d, i) => <div key={i} style={{ padding: "10px 12px", background: "rgba(0,0,0,0.3)", borderRadius: 8 }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: M, textTransform: "uppercase" }}>{d.metric}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: activeSc.color, fontFamily: M, marginTop: 2 }}>{d.value}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{d.detail}</div>
              </div>)}
            </div>}
          </div>
          <div style={{ marginTop: 12, padding: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: DIM, fontWeight: 600, marginBottom: 12 }}>Target Financial Summary</div>
            {[{ label: "Revenue", now: `$${stock.ttmRevenue}B`, field: "fyRevenue", suffix: "B", bm: Math.max(sc.bull.fyRevenue, stock.ttmRevenue, 1) * 1.1 },
              { label: "EPS", now: `$${stock.ttmEPS}`, field: "fyEPS", bm: Math.max(sc.bull.fyEPS, stock.ttmEPS, 1) * 1.1 },
              { label: "P/E Multiple", now: pe > 0 ? `${pe.toFixed(1)}x` : "\u2014", field: "impliedPE", suffix: "x", bm: 50 },
              { label: "Rev CAGR", now: "\u2014", field: "revenueCAGR", suffix: "%", bm: 50 },
              { label: "Gross Margin", now: `${stock.grossMargin}%`, field: "grossMargin", suffix: "%", bm: 90 },
              { label: "Net Margin", now: `${stock.netMargin}%`, field: "netMargin", suffix: "%", bm: 70 },
            ].map((r, i) => <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{r.label}</span>
                <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: M }}>{r.now}</span>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{"\u2192"}</span>
                  {editMode ? <EF value={activeSc[r.field]} onChange={v => updateSc(active, r.field, v)} type="number" width={55} suffix={r.suffix} fontSize={12} color={activeSc.color} />
                  : <span style={{ fontSize: 13, fontWeight: 600, color: activeSc.color, fontFamily: M }}>{r.field === "fyRevenue" ? `$${activeSc.fyRevenue}B` : r.field === "fyEPS" ? `$${activeSc.fyEPS}` : `${activeSc[r.field]}${r.suffix || ""}`}</span>}
                </div>
              </div>
              <MiniBar value={activeSc[r.field]} max={r.bm} color={activeSc.color} />
            </div>)}
            {editMode && <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 9, color: DIM, fontFamily: M, marginBottom: 6 }}>REVENUE MID-POINTS</div>
              <div style={{ display: "flex", gap: 8 }}>
                <EF value={activeSc.midRevenue1} onChange={v => updateSc(active, "midRevenue1", v)} type="number" width={60} prefix="Y1 $" suffix="B" fontSize={10} color={activeSc.color} />
                <EF value={activeSc.midRevenue2} onChange={v => updateSc(active, "midRevenue2", v)} type="number" width={60} prefix="Y2 $" suffix="B" fontSize={10} color={activeSc.color} />
              </div>
            </div>}
          </div>
          <div style={{ marginTop: 12, padding: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: DIM, fontWeight: 600, marginBottom: 8 }}>Thesis</div>
            {editMode ? <TA value={activeSc.thesis} onChange={v => updateSc(active, "thesis", v)} /> : <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "rgba(255,255,255,0.7)" }}>{activeSc.thesis}</div>}
            <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, borderLeft: `3px solid ${activeSc.color}55` }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontWeight: 600, marginBottom: 4 }}>Key Risks</div>
              {editMode ? <TA value={activeSc.risks} onChange={v => updateSc(active, "risks", v)} /> : <div style={{ fontSize: 11, lineHeight: 1.5, color: "rgba(255,255,255,0.5)" }}>{activeSc.risks}</div>}
            </div>
          </div>
        </div>}

        {/* VALUATION BRIDGE */}
        <div style={{ marginTop: 20, padding: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: DIM, fontWeight: 600, marginBottom: 12 }}>Valuation Bridge</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 70px", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: "rgba(167,139,250,0.06)", borderLeft: "3px solid #a78bfa" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa", fontFamily: M }}>{isLive ? "LIVE" : "MKT"}</span>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: M }}>${stock.ttmEPS} {"\u00D7"} {pe.toFixed(1)}x = <span style={{ color: "#fff", fontWeight: 600 }}>${price.toFixed(2)}</span></div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#a78bfa", fontFamily: M, textAlign: "right" }}>${mcap.toFixed(1)}T</span>
            </div>
            {analyst.avgTarget > 0 && <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 70px", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: "rgba(251,191,36,0.06)", borderLeft: "3px solid #fbbf24" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24", fontFamily: M }}>ANLST</span>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: M }}>Avg ({analyst.buyRating}/{analyst.totalAnalysts}) = <span style={{ color: "#fff", fontWeight: 600 }}>${analyst.avgTarget.toFixed(0)}</span></div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#fbbf24", fontFamily: M, textAlign: "right" }}>${analystMcap.toFixed(1)}T</span>
            </div>}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 12px" }} />
            {["bull", "base", "bear"].map(k => { const s = sc[k]; return <div key={k} style={{ display: "grid", gridTemplateColumns: "50px 1fr 70px", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: active === k ? s.colorLight : "transparent", cursor: "pointer", transition: "background 0.2s" }} onClick={() => setActive(active === k ? null : k)}>
              <span style={{ fontSize: 10, fontWeight: 700, color: s.color, fontFamily: M }}>{s.label}</span>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: M }}>${s.fyEPS} {"\u00D7"} {s.impliedPE}x = <span style={{ color: "#fff", fontWeight: 600 }}>${s.targetPrice}</span></div>
              <span style={{ fontSize: 11, fontWeight: 600, color: s.color, fontFamily: M, textAlign: "right" }}>{upsidePct(s.targetPrice) >= 0 ? "+" : ""}{upsidePct(s.targetPrice)}%</span>
            </div>; })}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 12px" }} />
            <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 70px", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: "rgba(168,85,247,0.08)", borderLeft: "3px solid #c084fc" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#c084fc", fontFamily: M }}>EV</span>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: M }}>({probs.bull}/{probs.base}/{probs.bear}) = <span style={{ color: "#fff", fontWeight: 600 }}>${evPrice.toFixed(0)}</span></div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#c084fc", fontFamily: M, textAlign: "right" }}>${evMcap.toFixed(1)}T</span>
            </div>
          </div>
        </div>

        {/* PROB-WEIGHTED EV */}
        <div style={{ marginTop: 20, padding: 16, background: "linear-gradient(135deg,rgba(255,255,255,0.03),rgba(168,85,247,0.04))", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 12 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#c084fc", fontWeight: 700, marginBottom: 16 }}>Probability-Weighted Expected Value</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
            {["bull", "base", "bear"].map(k => { const s = sc[k]; return <div key={k}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 16 }}>{s.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: s.color, fontFamily: M }}>{s.label}</span>
                  <span style={{ fontSize: 10, color: DIM }}>{"\u00B7"} ${scenarioMcap(s.targetPrice).toFixed(1)}T</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: M, minWidth: 44, textAlign: "right" }}>{probs[k]}%</div>
              </div>
              <div style={{ position: "relative", height: 28, display: "flex", alignItems: "center" }}>
                <div style={{ position: "absolute", left: 0, right: 0, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)" }}>
                  <div style={{ width: `${probs[k]}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg,${s.color}88,${s.color})`, transition: "width 0.15s" }} />
                </div>
                <input type="range" min={0} max={100} value={probs[k]} onChange={e => updateProb(k, parseInt(e.target.value))} style={{ position: "absolute", left: 0, right: 0, width: "100%", height: 28, opacity: 0, cursor: "pointer", zIndex: 2 }} />
                <div style={{ position: "absolute", left: `${probs[k]}%`, transform: "translateX(-50%)", width: 16, height: 16, borderRadius: "50%", background: s.color, border: "2px solid #0a0a0f", boxShadow: `0 0 10px ${s.color}55`, pointerEvents: "none", transition: "left 0.15s" }} />
              </div>
            </div>; })}
          </div>
          <div style={{ padding: 16, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 9, color: DIM, fontFamily: M, textTransform: "uppercase" }}>Expected Mkt Cap</div><div style={{ fontSize: 28, fontWeight: 700, color: "#c084fc", fontFamily: M, marginTop: 2 }}>${evMcap.toFixed(1)}T</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 9, color: DIM, fontFamily: M, textTransform: "uppercase" }}>Expected Price</div><div style={{ fontSize: 28, fontWeight: 700, color: "#fff", fontFamily: M, marginTop: 2 }}>${evPrice.toFixed(0)}</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div><div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: M, textTransform: "uppercase" }}>EV Upside</div><div style={{ fontSize: 15, fontWeight: 700, color: evUpside >= 0 ? "#22c55e" : "#ef4444", fontFamily: M, marginTop: 2 }}>{evUpside >= 0 ? "+" : ""}{evUpside.toFixed(0)}%</div></div>
              <div><div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: M, textTransform: "uppercase" }}>EV EPS</div><div style={{ fontSize: 15, fontWeight: 600, color: "#c084fc", fontFamily: M, marginTop: 2 }}>${evEPS.toFixed(2)}</div></div>
              <div><div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: M, textTransform: "uppercase" }}>EV Revenue</div><div style={{ fontSize: 15, fontWeight: 600, color: "#c084fc", fontFamily: M, marginTop: 2 }}>${evRevenue.toFixed(0)}B</div></div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 }}>
                {["bull", "base", "bear"].map(k => <div key={k} style={{ width: `${probs[k]}%`, background: sc[k].color, borderRadius: 2, transition: "width 0.3s" }} />)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                {["bull", "base", "bear"].map(k => <div key={k} style={{ fontSize: 9, color: sc[k].color, fontFamily: M }}>{sc[k].label} ${(probs[k] / 100 * sc[k].targetPrice).toFixed(0)}</div>)}
              </div>
            </div>
            {analyst.avgTarget > 0 && <div style={{ marginTop: 12, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: M }}>vs. Analyst (${analyst.avgTarget.toFixed(0)})</span>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: M, color: evPrice > analyst.avgTarget ? "#22c55e" : "#ef4444" }}>{evPrice > analyst.avgTarget ? "+" : ""}{((evPrice - analyst.avgTarget) / analyst.avgTarget * 100).toFixed(0)}%</span>
            </div>}
            <div style={{ marginTop: 6, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: M }}>vs. Current (${price.toFixed(2)})</span>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: M, color: evUpside >= 0 ? "#22c55e" : "#ef4444" }}>{evUpside >= 0 ? "+" : ""}{evUpside.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: M, lineHeight: 1.6 }}>
            GHOST STRATEGIES LLC {"\u2014"} NOT FINANCIAL ADVICE<br />
            {isLive ? "LIVE VIA FINNHUB" : "USER ASSUMPTIONS"}{fmpKey ? " + FMP" : ""} {"\u00B7"} {stock.ticker} ${price.toFixed(2)}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        *{box-sizing:border-box;margin:0;padding:0}
        button{font-family:inherit;cursor:pointer}
        input[type="range"]{-webkit-appearance:none;appearance:none;background:transparent}
        input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:transparent;cursor:pointer}
        input[type="range"]::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:transparent;border:none;cursor:pointer}
      `}</style>
    </div>
  );
}
