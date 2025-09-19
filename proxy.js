 // proxy.js
import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = 3001;

/* ------------- CORS ------------- */
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

/* ------------- Cache ------------- */
const cache = new Map(); // key -> { t, ttl, v }

function makeKey(req) {
  const u = new URL("http://x" + req.originalUrl);
  const p = u.searchParams;
  p.delete("nocache");

  const normList = (val) =>
    [...new Set(val.split(",").map(s => s.trim().toUpperCase()).filter(Boolean))]
      .sort()
      .join(",");

  if (u.pathname === "/yahoo/quote" && p.has("symbols")) {
    p.set("symbols", normList(p.get("symbols")));
  }
  if (u.pathname === "/fx/latest" && p.has("symbols")) {
    p.set("symbols", normList(p.get("symbols")));
  }
  return u.pathname + (p.toString() ? "?" + p.toString() : "");
}

function getFresh(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.t > e.ttl) return null;
  return e.v;
}
function getStale(key) {
  const e = cache.get(key);
  return e ? e.v : null;
}
function put(key, value, ttlMs = 60_000) {
  cache.set(key, { t: Date.now(), ttl: ttlMs, v: value });
}
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of cache) {
    if (now - e.t > e.ttl * 2) cache.delete(k);
  }
}, 300_000);

async function passthrough(res, r) {
  const txt = await r.text();
  res.status(r.status);
  res.set("Content-Type", r.headers.get("content-type") || "application/json");
  res.send(txt);
}

/* ------------- Pomocniki ------------- */
function unwrapJinaLike(objOrText) {
  try {
    const obj = typeof objOrText === "string" ? JSON.parse(objOrText) : objOrText;
    if (obj && typeof obj.content === "string") {
      try { return JSON.parse(obj.content); } catch { return obj; }
    }
    if (obj && obj.data && (obj.data.quoteResponse || obj.data.chart)) return obj.data;
    return obj;
  } catch {
    return objOrText;
  }
}

function yahooPayloadLooksOk(j) {
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

/* ------------- /yahoo/quote ------------- */
app.get("/yahoo/quote", async (req, res) => {
  try {
    const symbols = (req.query.symbols || "").toString().trim();
    if (!symbols) return res.status(400).json({ error: "missing symbols" });

    const direct  = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
    const viaJina = `https://r.jina.ai/http://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;

    const key = makeKey(req);
    const fresh = getFresh(key);
    if (fresh) return res.json(fresh);
    const stale = getStale(key);

    // 1) bezpośrednio
    let r = await fetch(direct, { headers: { Accept: "application/json" } });
    let j = null;
    try { j = await r.json(); } catch {}

    if (r.ok && yahooPayloadLooksOk(j)) {
      put(key, j, 60_000);
      return res.json(j);
    }

    // 2) fallback (UWAGA: najpierw sprawdzamy r2.ok, dopiero potem .text())
    if (!r.ok || !yahooPayloadLooksOk(j) || [401, 403, 429, 503].includes(r.status)) {
      if (r.status === 429 && stale) return res.json(stale);

      const r2 = await fetch(viaJina, { headers: { Accept: "application/json" } });
      if (!r2.ok) return passthrough(res, r2);   // <-- nie czytamy body wcześniej!

      const txt2 = await r2.text();              // <-- dopiero tu
      const unwrapped = unwrapJinaLike(txt2);

      if (yahooPayloadLooksOk(unwrapped)) {
        put(key, unwrapped, 60_000);
        return res.json(unwrapped);
      }
      return res.json(unwrapped);
    }

    return passthrough(res, r);
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

/* ------------- /yahoo/chart ------------- */
app.get("/yahoo/chart", async (req, res) => {
  try {
    const s = (req.query.symbol || "").toString().trim();
    const range = (req.query.range || "1d").toString();
    const interval = (req.query.interval || "5m").toString();
    if (!s) return res.status(400).json({ error: "missing symbol" });

    const direct  = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
    const viaJina = `https://r.jina.ai/http://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;

    const key = makeKey(req);
    const fresh = getFresh(key);
    if (fresh) return res.json(fresh);
    const stale = getStale(key);

    let r = await fetch(direct, { headers: { Accept: "application/json" } });
    let j = null;
    try { j = await r.json(); } catch {}

    if (r.ok && yahooPayloadLooksOk(j)) {
      put(key, j, 300_000);
      return res.json(j);
    }

    if (!r.ok || !yahooPayloadLooksOk(j) || [401, 403, 429, 503].includes(r.status)) {
      if (r.status === 429 && stale) return res.json(stale);

      const r2 = await fetch(viaJina, { headers: { Accept: "application/json" } });
      if (!r2.ok) return passthrough(res, r2);   // <-- najpierw sprawdź

      const txt2 = await r2.text();              // <-- potem czytaj
      const unwrapped = unwrapJinaLike(txt2);

      if (yahooPayloadLooksOk(unwrapped)) {
        put(key, unwrapped, 300_000);
        return res.json(unwrapped);
      }
      return res.json(unwrapped);
    }

    return passthrough(res, r);
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

/* ------------- /fx/latest ------------- */
app.get("/fx/latest", async (req, res) => {
  try {
    const base = (req.query.base || "USD").toString().toUpperCase();
    const symbolsRaw = (req.query.symbols || "").toString().replace(/:.*$/g, "");
    const params = new URLSearchParams({ base, places: "6" });
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
    res.status(502).json({ error: String(e) });
  }
});

app.listen(PORT, () => console.log(`Proxy on http://localhost:${PORT}`));
