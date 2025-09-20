// proxy.js
import express from "express";
import fetch from "node-fetch";

const app  = express();
const PORT = 3001;

/* ---------- CORS ---------- */
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

/* ---------- proste cache ---------- */
const cache = new Map(); // key -> { t, ttl, v }
function makeKey(req) {
  const u = new URL("http://x" + req.originalUrl);
  const p = u.searchParams;
  p.delete("nocache");
  const normList = (val) =>
    [...new Set(String(val || "").split(",").map(s => s.trim().toUpperCase()).filter(Boolean))].sort().join(",");
  if (u.pathname === "/yahoo/quote" && p.has("symbols")) p.set("symbols", normList(p.get("symbols")));
  if (u.pathname === "/fx/latest"   && p.has("symbols")) p.set("symbols", normList(p.get("symbols")));
  return u.pathname + (p.toString() ? "?" + p.toString() : "");
}
const getFresh = k => {
  const e = cache.get(k);
  if (!e) return null;
  return (Date.now() - e.t <= e.ttl) ? e.v : null;
};
const getStale = k => (cache.get(k)?.v ?? null);
const put = (k,v,ttl=60_000) => cache.set(k,{t:Date.now(),ttl,v});

/* ---------- pomoc ---------- */
function unwrapJinaLike(objOrText) {
  try {
    const o = typeof objOrText === "string" ? JSON.parse(objOrText) : objOrText;
    if (o && typeof o.content === "string") {
      try { return JSON.parse(o.content); } catch { return o; }
    }
    if (o && o.data && (o.data.quoteResponse || o.data.chart)) return o.data;
    return o;
  } catch { return objOrText; }
}
function yahooPayloadOK(j) {
  if (!j || typeof j !== "object") return false;
  if (j.quoteResponse) {
    const err = j.finance?.error;
    return !err && Array.isArray(j.quoteResponse.result);
  }
  if (j.chart) {
    const err = j.chart?.error || j.finance?.error;
    return !err && j.chart.result;
  }
  return false;
}

/* ---------- passthrough (nie czytamy body wcześniej!) ---------- */
async function passthrough(res, r) {
  const text = await r.text();               // <– czytamy TYLKO tu
  res.status(r.status);
  res.set("Content-Type", r.headers.get("content-type") || "application/json");
  res.send(text);
}

/* ---------- fallback z chart → minimalny quote ---------- */
async function fetchChartJSON(symbol, range="1d", interval="1m") {
  const direct  = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
  const viaJina = `https://r.jina.ai/http://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;

  try {
    const r = await fetch(direct, { headers: { Accept: "application/json" } });
    const j = await r.json().catch(async () => JSON.parse(await r.text()));
    if (r.ok && j?.chart?.result) return j;
  } catch {}

  try {
    const r2 = await fetch(viaJina, { headers: { Accept: "application/json" } });
    const t2 = await r2.text();
    const unwrapped = unwrapJinaLike(t2);
    if (unwrapped?.chart?.result) return unwrapped;
  } catch {}

  return null;
}
function quoteFromChartPayload(symbol, chartJson) {
  try {
    const res = chartJson?.chart?.result?.[0];
    const meta = res?.meta || {};
    const price = meta.regularMarketPrice ?? meta.chartPreviousClose ?? null;
    const prev  = meta.previousClose ?? meta.chartPreviousClose ?? null;
    const currency = meta.currency || meta.currencyCode || null;

    return {
      language: "en-US",
      region: "US",
      quoteType: "EQUITY",
      symbol,
      shortName: meta?.symbol || symbol,
      regularMarketPrice: price,
      regularMarketPreviousClose: prev,
      currency,
      exchangeName: meta.exchangeName || meta.exchange || null,
      marketState: meta.marketState || "REGULAR"
    };
  } catch {
    return null;
  }
}

/* ---------- /yahoo/quote ---------- */
app.get("/yahoo/quote", async (req, res) => {
  try {
    const symbols = String(req.query.symbols || "").trim();
    if (!symbols) return res.status(400).json({ error: "missing symbols" });

    const direct  = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
    const viaJina = `https://r.jina.ai/http://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;

    const key = makeKey(req);
    const fresh = getFresh(key);
    if (fresh) return res.json(fresh);
    const stale = getStale(key);

    // 1) spróbuj zwykły quote
    let r1, j1 = null;
    try {
      r1 = await fetch(direct, { headers: { Accept: "application/json" } });
      j1 = await r1.json().catch(async () => JSON.parse(await r1.text()));
    } catch {}

    if (r1?.ok && yahooPayloadOK(j1)) {
      put(key, j1, 60_000);
      return res.json(j1);
    }
    if (r1?.status === 429 && stale) return res.json(stale);

    // 2) próbuj przez r.jina.ai
    try {
      const r2 = await fetch(viaJina, { headers: { Accept: "application/json" } });
      const txt2 = await r2.text();
      const unwrapped = unwrapJinaLike(txt2);
      if (yahooPayloadOK(unwrapped)) {
        put(key, unwrapped, 60_000);
        return res.json(unwrapped);
      }
      // jeśli to np. 401 Unauthorized w polu finance.error → lecimy do fallbacku
    } catch {}

    // 3) FALLBACK: chart → minimalny quote (dla każdego symbolu)
    const arr = symbols.split(",").map(s => s.trim()).filter(Boolean);
    const built = [];
    for (const s of arr) {
      const cj = await fetchChartJSON(s, "1d", "1m");
      const q  = cj ? quoteFromChartPayload(s, cj) : null;
      if (q) built.push(q);
    }
    if (built.length) {
      const shaped = { quoteResponse: { result: built, error: null } };
      put(key, shaped, 60_000);
      return res.json(shaped);
    }

    // 4) ostatecznie oddaj stare dane lub błąd
    if (stale) return res.json(stale);
    return res.status(502).json({ error: "quote failed (direct, jina, chart fallback)" });
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
});

/* ---------- /yahoo/chart ---------- */
app.get("/yahoo/chart", async (req, res) => {
  try {
    const s = String(req.query.symbol || "").trim();
    const range = String(req.query.range || "1d");
    const interval = String(req.query.interval || "5m");
    if (!s) return res.status(400).json({ error: "missing symbol" });

    const direct  = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
    const viaJina = `https://r.jina.ai/http://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;

    const key = makeKey(req);
    const fresh = getFresh(key);
    if (fresh) return res.json(fresh);
    const stale = getStale(key);

    let r1 = await fetch(direct, { headers: { Accept: "application/json" } });
    let j1 = null;
    try { j1 = await r1.json(); } catch {}

    if (r1.ok && yahooPayloadOK(j1)) {
      put(key, j1, 300_000);
      return res.json(j1);
    }

    if (r1.status === 429 && stale) return res.json(stale);

    const r2 = await fetch(viaJina, { headers: { Accept: "application/json" } });
    if (!r2.ok) return passthrough(res, r2);

    const txt2 = await r2.text();
    const unwrapped = unwrapJinaLike(txt2);
    if (yahooPayloadOK(unwrapped)) {
      put(key, unwrapped, 300_000);
      return res.json(unwrapped);
    }
    return res.json(unwrapped);
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
});

/* ---------- /fx/latest ---------- */
app.get("/fx/latest", async (req, res) => {
  try {
    const base = String(req.query.base || "USD").toUpperCase();
    const symbolsRaw = String(req.query.symbols || "").replace(/:.*$/g, "");
    const places = String(req.query.places || "6");
    const params = new URLSearchParams({ base, places });
    if (symbolsRaw) params.set("symbols", symbolsRaw);

    const key = makeKey(req);
    const fresh = getFresh(key);
    if (fresh) return res.json(fresh);

    const url1 = `https://api.exchangerate.host/latest?${params.toString()}`;

    let r1, j1;
    try {
      r1 = await fetch(url1, { headers: { Accept: "application/json" } });
      j1 = await r1.json().catch(async () => JSON.parse(await r1.text()));
    } catch {}

    const bad = !j1 || j1.success === false || j1?.error || !j1?.rates || (r1 && !r1.ok);
    if (!bad) {
      put(key, j1, 60_000);
      return res.json(j1);
    }

    const url2 = `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
    const r2 = await fetch(url2, { headers: { Accept: "application/json" } });
    if (!r2.ok) return passthrough(res, r2);
    const j2 = await r2.json();

    if (j2?.result !== "success" || !j2?.rates) {
      return res.status(502).json({ error: "FX fallback failed" });
    }

    let rates = j2.rates;
    if (symbolsRaw) {
      const want = new Set(
        symbolsRaw.split(",").map(s => s.trim().toUpperCase()).filter(Boolean)
      );
      rates = Object.fromEntries(Object.entries(rates).filter(([k]) => want.has(k)));
    }
    const shaped = { base, date: j2.time_last_update_utc || "", rates };
    put(key, shaped, 60_000);
    return res.json(shaped);
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
});

app.listen(PORT, () => console.log(`[proxy] Proxy on http://localhost:${PORT}`));
