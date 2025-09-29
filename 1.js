         // ==== Same-origin sandbox guard (allowlist for needed APIs) ====
/* Dodaj etykiety i mały podpis pod każdą wartością w tabelach (mobile) */
(function () {
  function labelize(table){
    if (!table) return;
    const heads = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(tr => {
      Array.from(tr.children).forEach((td, i) => {
        const label = heads[i] || '';
        // a) atrybut data-label (zostawiamy, jeśli gdzieś używasz w CSS)
        td.setAttribute('data-label', label);

        // b) mały podpis: <div class="mfk-val">…</div><div class="mfk-cap">Label</div>
        if (!td.querySelector('.mfk-val')) {
          const val = document.createElement('div');
          val.className = 'mfk-val';
          while (td.firstChild) val.appendChild(td.firstChild); // przenieś zawartość
          const cap = document.createElement('div');
          cap.className = 'mfk-cap';
          cap.textContent = label || '';
          td.append(val, cap);
        } else {
          // odśwież podpis, gdyby kolumny się zmieniły
          const cap = td.querySelector('.mfk-cap');
          if (cap) cap.textContent = label || '';
        }
      });
    });
  }
function labelizeAll(){
  document.querySelectorAll('table').forEach(labelize);
}
 function applyLabelizeIfMobile() {
  if (window.matchMedia('(max-width:640px)').matches) {
    labelizeAll();   // tylko na mobile
  }
}
document.addEventListener('DOMContentLoaded', applyLabelizeIfMobile);
const obs = new MutationObserver(applyLabelizeIfMobile);
obs.observe(document.body, { childList: true, subtree: true });
matchMedia('(max-width:640px)').addEventListener('change', applyLabelizeIfMobile);

})();

// ====== UTIL ======

const DB_KEY = "kidmoney_multi_fx_live_i18n_v1";
const AUTH_KEY = window.AUTH_KEY || 'mfk-auth-v1';// { role: 'guest'|'parent'|'child', childId?: string }
const LANG_KEY = "pf_lang";
// --- local backend proxy ---
const PROXY = "http://localhost:3001";
// self-test
const proxyUrl = `${PROXY}/yahoo/quote?symbols=${encodeURIComponent("AAPL,MSFT")}`;
const fxUrl    = `${PROXY}/fx/latest?base=USD&places=6`;


// prosty "sanitizer" nazw tickerów na format Yahoo (jeśli już masz tę funkcję, zostaw jedną)
function mapToYahooSafe(sym) {
  return String(sym || "").trim().toUpperCase().replace(/\s+/g, "").replace(/\./g, "-");
}

// lekki wrapper na /yahoo/quote przez nasz proxy
async function yahooQuote(symbolsOrCsv) {
  const csv = Array.isArray(symbolsOrCsv) ? symbolsOrCsv.join(",") : String(symbolsOrCsv || "");
  const url = `${PROXY}/yahoo/quote?symbols=${encodeURIComponent(csv)}`;
  const r = await fetch(url, { headers: { "Accept": "application/json" }, cache: "no-store" });
  if (!r.ok) throw new Error("Yahoo quote HTTP " + r.status);
  const j = await r.json();
  // zunifikowany kształt odpowiedzi + helper do brania ceny
  const result = (j?.quoteResponse?.result || []).map(x => x || {});
  result._pickPrice = (q) =>
    (q?.regularMarketPrice ?? q?.postMarketPrice ?? q?.preMarketPrice ?? q?.price ?? NaN);
  return result;
}

// ===== Display currency per language (EN->USD, PL->PLN) =====
const CURRENCY_KEY = "pf_display_currency";
const DISPLAY_CURRENCY_BY_LANG = { en: "USD", pl: "PLN" };
// (u Ciebie getLang/setLang już istnieją niżej przy tData – użyjmy tych)
function currentLocale() { return (getLang() === 'pl') ? 'pl-PL' : 'en-US'; }
function getDisplayCurrency() {
  return localStorage.getItem(CURRENCY_KEY) || DISPLAY_CURRENCY_BY_LANG[getLang()] || "USD";
}
function setDisplayCurrency(cur) {
  localStorage.setItem(CURRENCY_KEY, cur);
}
// === QUOTE waluty dla UI FX (PL -> PLN, EN -> USD) ===
function fxQuote(){
  // UI: gdy PL -> pokazuj pary A/PLN; gdy EN -> A/USD
  return (getDisplayCurrency() === 'PLN') ? 'PLN' : 'USD';
}
window.fxQuote = fxQuote;
// Konwersja: wartości aplikacji są w USD → na walutę wyświetlaną
function convertFromUSD(usdAmount, toCur = getDisplayCurrency()) {
  const v = Number(usdAmount || 0);
  if (toCur === "USD") return v;
  if (toCur === "PLN") {
    const plnPerUsd = baseFx?.USD || 4.0; // PLN za 1 USD
    return v * plnPerUsd;
  }
  return v;
}
// Odwrotna konwersja: kwoty w PLN → na USD (do logiki aplikacji)
function convertToUSD(amount, fromCur = getDisplayCurrency()) {
  const v = Number(amount || 0);
  if (fromCur === "USD") return v;
  if (fromCur === "PLN") {
    const plnPerUsd = baseFx?.USD || 4.0; // PLN za 1 USD
    return v / plnPerUsd;
  }
  return v;
}

// Formatter — zawsze przyjmuje USD i pokazuje w walucie wybranej przez użytkownika
function fmtMoneyFromUSD(usdAmount) {
  const cur = getDisplayCurrency();
  const amt = convertFromUSD(usdAmount, cur);
  return new Intl.NumberFormat(currentLocale(), {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 2
  }).format(amt);
}
// Formatter bez przeliczania FX — liczba jest traktowana jako kwota "już w wybranej walucie".
function fmtMoneyNoFx(amount) {
  const cur = getDisplayCurrency();
  const v = Number(amount || 0);
  return new Intl.NumberFormat(currentLocale(), {
    style: "currency",
    currency: cur,
    maximumFractionDigits: 2
  }).format(v);
}
// Legacy formatter – zostaje dla zgodności
// ===== Walutowe formatery (spójne: wszystko pokazujemy w USD) =====
const USD = v => fmtMoneyFromUSD(Number(v || 0));   // zachowujemy starą nazwę – teraz dynamiczna
const PLN = v => fmtMoneyFromUSD(Number(v || 0));   // alias – cały kod dalej działa bez zmian

// FX: 4 miejsca, locale wg języka
const FX = v =>
  new Intl.NumberFormat(currentLocale(), { minimumFractionDigits: 4, maximumFractionDigits: 4 })
    .format(Number(v || 0));

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const nowISO = () => { const d = new Date(); return d.toISOString().slice(0, 10) + "T" + d.toTimeString().slice(0, 8); };

// ========== helper: licz jak „do grosza” ==========
const toCents = v => Math.round(Number(v || 0) * 100) / 100;
// ====== FX CONFIG ======
const ISO = ["PLN", "USD", "EUR", "GBP", "CHF", "JPY", "AUD", "CAD", "NOK", "SEK", "DKK", "CZK", "HUF", "UAH", "RUB", "TRY", "ZAR", "CNY", "HKD", "NZD", "MXN", "BRL", "ILS", "INR", "KRW", "SGD"];

// UWAGA: baseFx to „PLN na 1 jednostkę waluty”
let baseFx = {
  PLN: 1, USD: 3.90, EUR: 4.30, GBP: 5.05, CHF: 4.35, JPY: 0.026, AUD: 2.60, CAD: 2.85,
  NOK: 0.36, SEK: 0.38, DKK: 0.58, CZK: 0.18, HUF: 0.011, UAH: 0.10, RUB: 0.045, TRY: 0.12,
  ZAR: 0.22, CNY: 0.54, HKD: 0.50, NZD: 2.35, MXN: 0.22, BRL: 0.70, ILS: 1.05, INR: 0.047,
  KRW: 0.0030, SGD: 2.90
};

// English currency names (for FX display)
const CURRENCY_NAMES = {
  PLN: "Polish Zloty", USD: "US Dollar", EUR: "Euro", GBP: "British Pound", CHF: "Swiss Franc",
  JPY: "Japanese Yen", AUD: "Australian Dollar", CAD: "Canadian Dollar", NOK: "Norwegian Krone",
  SEK: "Swedish Krona", DKK: "Danish Krone", CZK: "Czech Koruna", HUF: "Hungarian Forint",
  UAH: "Ukrainian Hryvnia", RUB: "Russian Ruble", TRY: "Turkish Lira", ZAR: "South African Rand",
  CNY: "Chinese Yuan", HKD: "Hong Kong Dollar", NZD: "New Zealand Dollar", MXN: "Mexican Peso",
  BRL: "Brazilian Real", ILS: "Israeli New Shekel", INR: "Indian Rupee", KRW: "South Korean Won",
  SGD: "Singapore Dollar"
};
// ==== LIVE PRICE HUB (wspólne ceny dla wszystkich modułów) ====
// Akcje: "AAPL", "MSFT" ...  FX: klucz bez "/" (np. "EURUSD")
const PRICE_HUB = (() => {
  const store = new Map();
  const listeners = new Set();
  const norm = (sym) => {
    if (!sym) return '';
    const s = String(sym).trim().toUpperCase();
    return s.includes('/') ? s.replace('/', '') : s.replace(/\s+/g, '');
  };
  return {
    set(symbol, price) {
      const key = norm(symbol);
      const val = Number(price);
      if (!key || !Number.isFinite(val)) return;
      store.set(key, val);
      listeners.forEach(fn => { try { fn(key, val); } catch(e){} });
    },
    get(symbol) {
      const key = norm(symbol);
      return store.has(key) ? store.get(key) : null;
    },
    use(symbol, fallback=null) {
      const v = this.get(symbol);
      return (v == null) ? fallback : v;
    },
    has(symbol){ return store.has(norm(symbol)); },
    subscribe(fn){ listeners.add(fn); return () => listeners.delete(fn); },
    _norm: norm
  };
})();
// Udostępnij HUB dla innych skryptów (np. Watchlist)
window.PRICE_HUB = PRICE_HUB;

// Pomocniki: 1) cena akcji z HUB-a z bezpiecznym fallbackiem
function priceOfStock(ticker, fallback){
  return PRICE_HUB.use(ticker, fallback);
}
// 2) klucz FX "EUR/USD" -> "EURUSD"
function fxKey(pair){ return PRICE_HUB._norm(pair); }

// === DODATKOWE POPULARNE WALUTY (offline) – PLNy za 1 jednostkę ===
// Wklej ten blok po ISO / baseFx / CURRENCY_NAMES
(function extendCurrenciesWithPopular() {
  const ADD = {
    AED: { name: "UAE Dirham",         pln: 1.06 },
    SAR: { name: "Saudi Riyal",        pln: 1.04 },
    QAR: { name: "Qatari Riyal",       pln: 1.07 },
    KWD: { name: "Kuwaiti Dinar",      pln: 12.70 },
    BHD: { name: "Bahraini Dinar",     pln: 10.33 },
    OMR: { name: "Omani Rial",         pln: 10.14 },
    THB: { name: "Thai Baht",          pln: 0.11 },
    PHP: { name: "Philippine Peso",    pln: 0.07 },
    MYR: { name: "Malaysian Ringgit",  pln: 0.82 },
    TWD: { name: "New Taiwan Dollar",  pln: 0.12 },
    RON: { name: "Romanian Leu",       pln: 0.86 },
    BGN: { name: "Bulgarian Lev",      pln: 2.18 },
    MAD: { name: "Moroccan Dirham",    pln: 0.38 },
    EGP: { name: "Egyptian Pound",     pln: 0.08 },
    CLP: { name: "Chilean Peso",       pln: 0.0043 },
    COP: { name: "Colombian Peso",     pln: 0.0010 },
    ARS: { name: "Argentine Peso",     pln: 0.0043 },
    PEN: { name: "Peruvian Sol",       pln: 1.05 },
  };

  Object.entries(ADD).forEach(([code, d]) => {
    if (!ISO.includes(code)) ISO.push(code);                 // dodaj kod
    if (!Number.isFinite(baseFx[code])) baseFx[code] = d.pln; // PLN za 1 code
    if (!CURRENCY_NAMES[code]) CURRENCY_NAMES[code] = d.name; // nazwa
  });
})();

// ====== STOCK UNIVERSE ======
const STOCK_UNIVERSE = [
  { t: "AAPL", n: "Apple", p: 190.12 }, { t: "MSFT", n: "Microsoft", p: 425.40 },
  { t: "NVDA", n: "NVIDIA", p: 120.54 }, { t: "GOOGL", n: "Alphabet", p: 165.72 },
  { t: "AMZN", n: "Amazon", p: 182.90 }, { t: "META", n: "Meta", p: 510.10 },
  { t: "TSLA", n: "Tesla", p: 180.50 }, { t: "AMD", n: "AMD", p: 170.20 },
  { t: "NFLX", n: "Netflix", p: 610.30 }, { t: "DIS", n: "Disney", p: 92.88 },
  { t: "INTC", n: "Intel", p: 45.20 }, { t: "IBM", n: "IBM", p: 190.30 },
  { t: "ORCL", n: "Oracle", p: 120.10 }, { t: "CRM", n: "Salesforce", p: 295.00 },
  { t: "ADBE", n: "Adobe", p: 520.00 }, { t: "PYPL", n: "PayPal", p: 65.00 },
  { t: "SHOP", n: "Shopify", p: 70.00 }, { t: "SQ", n: "Block", p: 84.00 },
  { t: "UBER", n: "Uber", p: 70.00 }, { t: "ABNB", n: "Airbnb", p: 155.00 },
  { t: "PEP", n: "PepsiCo", p: 170.00 }, { t: "KO", n: "Coca-Cola", p: 61.00 },
  { t: "MCD", n: "McDonald's", p: 290.00 }, { t: "NKE", n: "Nike", p: 95.00 },
  { t: "SBUX", n: "Starbucks", p: 85.00 }, { t: "JPM", n: "JPMorgan", p: 195.00 },
  { t: "BAC", n: "Bank of Am.", p: 39.00 }, { t: "WFC", n: "Wells Fargo", p: 58.00 },
  { t: "V", n: "Visa", p: 280.00 }, { t: "MA", n: "Mastercard", p: 460.00 },
  { t: "BRKB", n: "Berkshire B", p: 410.00 },
  { t: "XOM", n: "ExxonMobil", p: 115.00 }, { t: "CVX", n: "Chevron", p: 160.00 },
  { t: "PFE", n: "Pfizer", p: 28.00 }, { t: "MRK", n: "Merck", p: 130.00 },
  { t: "TSM", n: "TSMC", p: 140.00 }, { t: "BABA", n: "Alibaba", p: 78.00 },
  { t: "TCEHY", n: "Tencent ADR", p: 42.00 }, { t: "BHP", n: "BHP", p: 57.00 },
  { t: "RIO", n: "Rio Tinto", p: 69.00 }, { t: "SAP", n: "SAP", p: 200.00 },
  { t: "ASML", n: "ASML", p: 980.00 }, { t: "SONY", n: "Sony", p: 87.00 },
  { t: "NVAX", n: "Novavax", p: 12.50 }, { t: "ARM", n: "Arm", p: 110.00 },
  { t: "SQM", n: "SQM", p: 47.00 }, { t: "NIO", n: "NIO", p: 5.20 }
];
// === DODATKOWE POPULARNE AKCJE (offline) – dopasowane do { t, n, p } ===
// Wklej ten blok tuż po definicji const STOCK_UNIVERSE = [...];
(function extendStockUniverseWithTop30() {
  const ADD = {
    GE:    { name: "General Electric Co.",        price: 168.00 },
    LIN:   { name: "Linde plc",                   price: 440.00 },
    JNJ:   { name: "Johnson & Johnson",           price: 160.00 },
    NYCB: { name: "New York Community Bancorp (Flagstar Bank)", price: 12.00 },
    AAPL:  { name: "Apple Inc.",                  price: 220.00 },
    MSFT:  { name: "Microsoft Corp.",             price: 430.00 },
    GOOGL: { name: "Alphabet Inc. (Class A)",     price: 165.00 },
    AMZN:  { name: "Amazon.com Inc.",             price: 180.00 },
    NVDA:  { name: "NVIDIA Corp.",                price: 120.00 }, // po split
    META:  { name: "Meta Platforms Inc.",         price: 505.00 },
    TSLA:  { name: "Tesla Inc.",                  price: 240.00 },
    BRK_B: { name: "Berkshire Hathaway Inc. (B)", price: 440.00 },
    JPM:   { name: "JPMorgan Chase & Co.",        price: 210.00 },
    V:     { name: "Visa Inc. (Class A)",         price: 275.00 },
    MA:    { name: "Mastercard Inc. (Class A)",   price: 460.00 },
    WMT:   { name: "Walmart Inc.",                price: 73.00 },   // po split
    PG:    { name: "Procter & Gamble Co.",        price: 170.00 },
    KO:    { name: "Coca-Cola Co.",               price: 65.00 },
    PEP:   { name: "PepsiCo Inc.",                price: 170.00 },
    DIS:   { name: "Walt Disney Co.",             price: 95.00 },
    NFLX:  { name: "Netflix Inc.",                price: 580.00 },
    NKE:   { name: "Nike Inc. (Class B)",         price: 95.00 },
    ORCL:  { name: "Oracle Corp.",                price: 150.00 },
    INTC:  { name: "Intel Corp.",                 price: 32.00 },
    IBM:   { name: "International Business Machines", price: 190.00 },
    XOM:   { name: "Exxon Mobil Corp.",           price: 115.00 },
    CVX:   { name: "Chevron Corp.",               price: 155.00 },
    TSM:   { name: "Taiwan Semiconductor (ADR)",  price: 185.00 },
    BABA:  { name: "Alibaba Group (ADR)",         price: 78.00 },
    ASML:  { name: "ASML Holding NV (ADR)",       price: 950.00 },
    SAP:   { name: "SAP SE (ADR)",                price: 200.00 }
  };

  // Idempotentnie: dodaj tylko te, których nie ma
  Object.entries(ADD).forEach(([ticker, d]) => {
    const exists = STOCK_UNIVERSE.some(s => s.t === ticker);
    if (!exists) {
      STOCK_UNIVERSE.push({ t: ticker, n: d.name, p: d.price });
    }
  });
})();

// ====== I18N ======
const tData = {
  pl: {
    sim: "Symulacja (offline)", live: "Live (backend)", apiNot: "API: brak połączenia", apiConn: "API: łączenie…",
    fxOk: "FX ok", fxFail: "FX błąd", stOk: "Akcje ok", stFail: "Akcje błąd",
  addedPocket: amt => `Dodano kieszonkowe ${amt}`,
moved55: amt => `Przeniesiono ${amt} Earnings → Oszczędności`,
    needFunds: amt => `Za mało środków w Oszczędnościach (potrzeba ${amt})`,
    bought: (q, s) => `Kupiono ${q} ${s}`, sold: (q, s, p) => `Sprzedano ${q} ${s} (P/L: ${p})`,
    sell: "Sprzedaj", pinBad: "Zły PIN.", pinLocked: "PIN zablokowany, spróbuj później.",
    topupDone: amt => `Zasilono Oszczędności o ${amt}`,
    onlyParent: "Tylko dla rodzica: zaloguj się jako Rodzic.",
    badgeGuest: "Gość", badgeParent: "Rodzic", badgeChild: name => `Dziecko: ${name || ""}`,
    btnLoginTop: "Zaloguj", btnLogout: "Wyloguj",
  },
  en: {
    sim: "Simulation (offline)", live: "Live (backend)", apiNot: "API: not connected", apiConn: "API: connecting…",
    fxOk: "FX ok", fxFail: "FX failed", stOk: "Stocks ok", stFail: "Stocks failed",
    addedPocket: amt => `Added allowance ${amt}`,
moved55: amt => `Moved ${amt} Earnings → Savings`,

    needFunds: amt => `Not enough funds in Savings (need ${amt})`,
    bought: (q, s) => `Bought ${q} ${s}`, sold: (q, s, p) => `Sold ${q} ${s} (P/L: ${p})`,
    sell: "Sell", pinBad: "Wrong PIN.", pinLocked: "PIN locked, try later.",
    topupDone: amt => `Topped up Savings by ${amt}`,
    onlyParent: "Parent only: please log in as Parent.",
    badgeGuest: "Guest", badgeParent: "Parent", badgeChild: name => `Child: ${name || ""}`,
    btnLoginTop: "Login", btnLogout: "Logout",
  },
  es: {
    sim: "Simulación (offline)", live: "En vivo (backend)", apiNot: "API: no conectado", apiConn: "API: conectando…",
    fxOk: "FX ok", fxFail: "FX fallo", stOk: "Acciones ok", stFail: "Acciones fallo",
    addedPocket: "Se añadió mesada 10 USD", moved55: "Movido 5 USD Earnings → Savings",
    needFunds: amt => `Fondos insuficientes en Savings (necesita ${amt})`,
    bought: (q, s) => `Comprado ${q} ${s}`, sold: (q, s, p) => `Vendido ${q} ${s} (P/L: ${p})`,
    sell: "Vender", pinBad: "PIN incorrecto.", pinLocked: "PIN bloqueado, inténtalo luego.",
    topupDone: amt => `Recarga a Savings de ${amt}`,
    onlyParent: "Solo para padres: inicia sesión como Padre.",
    badgeGuest: "Invitado", badgeParent: "Padre", badgeChild: name => `Niño: ${name || ""}`,
    btnLoginTop: "Iniciar sesión", btnLogout: "Cerrar sesión",
  }
};

function getLang() { return localStorage.getItem(LANG_KEY) || 'en'; }
function setLang(l) { localStorage.setItem(LANG_KEY, l); }
function TT() { return tData[getLang()] || tData.en; }

// język – select
(function ensureLangSelect() {
  function wire(sel) {
    sel.value = getLang();
sel.addEventListener('change', () => {
  setLang(sel.value);
  // ZAWSZE przełącz walutę pod język (PL→PLN, EN→USD)
  setDisplayCurrency(DISPLAY_CURRENCY_BY_LANG[sel.value] || "USD");

  updateLiveUI();
  refreshStaticI18n();
  if (typeof refreshTutorialTexts === 'function') refreshTutorialTexts();
  if (typeof refreshAuthI18n === 'function') refreshAuthI18n();
  if (typeof renderAll === 'function') renderAll();
});


  }
  let sel = document.getElementById('langSelect');
  if (sel) { wire(sel); return; }
  const host = document.querySelector('.role-switch') || document.querySelector('.topbar') || document.body;
  const wrap = document.createElement('span');
  wrap.style.marginLeft = '8px';
  wrap.innerHTML = `
      <select id="langSelect" title="Language">
    <option value="pl">PL</option>
    <option value="en">EN</option>
  </select>`;
  host.appendChild(wrap);
  wire(wrap.querySelector('#langSelect'));
})();

function refreshI18nAttributes() {
  const t = TT();
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (t[key]) el.setAttribute('placeholder', typeof t[key] === 'function' ? t[key]() : t[key]);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (t[key]) el.setAttribute('title', typeof t[key] === 'function' ? t[key]() : t[key]);
  });
  document.querySelectorAll('[data-i18n-value]').forEach(el => {
    const key = el.getAttribute('data-i18n-value');
    if (t[key]) el.setAttribute('value', typeof t[key] === 'function' ? t[key]() : t[key]);
  });
}

function refreshStaticI18n() {
  const t = TT();
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key]) el.textContent = (typeof t[key] === 'function') ? t[key]() : t[key];
  });
  const liveLabel = document.getElementById('liveModeLabel');
  const liveStatus = document.getElementById('liveStatus');
  if (liveLabel) liveLabel.textContent = app.liveMode ? TT().live : TT().sim;
  if (liveStatus && !app.liveMode) liveStatus.textContent = TT().apiNot;
}

// ====== STATE ======
const defaults = {
  childrenOrder: [], children: {}, activeChildId: null, pinHash: null, pinTries: 0, pinLockedUntil: 0,
  dailyLimit: 500, liveMode: false, trends: { stocks: {}, fx: {} },
  basket: { stocks: [], fx: [] },  // ⬅️ NEW
};

/* === BASKETS ENGINE (stocks + fx) === */
function addToBasketStock(ticker, price, qty) {
  if (!app.basket) app.basket = { stocks: [], fx: [] };
  const it = app.basket.stocks.find(x => x.t === ticker && Number.isFinite(x.price));
  if (it) {
    it.qty = Math.max(1, (Number(it.qty) || 0) + Number(qty || 0));
    it.price = Number(price || it.price);
  } else {
    app.basket.stocks.push({ t: ticker, price: Number(price||0), qty: Math.max(1, Number(qty||1)) });
  }
  save(app);
  renderBasketStocks();
}

function addToBasketFx(pair, priceUsd, qty) {
  if (!app.basket) app.basket = { stocks: [], fx: [] };
  const it = app.basket.fx.find(x => x.pair === pair && Number.isFinite(x.priceUsd));
  if (it) {
    it.qty = Math.max(1, (Number(it.qty) || 0) + Number(qty || 0));
    it.priceUsd = Number(priceUsd || it.priceUsd);
  } else {
    app.basket.fx.push({ pair, priceUsd: Number(priceUsd||0), qty: Math.max(1, Number(qty||1)) });
  }
  save(app);
  renderBasketFx();
}

function renderBasket(which) {
  const listEl = document.querySelector(`[data-basket-list="${which}"]`);
  const qtyEl  = document.querySelector(`[data-basket-qty="${which}"]`);
  const amtEl  = document.querySelector(`[data-basket-amt="${which}"]`);
  if (!listEl) return;

  const items = (app.basket && app.basket[which]) ? app.basket[which] : [];
  listEl.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'basket-empty';
    empty.textContent = 'No items in basket.';
    listEl.appendChild(empty);
    if (qtyEl) qtyEl.textContent = '0';
   if (amtEl) amtEl.textContent = USD(0);
    return;
  }

  let sumQty = 0, sumAmt = 0;

  items.forEach((it, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'basket-item row';
    let left = '', amount = 0;

    if (which === 'stocks') {
      amount = Number(it.price) * Number(it.qty);
      left = `<div><strong>${it.t}</strong> × ${it.qty}<br><span class="muted" style="font-size:12px">Price: ${USD(it.price).replace(' USD','')}</span></div>`;
    } else {
      const unit = toCents(which === 'stocks' ? it.price : it.priceUsd);
amount = toCents(unit * Number(it.qty));
      left = `<div><strong>${it.pair}</strong> × ${it.qty}<br><span class="muted" style="font-size:12px">Rate (USD/base): ${FX(it.priceUsd)}</span></div>`;
    }

    const right = `
      <div class="right" style="text-align:right; display:flex; align-items:center; gap:8px">
        <div class="val" style="min-width:120px; font-weight:700">${USD(amount)}</div>
        <button class="btn danger" data-remove-index="${i}">×</button>
      </div>`;

    wrap.innerHTML = left + right;
    listEl.appendChild(wrap);

    sumQty += Number(it.qty) || 0;
    sumAmt += amount || 0;
  });

if (qtyEl) qtyEl.textContent = '\u00A0\u00A0' + sumQty;      // NBSP×2
if (amtEl) amtEl.textContent = '\u00A0\u00A0' + USD(sumAmt); // NBSP×2


  listEl.onclick = (e) => {
    const btn = e.target.closest('[data-remove-index]');
    if (!btn) return;
    const idx = parseInt(btn.getAttribute('data-remove-index'), 10);
    if (!Number.isFinite(idx)) return;
    items.splice(idx, 1);
    save(app);
    renderBasket(which);
  };
}

function renderBasketStocks(){ renderBasket('stocks'); }
function renderBasketFx(){ renderBasket('fx'); }

function buyBasket(which) {
  const ch = activeChild(); if (!ch) return;
  const items = (app.basket && app.basket[which]) ? app.basket[which] : [];
  if (!items.length) return toast('Basket is empty.');

  const total = items.reduce((s, it) => {
    const px = (which === 'stocks') ? Number(it.price) : Number(it.priceUsd);
    const q  = Number(it.qty);
    return s + (px * q);
  }, 0);

  if (total > ch.jars.save) {
    return toast(TT().needFunds ? TT().needFunds(USD(total)) : `Not enough funds in Savings (need ${USD(total)})`);
  }

  if (which === 'stocks') {
    items.forEach(it => {
      selectedStock = it.t;
      if (qtyInput) qtyInput.value = it.qty;
      lastStockUiPrice = Number(it.price);
      buyStock(); // użyje lastStockUiPrice
    });
    app.basket.stocks = [];
    renderBasketStocks();
  } else {
    items.forEach(it => {
      selectedFxPair = it.pair;
      if (fxQty) fxQty.value = it.qty;
      lastFxUiPrice = Number(it.priceUsd);
      buyFx(); // użyje lastFxUiPrice
    });
    app.basket.fx = [];
    renderBasketFx();
  }

  save(app);
}

function newChild(name) {
  return {
    name,
    jars: { save: 0, spend: 0, give: 0, invest: 0 },
    stocks: [
      { t: "AAPL", n: "Apple", p: 190.12 },
      { t: "MSFT", n: "Microsoft", p: 425.40 },
      { t: "NVDA", n: "NVIDIA", p: 120.54 },
      { t: "GOOGL", n: "Alphabet", p: 165.72 },
      { t: "DIS", n: "Disney", p: 92.88 }
    ],
    portfolio: {},
    realizedStocks: 0,
    tradeLedgerStocks: [],
fxPairsEnabled: ["EUR/USD", "GBP/USD", "JPY/USD", "CHF/USD", "AUD/USD", "CAD/USD", "NOK/USD"],

    fxPortfolio: {},
    realizedFx: 0,
    tradeLedgerFx: [],
    ledger: []
  };
}

function load() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    const s = structuredClone(defaults);
    const id = crypto.randomUUID ? crypto.randomUUID() : "child1";
    s.children[id] = newChild("Child ");
    s.childrenOrder = [id];
    s.activeChildId = id;
    s.pinHash = hashPin("1234");
    ensureExpandedStocks(s.children[id]);
    return s;
  }
  const parsed = JSON.parse(raw);
if (!parsed.trends) parsed.trends = { stocks: {}, fx: {} };
Object.values(parsed.children || {}).forEach(ch => {
  ensureExpandedStocks(ch);
  sanitizePositions(ch); // ⬅️ ważne
});
if (!parsed.basket) parsed.basket = { stocks: [], fx: [] }; // ⬅️ NEW
return parsed;

}

function save(s) { localStorage.setItem(DB_KEY, JSON.stringify(s)); }

function hashPin(pin) { let h = 0; for (let i = 0; i < pin.length; i++) h = (h * 31 + pin.charCodeAt(i)) >>> 0; return String(h); }

function setPin(s, pin) {
  if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN must be 4–6 digits");
  s.pinHash = hashPin(pin);
  s.pinTries = 0;
  s.pinLockedUntil = 0;
  save(s);
}

function verifyPin(s, pin) {
  const now = Date.now();
  if (s.pinLockedUntil && now < s.pinLockedUntil) throw new Error(TT().pinLocked || "PIN locked, try later.");
  const ok = s.pinHash && hashPin(pin) === s.pinHash;
  if (!ok) {
    s.pinTries = (s.pinTries || 0) + 1;
    if (s.pinTries >= 3) {
      s.pinLockedUntil = now + 60_000;
      s.pinTries = 0;
    }
    save(s);
    throw new Error(TT().pinBad || "Wrong PIN.");
  }
  s.pinTries = 0;
  s.pinLockedUntil = 0;
  save(s);
  return true;
}

function ensureExpandedStocks(ch) {
  const have = new Set((ch.stocks || []).map(s => s.t));
  // const target = 30;            // ❌ usuń/zmień tę linię
  const target = STOCK_UNIVERSE.length; // ✅ pokaż wszystkie z STOCK_UNIVERSE
  for (const item of STOCK_UNIVERSE) {
    if (ch.stocks.length >= target) break;
    if (!have.has(item.t)) {
      ch.stocks.push({ t: item.t, n: item.n, p: item.p });
      have.add(item.t);
    }
  }
}

// --- Long-only: usuń ujemne/zerowe pozycje z portfeli (migracja starych danych)
function sanitizePositions(ch){
  // Stocks
  if (ch.portfolio) {
    Object.entries(ch.portfolio).forEach(([t, p]) => {
      if (!p || typeof p.s !== 'number' || p.s <= 0) delete ch.portfolio[t];
    });
  }
  // FX
  if (ch.fxPortfolio) {
    Object.entries(ch.fxPortfolio).forEach(([pair, pos]) => {
      if (!pos || typeof pos.q !== 'number' || pos.q <= 0) delete ch.fxPortfolio[pair];
    });
  }
}


// ====== TUTORIAL (assets + steps) ======
// 1) Obrazek na slajd powitalny (Twoje PNG)
const IMG_WELCOME = new URL("./piggy.png", document.baseURI).href;
// 2) Osobne grafiki dla słoików (Twoje pliki PNG)
const IMG_JAR_SAVINGS = new URL("./green.png", document.baseURI).href;
const IMG_JAR_EARNINGS = new URL("./orange.png", document.baseURI).href;
const IMG_JAR_DONATIONS = new URL("./pink.png", document.baseURI).href;
const IMG_JAR_INVEST = new URL("./blue.png", document.baseURI).href;
// 3) Kolaż czterech słoików
const IMG_JARS_COLLAGE = new URL("./jars.png", document.baseURI).href;
// 4) Pozostałe ilustracje
const IMG_STOCKS = new URL("./grow.png", document.baseURI).href;
const IMG_STOCKS_ROBOT = new URL("./stock.png", document.baseURI).href;
const IMG_CURRENCY = new URL("./currency.png", document.baseURI).href;
const IMG_STOCKMARKET = new URL("./stockmarket.png", document.baseURI).href;
const IMG_TRADE = new URL("./trade.png", document.baseURI).href;
const IMG_PROFITS = new URL("./profits.png", document.baseURI).href;
const IMG_SAFETY = new URL("./safety.png", document.baseURI).href;
const IMG_READY = new URL("./awesome.png", document.baseURI).href;
const IMG_ACCOUNTING    = new URL("./accounting.png",  document.baseURI).href;
const IMG_TUTORIAL_STOCKS = new URL("./tuto.png", document.baseURI).href;

// 4a) Wbudowany SVG do FX
const IMG_FX = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="720" height="360" viewBox="0 0 720 360">
    <rect width="100%" height="100%" fill="#0b1220"/>
    <text x="40" y="44" fill="#e5e7eb" font-size="18" font-family="ui-sans-serif,Segoe UI,Roboto,Arial">Currencies (FX)</text>
    <text x="40" y="84" fill="#94a3b8" font-size="16" font-family="ui-sans-serif,Segoe UI,Roboto,Arial">Example: EUR/USD = how many USD for 1 EUR</text>
    <rect x="40" y="110" width="640" height="200" rx="12" fill="#111827" stroke="#334155"/>
    <text x="64" y="164" fill="#e5e7eb" font-size="16">EUR/USD 1.09</text>
    <text x="64" y="196" fill="#e5e7eb" font-size="16">GBP/USD 1.27</text>
    <text x="64" y="228" fill="#e5e7eb" font-size="16">JPY/USD 0.0065</text>
  </svg>
`);

// 5) Kroki Tutorialu
function makeSteps() {
  return [
    {
      icon: "🎉",
      title: "Welcome to Money Flow Kids!",
      text: "Here you’ll explore how pocket money, savings, and challenges build money skills. You’ll learn the role of jars, how to trade, try stocks and currencies, and grow step by step. Each choice brings you closer to leading your financial story. This journey is safe, exciting, and designed for you to explore, test ideas, and grow with confidence!",
      img: IMG_WELCOME,
    },
    {
      icon: "🥫",
      title: "What are the jars?",
      text: "🟢 Savings – keep for later, like a safety net or a big dream.\n🟠 Earnings – money to spend on things you want or need now.\n🔴 Donations – gifts like birthdays or holidays.\n🔵 Investments – grow money by buying assets for the future.",
      img: IMG_JARS_COLLAGE,
    },
    {
      icon: "🏦",
      title: "Savings jar",
      text: " This is your foundation for building wealth. Money here is for dreams, goals, and surprises, showing how patience creates results. Even small amounts grow steadily over time, proving that saving first makes a big difference. The Savings jar is where financial security begins, and where your balance grows with every step you take.",
      img: IMG_JAR_SAVINGS,
    },
    {
      icon: "🛍️",
      title: "Earnings jar",
      text: "This jar stores the profits from your trades. You can spend them on what you want, or move them into Savings to grow wealth faster. The choice is yours: enjoy rewards now or invest for later. By practicing this balance, you learn how flexible decisions shape your financial growth. Each move helps you manage wisely.",
      img: IMG_JAR_EARNINGS,
    },
    {
      icon: "💖",
      title: "Donations jar",
      text: "The Donations jar reminds you that wealth is also about giving. Extra gifts from birthdays, holidays, or surprises go here. You can share with people, causes, or charities you care about, or transfer the funds into Savings to grow. This jar teaches kindness, balance, and how sharing connects money with meaning in your story.",
      img: IMG_JAR_DONATIONS,
    },
    {
      icon: "📊",
      title: "Investments jar",
      text: " Money in this jar is used for investments, like buying stocks or international currencies. This jar shows how much cash you have placed into the markets. Investments can grow, shrink, or stay the same, teaching you about both risks and rewards in real-life, real-time trading. Diversifying your portfolio grows your wealth.",
      img: IMG_JAR_INVEST,
    },
      {
      icon: "📊",
      title: "What is accounting?",
      text: "Accounting is how we track all the money moving in and out. Each move is a transaction, and when the bank confirms it, the transaction is settled. Companies use accounting to keep finances clear and easy to read. In this app, you can think of it like jars that show exactly where your money is.",
        img: IMG_ACCOUNTING,
    },
    {
      icon: "📈",
      title: "What is a stock?",
      text: " A stock is a piece of a company that you can own yourself. When the company grows, the stock rises, which means your wealth does too. If the company you invested in performs in the opposite direction, the value of that stock drops. Price changes happen all the time. Learning from them helps build strategy to build your wealth.",
      img: IMG_STOCKS_ROBOT,
    },
    {
      icon: "🏛️",
      title: "What is the stock market?",
      text: " It’s like a giant store where people buy and sell stocks — tiny pieces of companies. Prices and values go up and down as people trade. World events affect the rises and falls, too. You can search for tickers like AAPL or MSFT to see how companies are doing, and practice with your own safe portfolio.",
      img: IMG_STOCKMARKET,
    },
    {
      icon: "💱",
      title: "What is a currency (FX)?",
      text: "Currency is money a country uses. Examples: 🇪🇺 Euro (€), 🇺🇸 US Dollar ($). People exchange currencies when they travel or trade. Paired symbols, such as EUR/USD, show how much the Euro is worth compared to US Dollar. Try now to compare currencies, for example, the GDP/USD or EUR/JPY. You can practice buying and selling safely here.",
      img: IMG_CURRENCY,
    },
    {
      icon: "🧮",
      title: "How transfers work",
      text: "Transfers move money between your jars. Buying sends funds from Savings into Investments, where you purchase stocks or currencies. Selling moves profits into Earnings, which you can spend or return to Savings. Each transfer teaches how choices shape results. Practicing this flow step by step shows how real money systems work safely!",
      img: IMG_TRADE,
    },
    {
      icon: "🧠",
      title: "Profit & Loss (P/L)",
      text: " Winning means you have a profit: you got more than you started with. Losing means you have a loss: you ended up with less than what you started with. Both are part of the game. Realized P/L is like a finished play, Unrealized P/L is still running. The Profits tab adds it all up so you see your final score clearly.",
      img: IMG_PROFITS,
    },
    {
      icon: "🛡️",
      title: "Safety first",
      text: "This app is 100% safe—no real money is at risk. Parent PINs and spending limits protect every action. You can test ideas, undo mistakes, and try again freely. When you’re ready, you can even notify your parent to mirror choices in real life. Safety here means freedom to learn, grow, and explore.",
      img: IMG_SAFETY,
    },
     {
      icon: "🛡️",
      title: "How to start trading",
      text: " 🟢1 Choose Stocks from the top bar. 🟢2 Check global trends to see what moves. 🟢3 Use the search bar to find a company. 🟢4 Press Add more to explore new shares. 🟢5 Pick one you like. 🟢6 Set a quantity and buy. 🟢7 Watch your trade, manage profits, and sell when ready. Each step is safe, simple, and helps you grow skills with confidence!.",
      img: IMG_TUTORIAL_STOCKS,
    },
    {
      icon: "🎉",
      title: "You’re ready!",
      text: "You’re ready! You’ve learned what the Savings, Earnings, Donations, and Investments jars are and why they are vital to your financial growth, what a stock is, what the stock market means, what a currency (FX) is, how trades work, what Profit & Loss (P/L) means, and that the app is always safe. Now you’re ready to explore! Have fun and good luck!",
      img: IMG_READY,
    }
  ];
}

// 6) Stałe
const TUTORIAL_DONE_KEY = "pf_tutorial_done";
const TUTORIAL_REWARD_KEY = "pf_tutorial_reward_given";
const TUTORIAL_REWARD_POINTS = 10;

// ====== DOM ======
const $ = q => document.querySelector(q);
const $$ = q => Array.from(document.querySelectorAll(q));

const childSel = $("#childSelector");
const addChildBtn = $("#addChildBtn");


// ===== MINI-JARS (sticky pasek) =====
const miniEls = {
  cash:        document.getElementById('miniCash'),
  save:        document.getElementById('miniSave'),
  spend:       document.getElementById('miniSpend'),
  give:        document.getElementById('miniGive'),
  invest:      document.getElementById('miniInvest'),
  invFx:       document.getElementById('miniFx'),
  invStocks:   document.getElementById('miniStocks'),
  invTotal:    document.getElementById('miniTotal'),
  // NEW: Profits in sticky bar
  totalEarned: document.getElementById('miniTotalEarned'),
  totalLoss:   document.getElementById('miniTotalLoss')
};
/* === MOBILE-ONLY TEXT REPLACEMENT for mini-jars (EN/PL) === */
function applyMiniLabelsMobile() {
  // tylko telefon
  if (!window.matchMedia("(max-width:640px)").matches) return;

  const lang = (typeof getLang === 'function' ? getLang() : 'en');

  // WYMAGANE PRZEZ CIEBIE NAPISY
  const L = (lang === 'pl')
    ? {
        cash:        'Środki',
        invest:      'Invest',
        invFx:       'Waluta',
        invStocks:   'Akcje',
       invTotal:    'Razem',
        totalEarned: 'Profity',
        totalLoss:   'Straty'
      }
    : {
        cash:        'Cash',
        invest:      'Invests',
        invFx:       'FX',
        invStocks:   'Stocks',
        invTotal:    'Total',
        totalEarned: 'Profits',
        totalLoss:   'Losses'
      };

  // Znajdujemy elementy po ich atrybucie data-i18n
  const map = {
    cash:        document.querySelector('[data-i18n="miniCash"]'),
    invest:      document.querySelector('[data-i18n="miniInv"]'),
    invFx:       document.querySelector('[data-i18n="miniInvFx"]'),
    invStocks:   document.querySelector('[data-i18n="miniInvStocks"]'),
      invTotal:    document.querySelector('[data-i18n="miniInvTotal"]'),
    totalEarned: document.querySelector('[data-i18n="miniProfits"]'),
    totalLoss:   document.querySelector('[data-i18n="miniLosses"]')
  };

  // Podmieniamy textContent zamiast dopisywać
  for (const key in map) {
    if (map[key]) map[key].textContent = L[key];
  }
}

// uruchamiamy na starcie
document.addEventListener('DOMContentLoaded', applyMiniLabelsMobile);

// reagujemy na zmianę szerokości (wejście/wyjście z mobile)
matchMedia('(max-width:640px)').addEventListener('change', applyMiniLabelsMobile);

function setPnlColor(el, pnl){
  if (!el) return;
  el.classList?.remove('pnl-pos','pnl-neg');
  el.style.color = '';
  if (pnl > 0) el.classList?.add('pnl-pos');
  else if (pnl < 0) el.classList?.add('pnl-neg');
}

// helper: USD ze znakiem dla earned/loss
function fmtSignedUSD(amount, direction){
  const sign = direction > 0 ? '+' : direction < 0 ? '−' : '';
  const absTxt = USD(Math.abs(Number(amount || 0)));
  return sign ? `${sign} ${absTxt}` : absTxt;
}

// zsumowane „wolne” środki (bez Investments)
function computeAvailableCashFromJars(jars){
  return Number(jars?.save || 0) + Number(jars?.spend || 0) + Number(jars?.give || 0);
}

function renderMiniJars(){
  const ch = activeChild?.();
  if (!ch) {
    Object.values(miniEls).forEach(el => {
      if (!el) return;
      el.textContent = '0.00 USD';
      el.classList?.remove('pnl-pos','pnl-neg');
      el.style && (el.style.color = '');
    });
    return;
  }

  const j = ch.jars || { save:0, spend:0, give:0, invest:0 };
  const cash = computeAvailableCashFromJars(j);

  // podstawowe słoiki
if (miniEls.cash)   miniEls.cash.textContent   = fmtMoneyFromUSD(cash);
if (miniEls.save)   miniEls.save.textContent   = fmtMoneyFromUSD(j.save);
if (miniEls.spend)  miniEls.spend.textContent  = fmtMoneyFromUSD(j.spend);
if (miniEls.give)   miniEls.give.textContent   = fmtMoneyFromUSD(j.give);
if (miniEls.invest) miniEls.invest.textContent = fmtMoneyFromUSD(j.invest);
applyMiniLabelsMobile();

  // wartości portfeli
  const valStocks = portfolioValueStocks(ch);
  const valFx     = portfolioValueFx(ch);
  const valTotal  = valStocks + valFx;

  // niezrealizowane P/L do koloru i strzałki
  const pnlStocks = unrealizedStocks(ch);
  const pnlFx     = unrealizedFx(ch);
  const pnlTotal  = pnlStocks + pnlFx;

  // ⬇⬇⬇ ZAMIANA: zamiast +/− doklejamy strzałkę (▲/▼) i zachowujemy kolor liczby
 // Mobile-only: bez strzałek w mini-jars
const isMobileMini = window.matchMedia('(max-width: 768px)').matches;

if (miniEls.invStocks) {
  if (isMobileMini) {
    miniEls.invStocks.textContent = USD(valStocks); // bez strzałki
  } else {
    miniEls.invStocks.innerHTML = `${USD(valStocks)} ${arrowHtml(pnlStocks > 0 ? 1 : pnlStocks < 0 ? -1 : 0)}`;
  }
  setPnlColor(miniEls.invStocks, pnlStocks);
}

if (miniEls.invFx) {
  if (isMobileMini) {
    miniEls.invFx.textContent = USD(valFx);
  } else {
    miniEls.invFx.innerHTML = `${USD(valFx)} ${arrowHtml(pnlFx > 0 ? 1 : pnlFx < 0 ? -1 : 0)}`;
  }
  setPnlColor(miniEls.invFx, pnlFx);
}

if (miniEls.invTotal) {
  if (isMobileMini) {
    miniEls.invTotal.textContent = USD(valTotal);
  } else {
    miniEls.invTotal.innerHTML = `${USD(valTotal)} ${arrowHtml(pnlTotal > 0 ? 1 : pnlTotal < 0 ? -1 : 0)}`;
  }
  setPnlColor(miniEls.invTotal, pnlTotal);
}


  // === Total earned / Total loss – nadal z + / − ===
  const round2 = v => Math.round(Number(v) * 100) / 100;
  let totalEarned = 0, totalLoss = 0;

  (ch.tradeLedgerStocks || []).forEach(tx => {
    if (tx.pnl > 0) totalEarned += round2(tx.pnl);
    else if (tx.pnl < 0) totalLoss += round2(tx.pnl);
  });
  (ch.tradeLedgerFx || []).forEach(tx => {
    if (tx.pnl > 0) totalEarned += round2(tx.pnl);
    else if (tx.pnl < 0) totalLoss += round2(tx.pnl);
  });
  totalLoss = Math.abs(totalLoss);

  if (miniEls.totalEarned) {
    miniEls.totalEarned.textContent = fmtSignedUSD(totalEarned, totalEarned); // + przy >0
    setPnlColor(miniEls.totalEarned, totalEarned);
  }
  if (miniEls.totalLoss) {
    miniEls.totalLoss.textContent = fmtSignedUSD(totalLoss, -totalLoss);      // − przy >0
    setPnlColor(miniEls.totalLoss, totalLoss > 0 ? -1 : 0);
  }
}


// Jars / KPI
const saveAmt = $("#saveAmt");
const spendAmt = $("#spendAmt");
const giveAmt = $("#giveAmt");
const investAmt = $("#investAmt");
const netWorthEl = $("#netWorth");
const availableCashEl = $("#availableCash"); // ⬅ NEW

// Stocks
const stockList = $("#stockList");
const tradeBox = $("#tradeBox");
const tradeTitle = $("#tradeTitle");
const qtyInput = $("#qty");
const costEl = $("#cost");
const portfolioBody = $("#portfolioBody");
const portfolioEmpty = $("#portfolioEmpty");
const tableWrapStocks = document.querySelector("#tab-invest .tableWrap");

// FX
const fxList = $("#fxList");
const fxTradeBox = $("#fxTradeBox");
const fxTradeTitle = $("#fxTradeTitle");
const fxQty = $("#fxQty");
const fxCost = $("#fxCost");
const fxBody = $("#fxBody");
const fxEmpty = $("#fxEmpty");
const tableWrapFx = document.querySelector("#tab-fx .tableWrap");

// KPI: Realized, Unrealized, Earned, Loss
const kRS = $("#kpiRealizedStocks");
const kUS = $("#kpiUnrealizedStocks");
const kRF = $("#kpiRealizedFx");
const kUF = $("#kpiUnrealizedFx");
const kTotal = $("#kpiTotal");
const kLoss = $("#kpiTotalLoss"); // Total loss

// History / ledger / misc
const histStocks = $("#tradeHistoryBody");
const histFx = $("#fxHistoryBody");
const ledgerEl = $("#ledger");
const filterEl = $("#filterType");
const toastEl = $("#toast");

// Tutorial
const tutorialModal = document.getElementById("tutorialModal");
const tutorialIcon = document.getElementById("tutorialIcon");
const tutorialTitle = document.getElementById("tutorialTitle");
const tutorialText = document.getElementById("tutorialText");
const tutorialImage = document.getElementById("tutorialImage");
const tutCaption = document.getElementById("tutCaption");

// Live toggle
const liveToggle = document.getElementById('liveModeToggle') || { checked: false, addEventListener: () => {} };
const liveLabel  = document.getElementById('liveModeLabel')  || { textContent: "" };
const liveStatus = document.getElementById('liveStatus')      || { textContent: "" };

// Controls
const stockSearch = document.getElementById('stockSearch');
const stockAddPopular = document.getElementById('stockAddPopular');
const addAllowanceBtn = document.getElementById('addAllowance');

// Helpers
function getDataModeSection() {
  const n1 = document.getElementById('liveModeToggle');
  const n2 = document.getElementById('liveModeLabel');
  return (n1 && n1.closest('.card')) || (n2 && n2.closest('.card')) || null;
}
function setHidden(el, hidden) { if (!el) return; el.classList.toggle('hidden', !!hidden); }

// ====== APP ======
let app = load();
if (app.pinHash == null) setPin(app, "1234");
(app.childrenOrder || []).forEach(id => {
  const ch = (app.children || {})[id];
  if (!ch) return;
  ch.fxPairsEnabled = [...new Set(ch.fxPairsEnabled || [])];
});
save(app);

let selectedStock = null;
let selectedFxPair = null;
setInterval(() => {
  if (app.liveMode) return;
Object.values(app.children).forEach(ch => {
  ch.stocks = ch.stocks.map(s => {
    const drift = 1 + (Math.random() - 0.5) * 0.01;
    const np = clamp(s.p * drift, 1, 9999);
    const px = Number(np.toFixed(2));
    // ▲ zapisuj cenę także do HUB-a, aby wszystkie sekcje miały identyczną cenę
    PRICE_HUB.set(s.t, px);
    return { ...s, p: px };
  });
});


  save(app);
  if (!__qtyTyping) {
  renderStocks(stockSearch?.value || "");
  renderPortfolioStocks();
  renderJars();
  renderProfits();
  renderBasketStocks();   // ⬅️ NEW
  renderBasketFx();       // ⬅️ NEW
}

}, 2000);

let __qtyTyping = false;

document.addEventListener('focusin',  e => {
  if (e.target && (
      e.target.matches('input[data-fxsell-q]') ||
      e.target.matches('input[data-sell-q]')   ||
      e.target.matches('.basket-qty')          // ⬅️ DODANE
    )) {
    __qtyTyping = true;
  }
});

document.addEventListener('focusout', e => {
  if (e.target && (
      e.target.matches('input[data-fxsell-q]') ||
      e.target.matches('input[data-sell-q]')   ||
      e.target.matches('.basket-qty')          // ⬅️ DODANE
    )) {
    __qtyTyping = false;
  }
});



let stockExpanded = false;
function updateStockMoreBtn(totalCount, isDefaultView) {
  const btn = document.getElementById('stockAddPopular');
  if (!btn) return;
  if (!isDefaultView || totalCount <= 5) btn.style.display = 'none';
  else { btn.style.display = ''; btn.textContent = stockExpanded ? 'Show less' : 'Add more'; }
}
document.getElementById('stockAddPopular')?.addEventListener('click', () => {
  stockExpanded = !stockExpanded;
  renderStocks(document.getElementById('stockSearch')?.value || "");
});

let lastFxUiPrice = null;
let lastStockUiPrice = null;
setInterval(() => {
  if (app.liveMode) return;
Object.values(app.children).forEach(ch => {
  ch.stocks = ch.stocks.map(s => {
    const drift = 1 + (Math.random() - 0.5) * 0.01;
    const np = clamp(s.p * drift, 1, 9999);
    const px = Number(np.toFixed(2));
    // ▲ zapisuj cenę także do HUB-a, aby wszystkie sekcje miały identyczną cenę
    PRICE_HUB.set(s.t, px);
    return { ...s, p: px };
  });
});


  save(app);
  if (!__qtyTyping) {
  renderStocks(stockSearch?.value || "");
  renderPortfolioStocks();
  renderJars();
  renderProfits();
  renderBasketStocks();   // ⬅️ NEW
  renderBasketFx();       // ⬅️ NEW
}

}, 2000);

// ====== TREND HELPERS ======
function ensureTrends() { if (!app.trends) app.trends = { stocks: {}, fx: {} }; }
function stockTrendDir(symbol, price) {
  ensureTrends();
  const prev = app.trends.stocks[symbol];
  let d = 0;
  if (typeof prev === 'number') { if (price > prev) d = 1; else if (price < prev) d = -1; }
  app.trends.stocks[symbol] = price;
  return d;
}
function fxTrendDir(pair, rate) {
  ensureTrends();
  const prev = app.trends.fx[pair];
  let d = 0;
  if (typeof prev === 'number') { if (rate > prev) d = 1; else if (rate < prev) d = -1; }
  app.trends.fx[pair] = rate;
  return d;
}
function arrowHtml(dir) {
  if (dir > 0) return `<span class="pnl-pos" aria-label="up" style="margin-left:6px;font-weight:700">▲</span>`;
  if (dir < 0) return `<span class="pnl-neg" aria-label="down" style="margin-left:6px;font-weight:700">▼</span>`;
  return `<span class="muted" aria-label="flat" style="margin-left:6px">—</span>`;
}

// 🔄 Reset trendów (np. przy przełączaniu Live)
function clearTrendsAll() {
  if (app?.trends?.stocks) Object.keys(app.trends.stocks).forEach(k => delete app.trends.stocks[k]);
  if (app?.trends?.fx)     Object.keys(app.trends.fx).forEach(k => delete app.trends.fx[k]);
  Object.keys(gtPrevStocks).forEach(k => delete gtPrevStocks[k]);
  Object.keys(gtPrevFx).forEach(k => delete gtPrevFx[k]);
}

function activeChild() { return app.children[app.activeChildId]; }
function toast(msg) {
  if (!toastEl) {
    alert(String(msg || 'Info'));
    return;
  }

  toastEl.textContent = msg;
  toastEl.classList.add('_show');
  toastEl.style.display = 'block';

  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => {
    toastEl.classList.remove('_show');
    setTimeout(() => {
      toastEl.style.display = 'none';
      toastEl.textContent = '';
    }, 250);
  }, 7000); // 7 sekund
}
// ====== PRICING (SAFE) ======
function fxRate(pair) {
  const [A, B] = pair.split("/");
  const a = baseFx?.[A];
  const b = baseFx?.[B];
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return a / b;
}
// Udostępnij kursy FX do całej apki (Watchlist też to zobaczy)
window.fxRate = fxRate;

// Udostępnij JEDNĄ funkcję do pobierania spotu akcji – ten sam dla wszystkich paneli
(function () {
  const HUB = (typeof window !== 'undefined' && window.PRICE_HUB) ? window.PRICE_HUB : null;
  const norm = s => String(s || '').trim().toUpperCase().replace(/\.US$/, '');

  function pickNumber(v){
    if (v && typeof v === 'object') v = v.price ?? v.last ?? v.value ?? null;
    v = Number(v);
    return (Number.isFinite(v) && v > 0) ? v : null;
  }

  function readFromHub(k){
    if (!HUB) return null;
    let v = null;
    if (typeof HUB.use === 'function') v = pickNumber(HUB.use(k, null));
    else if (typeof HUB.get === 'function') v = pickNumber(HUB.get(k));
    else if (k in HUB) v = pickNumber(HUB[k]);
    return v;
  }

  // Jedno API dla wszystkich modułów
  window.getSpot = function getSpot(sym, fallback = null){
    const k = norm(sym);
    return readFromHub(k) ?? readFromHub(k + '.US') ?? fallback;
  };
})();


// cena BASE/USD niezależnie od QUOTE pary
function rateUsdFromPair(pair) {
  const [A] = pair.split("/");
  const a = baseFx?.[A];
  const usd = baseFx?.USD;
  if (!Number.isFinite(a) || !Number.isFinite(usd) || usd <= 0) return null;
  return a / usd;
}
// Udostępnij dla Watchlist i innych modułów
window.fxRate = fxRate;


function fxValueUsd(pair, qty) {
  const rUsd = rateUsdFromPair(pair);
  if (!Number.isFinite(rUsd)) return 0;
  return rUsd * (Number(qty) || 0);
}


// ====== GLOBAL TRENDS ======
const gtPrevFx = {};
const gtPrevStocks = {};
let currentTrendsMode = 'stocks';

/* KROK 4: bez mrugania — aktualizujemy elementy "w miejscu".
   - Używamy data-key do identyfikacji kafelków
   - Dla FX kierunek liczony z app.trends.fx (trwała mapa, nie znika między renderami)
   - Nie czyścimy całego kontenera; dodajemy/aktualizujemy/ew. usuwamy nadmiar
*/
// ===== Stable FX state for Global Trends (no flicker) =====
const GT_FX_STATE = new Map(); // key: "EUR/USD" -> { last:number, dir:-1|0|1, t:number }
const GT_FX_MIN_PCT = 0.0005;  // 0.05% — próg zmiany kierunku
const GT_FX_MIN_MS  = 1500;    // 1.5 s — minimalny odstęp między flipami

function gtStableFxDir(pair, rateNow){
  const st = GT_FX_STATE.get(pair) || { last: rateNow, dir: 0, t: 0 };
  const now = Date.now();

  if (!Number.isFinite(rateNow) || rateNow <= 0) {
    return st.dir; // brak danych → nie zmieniaj
  }

  const prev = st.last;
  let nextDir = st.dir;

  if (Number.isFinite(prev) && prev > 0) {
    const pct = Math.abs((rateNow / prev) - 1);
    const enoughChange = pct >= GT_FX_MIN_PCT;
    const enoughTime   = (now - st.t) >= GT_FX_MIN_MS;

    if (enoughChange && enoughTime) {
      nextDir = rateNow > prev ? 1 : (rateNow < prev ? -1 : 0);
      st.t = now;
    }
  }

  st.last = rateNow;
  st.dir  = nextDir;
  GT_FX_STATE.set(pair, st);
  return nextDir;
}

// --- % change cache + format with min display ---
const GT_CHG_LAST = new Map(); // pair -> last value used for % change

function fxChangePctStable(pair, nowVal) {
  const prev = GT_CHG_LAST.get(pair);
  let pct = 0;
  if (Number.isFinite(prev) && prev > 0 && Number.isFinite(nowVal) && nowVal > 0) {
    pct = ((nowVal - prev) / prev) * 100;
  }
  GT_CHG_LAST.set(pair, nowVal);
  return pct;
}

// Wyświetlaj min. ±0.005% zamiast +0.00% / -0.00%
function fmtPctWithFloor(pct, dir) {
  const abs = Math.abs(pct);
  const FLOOR = 0.005; // 0.005%
  if (dir !== 0 && abs < FLOOR) {
    // gdy jest ruch, ale < 0.005% – pokaż 0.005% z odpowiednim znakiem
    return (dir > 0 ? `+${FLOOR.toFixed(3)}%` : `-${FLOOR.toFixed(3)}%`);
  }
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function renderGlobalTrends(mode) {
  currentTrendsMode = mode;
  const wrap = document.getElementById('globalTrendsList');
  const sub  = document.getElementById('globalTrendsSub');
  if (!wrap) return;

  // helper: pobierz/utwórz kafelek po kluczu
  function getTile(key) {
    let el = wrap.querySelector(`[data-key="${key}"]`);
    if (!el) {
      el = document.createElement('div');
      el.className = 'trend-item';
      el.setAttribute('data-key', key);
      el.innerHTML = `
        <div class="trend-head">
          <span class="lh">
            <div class="code" style="font-weight:700"></div>
            <div class="name muted" style="font-size:12px"></div>
          </span>
          <span class="rh" style="text-align:right">
            <div class="px"  style="font-weight:700"></div>
            <div class="q muted" style="font-size:11px"></div>
          </span>
        </div>
        <div class="trend-sub chg"></div>`;
      wrap.appendChild(el);
    }
    return el;
  }

  const seen = new Set();

 if (mode === 'fx') {
  if (sub) sub.textContent = 'World currency trends';
  const quote = fxQuote(); // USD lub PLN
  const bases = ISO.filter(c => c !== quote).slice(0, 8);
  if (!app.trends) app.trends = { stocks: {}, fx: {} };

  bases.forEach(base => {
    const pair = `${base}/${quote}`;
    const rateNow = Number(fxRate(pair) || 0);
    if (!Number.isFinite(rateNow) || rateNow <= 0) return;

    // stabilny kierunek
    const dir = gtStableFxDir(pair, rateNow);

    // stabilny % zmiany
    const chgPct = fxChangePctStable(pair, rateNow);

    app.trends.fx[pair] = rateNow;
    const el = getTile(pair);
    seen.add(pair);

    el.querySelector('.code').textContent = base;
    el.querySelector('.name').textContent = CURRENCY_NAMES[base] || base;
    el.querySelector('.px').innerHTML     = `${FX(rateNow)} ${arrowHtml(dir)}`;
    el.querySelector('.q').textContent    = `vs ${quote}`;
    el.querySelector('.chg').textContent  = fmtPctWithFloor(chgPct, dir);
  });

  } else {
    if (sub) sub.textContent = 'World stock trends';
    const ch = activeChild?.();
    (ch?.stocks || []).slice(0, 6).forEach(s => {
      const key = `STK:${s.t}`;
      const prev = gtPrevStocks[s.t];
      const dir  = (typeof prev === 'number') ? (s.p > prev ? 1 : s.p < prev ? -1 : 0) : 0;
      const chgPct = (typeof prev === 'number' && prev !== 0) ? ((s.p - prev) / prev) * 100 : 0;
      gtPrevStocks[s.t] = s.p;

      const el = getTile(key);
      seen.add(key);

      el.querySelector('.code').textContent = s.t;
      el.querySelector('.name').textContent = s.n || '';
  el.querySelector('.px').innerHTML    = `${PLN(priceOfStock(s.t, s.p))} ${arrowHtml(dir)}`;
      el.querySelector('.q').textContent    = ''; // brak „vs …” dla akcji
      el.querySelector('.chg').textContent  = `${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}%`;
    });
  }

  // usuń kafelki, których nie było w tym renderze
  wrap.querySelectorAll('.trend-item').forEach(el => {
    const key = el.getAttribute('data-key');
    if (!seen.has(key)) el.remove();
  });
}


function updateGlobalTrendsForTab(tabId){
  const card = document.getElementById('globalTrendsCard');
  if (!card) return;

  if (tabId === 'fx') {
    setHidden(card, false);
    renderGlobalTrends('fx');
  } else if (tabId === 'invest') {
    setHidden(card, false);
    renderGlobalTrends('stocks');
  } else {
    // profits, parent (i ewentualnie inne)
    setHidden(card, true);
  }
}


// ====== RENDER ======
function renderChildSelector() {
  if (!childSel) return;
  childSel.innerHTML = "";
  app.childrenOrder.forEach(id => {
    const opt = document.createElement("option"); opt.value = id; opt.textContent = app.children[id].name;
    if (id === app.activeChildId) opt.selected = true; childSel.appendChild(opt);
  });
}

function portfolioValueStocks(ch) {
  return Object.entries(ch.portfolio).reduce((sum, [t, p]) => {
    const s = ch.stocks.find(x => x.t === t) || { p: p.b };
    const cur = priceOfStock(t, s.p);         // ⬅ HUB
    return sum + (p.s || 0) * cur;
  }, 0);
}
function unrealizedStocks(ch) {
  return Object.entries(ch.portfolio).reduce((sum, [t, p]) => {
    const s = ch.stocks.find(x => x.t === t) || { p: p.b };
    const cur = priceOfStock(t, s.p);         // ⬅ HUB
    return sum + ((cur - p.b) * (p.s || 0));
  }, 0);
}


// >>> USD dla FX (wartość netto do słoików)
function portfolioValueFx(ch) {
  return Object.entries(ch.fxPortfolio).reduce((sum, [pair, pos]) => sum + fxValueUsd(pair, pos.q || 0), 0);
}
function unrealizedFx(ch) {
  return Object.entries(ch.fxPortfolio).reduce((sum, [pair, pos]) => sum + ((rateUsdFromPair(pair) - pos.b) * (pos.q || 0)), 0);
}

function setJarFill(amountEl, value) {
  if (!amountEl) return;
  const card = amountEl.closest('.jar-card');
  if (!card) return;
  const ref = Number((window.app && app.dailyLimit) || 500); // ⬅ było 50
  const pct = Math.min(90, (value / ref) * 90);
  const withFloor = value > 0 ? Math.max(5, pct) : 0;
  card.style.setProperty('--fill', withFloor.toFixed(2) + '%');
}


// >>> NEW: Available Cash (Savings + Earnings + Donations)
function renderAvailableCash() {
  const ch = activeChild();
  if (!ch || !availableCashEl) return;
  const cash = Number(ch.jars?.save || 0) + Number(ch.jars?.spend || 0) + Number(ch.jars?.give || 0);
availableCashEl.textContent = fmtMoneyFromUSD(cash);
}

function renderJars() {
  const ch = activeChild(); if (!ch) return;
  // Słoiki = STAŁE (bez przeliczania FX)
saveAmt   && (saveAmt.textContent   = fmtMoneyFromUSD(ch.jars.save));
spendAmt  && (spendAmt.textContent  = fmtMoneyFromUSD(ch.jars.spend));
giveAmt   && (giveAmt.textContent   = fmtMoneyFromUSD(ch.jars.give));
investAmt && (investAmt.textContent = fmtMoneyFromUSD(ch.jars.invest));

// Net worth nadal może być mark-to-market (PLN/ USD wg ustawień)
const net = ch.jars.save + ch.jars.spend + ch.jars.give + portfolioValueStocks(ch) + portfolioValueFx(ch);
netWorthEl && (netWorthEl.textContent = USD(net));

  setJarFill(saveAmt, ch.jars.save);
  setJarFill(spendAmt, ch.jars.spend);
  setJarFill(giveAmt, ch.jars.give);
  setJarFill(investAmt, ch.jars.invest);

  // ⬇⬇⬇ NEW: aktualizacja boxu Available Cash
  renderAvailableCash();
renderMiniJars();   // 
}

function renderStocks(filter = "") {
  const ch = activeChild(); if (!ch || !stockList) return;
  ensureExpandedStocks(ch);

  // ⬇⬇⬇ Zachowaj pasek filtra, jeśli siedzi w #stockList (mobile)
  const filterBar = stockList.querySelector('.maxprice-filter') || null;

  stockList.innerHTML = "";
  if (filterBar) stockList.appendChild(filterBar);

  const f = (filter || "").trim().toUpperCase();
  const isDefaultView = f === "";
  let data = (ch.stocks || []).filter(s =>
    !f || s.t.toUpperCase().includes(f) || (s.n || "").toUpperCase().includes(f)
  );

  // ⬇⬇⬇ Stabilny sort wg ceny, jeśli user włączył strzałkę
  const dir = (window.__sortStocksDir === 'asc' || window.__sortStocksDir === 'desc') ? window.__sortStocksDir : null;
  if (dir) {
    data.sort((a, b) => {
      const av = Number(priceOfStock(a.t, a.p));
      const bv = Number(priceOfStock(b.t, b.p));
      if (!Number.isFinite(av) && !Number.isFinite(bv)) return 0;
      if (!Number.isFinite(av)) return 1;
      if (!Number.isFinite(bv)) return -1;
      return dir === 'asc' ? av - bv : bv - av;
    });
  }

  const total = data.length;
  const limit = isDefaultView ? (stockExpanded ? 500 : 5) : 500;

  data.slice(0, limit).forEach(s => {
    const cur = priceOfStock(s.t, s.p); // HUB
    const dir = stockTrendDir(s.t, s.p);
    const btn = document.createElement("button");
    btn.className = "stock" + (selectedStock === s.t ? " active" : "");
    btn.innerHTML = `
      <div class="row">
        <div>
          <div style="font-weight:700">${s.t}</div>
          <div class="muted" style="font-size:12px">${s.n || ""}</div>
        </div>
        <div class="right" style="text-align:right">
          <div style="font-weight:700">${PLN(cur)} ${arrowHtml(dir)}</div>
          <div class="muted" style="font-size:11px">${app.liveMode ? TT().live : TT().sim}</div>
        </div>
      </div>`;
    btn.addEventListener("click", () => {
      selectedStock = s.t;
      updateTradeBox();
      renderStocks(f);
    });
    stockList.appendChild(btn);
  });

  updateStockMoreBtn(total, isDefaultView);
  save(app);
  updateTradeBox();
}

stockSearch?.addEventListener('input', (e) => renderStocks(e.target.value));

function renderPortfolioStocks() {
  const ch = activeChild(); if (!ch || !portfolioBody) return;

  // ➜ Zachowaj wpisane ilości zanim wyczyścimy tabelę
  const prevVals = {};
  portfolioBody.querySelectorAll('input[data-sell-q]').forEach(inp => {
    prevVals[inp.getAttribute('data-sell-q')] = inp.value;
  });

  portfolioBody.innerHTML = "";
  Object.entries(ch.portfolio).forEach(([t, p]) => {
    const s = ch.stocks.find(x => x.t === t) || { p: p.b };
    const value = (p.s || 0) * s.p;
    const pnl = (s.p - p.b) * (p.s || 0);
    const qMax = Math.max(1, Math.abs(p.s || 0));

    // przywróć to, co wpisał użytkownik (z klamrą)
       // ➜ pole startuje puste, jeśli user nic nie wpisał
    const userVal = (prevVals[t] !== undefined ? String(prevVals[t]) : "");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:600">${t}</td>
      <td>${p.s}</td>
      <td>${PLN(p.b)}</td>
      <td>${PLN(s.p)}</td>
      <td>${PLN(value)}</td>
      <td class="${pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}">${PLN(pnl)}</td>
      <td class="space">
       <input type="number" min="1" max="${qMax}" step="1"
       value="${userVal}" class="input" style="width:100%"
       data-sell-q="${t}" placeholder="enter 1–${qMax}">
        <button class="btn" data-sell-row="${t}">${TT().sell || 'Sell'}</button>
        <button class="btn" data-sell-max="${t}">Max</button>
      </td>`;

    portfolioBody.appendChild(tr);
  });

  const has = Object.keys(ch.portfolio).length > 0;
  portfolioEmpty && (portfolioEmpty.style.display = has ? 'none' : 'block');
 tableWrapStocks && (tableWrapStocks.style.display = has ? '' : 'none');


  // ➜ Klik w wierszu: klamrujemy qty do [1..max]
  portfolioBody.onclick = (e) => {
    const btnSell = e.target.closest('[data-sell-row]');
    if (btnSell) {
      const t = btnSell.getAttribute('data-sell-row');
      const pos = activeChild().portfolio[t];
      const qMax = Math.max(1, Math.abs(pos?.s || 0));
      const inp = portfolioBody.querySelector(`input[data-sell-q="${t}"]`);
      let qty = parseInt((inp?.value) || "1", 10);
      if (!isFinite(qty)) qty = 1;
      qty = Math.max(1, Math.min(qty, qMax));
      if (inp) inp.value = qty;          // pokaż skorygowaną wartość
      sellStock(t, qty);
      return;
    }
    const btnMax = e.target.closest('[data-sell-max]');
    if (btnMax) {
      const t = btnMax.getAttribute('data-sell-max');
      const pos = activeChild().portfolio[t];
      const inp = portfolioBody.querySelector(`input[data-sell-q="${t}"]`);
      if (inp) inp.value = Math.max(1, Math.abs(pos?.s || 0));
    }
  };
}



// === NOWE FUNKCJE do sumowania zaokrąglonego P/L ===
function realizedStocksDisplay(ch) {
  return (ch.tradeLedgerStocks || []).reduce((sum, tx) => sum + Math.round(tx.pnl * 100) / 100, 0);
}
function realizedFxDisplay(ch) {
  return (ch.tradeLedgerFx || []).reduce((sum, tx) => sum + Math.round(tx.pnl * 100) / 100, 0);
}

// === POPRAWIONA FUNKCJA renderProfits ===
function renderProfits() {
  const ch = activeChild(); if (!ch) return;

  // 4 podstawowe KPI
  const uS = unrealizedStocks(ch);
  const uF = unrealizedFx(ch);
  const rS = (typeof realizedStocksDisplay === 'function') ? realizedStocksDisplay(ch) : Number(ch.realizedStocks || 0);
  const rF = (typeof realizedFxDisplay === 'function') ? realizedFxDisplay(ch) : Number(ch.realizedFx || 0);

  if (kRS) kRS.textContent = PLN(rS);
  if (kUS) kUS.textContent = PLN(uS);
  if (kRF) kRF.textContent = PLN(rF);
  if (kUF) kUF.textContent = PLN(uF);

  // ===== Total earned / Total loss – tylko z historii sprzedaży =====
  const round2 = v => Math.round(Number(v) * 100) / 100;
  let totalEarned = 0;
  let totalLoss = 0;

  (ch.tradeLedgerStocks || []).forEach(tx => {
    if (tx.pnl > 0) totalEarned += round2(tx.pnl);
    else if (tx.pnl < 0) totalLoss += round2(tx.pnl);
  });
  (ch.tradeLedgerFx || []).forEach(tx => {
    if (tx.pnl > 0) totalEarned += round2(tx.pnl);
    else if (tx.pnl < 0) totalLoss += round2(tx.pnl);
  });
  totalLoss = Math.abs(totalLoss);

  if (kTotal) kTotal.textContent = PLN(totalEarned);
  if (kLoss) kLoss.textContent = PLN(totalLoss);

  // Historia Stocks
  if (histStocks) {
    histStocks.innerHTML = "";
    (ch.tradeLedgerStocks || []).forEach(tx => {
      const cls = tx.pnl >= 0 ? "pnl-pos" : "pnl-neg";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${tx.ts}</td><td>${tx.t}</td><td>${tx.qty}</td><td>${PLN(tx.price)}</td><td>${PLN(tx.basis)}</td><td class="${cls}">${PLN(tx.pnl)}</td>`;
      histStocks.appendChild(tr);
    });
  }

  // Historia FX
  if (histFx) {
    histFx.innerHTML = "";
    (ch.tradeLedgerFx || []).forEach(tx => {
      const cls = tx.pnl >= 0 ? "pnl-pos" : "pnl-neg";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${tx.ts}</td><td>${tx.pair}</td><td>${tx.qty}</td><td>${FX(tx.price)}</td><td>${FX(tx.basis)}</td><td class="${cls}">${PLN(tx.pnl)}</td>`;
      histFx.appendChild(tr);
    });
  }
}

// ===== FX LIST (dedupe + search + expand/less) =====
let fxExpanded = false;
function updateFxMoreBtn(totalCount, isDefaultView) {
  const btn = document.getElementById('fxMoreBtn');
  if (!btn) return;
  if (!isDefaultView || totalCount <= 5) btn.style.display = 'none';
  else { btn.style.display = ''; btn.textContent = fxExpanded ? 'Show less' : 'Add more currencies'; }
}
document.getElementById('fxMoreBtn')?.addEventListener('click', () => {
  fxExpanded = !fxExpanded;
  renderFxList(document.getElementById('fxSearch')?.value || "");
});

function renderFxList(filter = "") {
  const ch = activeChild(); if (!ch || !fxList) return;

  // ⬇⬇⬇ Zachowaj pasek filtra, jeśli siedzi w #fxList
  const filterBar = fxList.querySelector('.maxprice-filter') || null;

  // czyść listę
  fxList.innerHTML = "";

  // ⬇⬇⬇ Przywróć pasek filtra na początek listy
  if (filterBar) fxList.appendChild(filterBar);

  const raw = (filter || "").trim();
  const isDefaultView = raw === "";
  const quote = fxQuote(); // <-- USD lub PLN zależnie od języka

  // kierunek sortu ustawiany przez przycisk strzałki
  const dir = (window.__sortFxDir === 'asc' || window.__sortFxDir === 'desc') ? window.__sortFxDir : null;

  // sortuj pary wg bieżącego kursu
  function sortPairs(pairs) {
    if (!dir) return pairs;
    return pairs.slice().sort((a, b) => {
      const ra = Number(fxRate(a));
      const rb = Number(fxRate(b));
      if (!Number.isFinite(ra) && !Number.isFinite(rb)) return 0;
      if (!Number.isFinite(ra)) return 1;
      if (!Number.isFinite(rb)) return -1;
      return dir === 'asc' ? ra - rb : rb - ra;
    });
  }

  // generator jednego kafelka FX
  const toBtn = (pair) => {
    const r = fxRate(pair);
    if (!Number.isFinite(r)) return null;

    const dirTrend = fxTrendDir(pair, r);
    const [baseC, quoteC] = pair.split("/");
    const baseName = CURRENCY_NAMES[baseC] || baseC;

    const btn = document.createElement("button");
    btn.className = "fxpair" + (selectedFxPair === pair ? " active" : "");
    btn.innerHTML = `
      <div class="row">
        <div>
          <div style="font-weight:700">${baseC}</div>
          <div class="muted" style="font-size:12px">${baseName}</div>
        </div>
        <div class="right" style="text-align:right">
          <div style="font-weight:700">${FX(r)} ${arrowHtml(dirTrend)}</div>
          <div class="muted" style="font-size:11px">vs ${quoteC}</div>
        </div>
      </div>`;
    btn.addEventListener("click", () => {
      selectedFxPair = pair;
      updateFxTradeBox();
      renderFxList(filter);
    });
    return btn;
  };

  // 1) Użytkownik wpisał konkretną parę "A/B" -> pokaż tę parę
  if (raw.includes("/")) {
    const f = raw.toUpperCase();
    const [maybeA, maybeB] = f.split("/");
    const out = [];
    ISO.forEach(A => ISO.forEach(B => {
      if (A !== B) {
        const pair = `${A}/${B}`;
        if (pair.includes(maybeA) && pair.includes(maybeB)) out.push(pair);
      }
    }));
    const uniq = [...new Set(out)];
    const sorted = sortPairs(uniq);
    sorted.slice(0, 500).forEach(p => { const el = toBtn(p); if (el) fxList.appendChild(el); });
    updateFxMoreBtn(uniq.length, false);
    save(app);
    return;
  }

  // 2) Wpisano kod/nazwę waluty -> pokaż A/QUOTE (QUOTE = USD lub PLN)
  if (raw) {
    const f = raw.toUpperCase();

    // Wyszukanie po kodzie/nazwie waluty
    let bases = ISO.filter(code => {
      const name = (CURRENCY_NAMES[code] || code).toUpperCase();
      return code.includes(f) || name.includes(f);
    });

    // Nie pokazuj par z identyczną walutą po obu stronach
    bases = bases.filter(c => c !== quote);

    if (bases.length === 0) {
      updateFxMoreBtn(0, false);
      save(app);
      return;
    }

    const pairs = [...new Set(bases.map(b => `${b}/${quote}`))];
    const sorted = sortPairs(pairs);
    sorted.slice(0, 500).forEach(p => { const el = toBtn(p); if (el) fxList.appendChild(el); });
    updateFxMoreBtn(pairs.length, false);
    save(app);
    return;
  }

  // 3) Widok domyślny -> wszystkie A/QUOTE (A != QUOTE)
  const allBaseVsQuote = ISO.filter(b => b !== quote).map(b => `${b}/${quote}`);
  const uniq = [...new Set(allBaseVsQuote)];
  const sorted = sortPairs(uniq);
  const limit = fxExpanded ? 500 : 5;
  sorted.slice(0, limit).forEach(p => { const el = toBtn(p); if (el) fxList.appendChild(el); });
  updateFxMoreBtn(uniq.length, true);
  save(app);
}



function renderPortfolioFx() {
  const ch = activeChild(); if (!ch || !fxBody) return;

  // ➜ Zachowaj wpisane ilości zanim wyczyścimy tabelę
  const prevVals = {};
  fxBody.querySelectorAll('input[data-fxsell-q]').forEach(inp => {
    prevVals[inp.getAttribute('data-fxsell-q')] = inp.value;
  });

  fxBody.innerHTML = "";
  Object.entries(ch.fxPortfolio).forEach(([pair, pos]) => {
    const rUsd = rateUsdFromPair(pair);
    const valueUsd = fxValueUsd(pair, pos.q || 0);
    const pnl = (rUsd - pos.b) * (pos.q || 0);
    const qMax = Math.max(1, Math.abs(pos.q || 0));

    // przywróć to, co wpisał użytkownik (z klamrą)
       // ➜ pole startuje puste, jeśli user nic nie wpisał
    const userVal = (prevVals[pair] !== undefined ? String(prevVals[pair]) : "");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:600">${pair}</td>
      <td>${pos.q}</td>
      <td>${FX(pos.b)}</td>
      <td>${FX(rUsd)}</td>
      <td>${PLN(valueUsd)}</td>
      <td class="${pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}">${PLN(pnl)}</td>
      <td class="space">
       <input type="number" min="1" max="${qMax}" step="1"
       value="${userVal}" class="input" style="width:100%"
       data-fxsell-q="${pair}" placeholder="enter 1–${qMax}">

        <button class="btn" data-fxsell-row="${pair}">${TT().sell || 'Sell'}</button>
        <button class="btn" data-fxmax="${pair}">Max</button>
      </td>`;

    fxBody.appendChild(tr);
  });

  const has = Object.keys(ch.fxPortfolio).length > 0;
  fxEmpty && (fxEmpty.style.display = has ? 'none' : 'block');
  tableWrapFx && (tableWrapFx.style.display = has ? '' : 'none');

  // ➜ Klik w wierszu: klamrujemy qty do [1..max]
  fxBody.onclick = (e) => {
    const btnSell = e.target.closest('[data-fxsell-row]');
    if (btnSell) {
      const pair = btnSell.getAttribute('data-fxsell-row');
      const pos = activeChild().fxPortfolio[pair];
      const qMax = Math.max(1, Math.abs(pos?.q || 0));
      const inp = fxBody.querySelector(`input[data-fxsell-q="${pair}"]`);
      let qty = parseFloat((inp?.value) || "1");
      if (!isFinite(qty)) qty = 1;
      qty = Math.max(1, Math.min(qty, qMax));
      if (inp) inp.value = qty;          // pokaż skorygowaną wartość
      sellFx(pair, qty);
      return;
    }
    const btnMax = e.target.closest('[data-fxmax]');
    if (btnMax) {
      const pair = btnMax.getAttribute('data-fxmax');
      const pos = activeChild().fxPortfolio[pair];
      const inp = fxBody.querySelector(`input[data-fxsell-q="${pair}"]`);
      if (inp) inp.value = Math.max(1, Math.abs(pos?.q || 0));
    }
  };
}


function renderLedger() {
  const ch = activeChild(); if (!ch || !ledgerEl) return;
  const f = filterEl ? filterEl.value : 'all';
  ledgerEl.innerHTML = "";
  ch.ledger.filter(x => f === "all" ? true : x.type === f).forEach(item => {
    const li = document.createElement("li");
    const left = document.createElement("div");
    const right = document.createElement("div");
    left.innerHTML = `<strong>${item.note || (item.type === "in" ? "Top-up" : "Expense")}</strong><br><span class="sub">${item.ts}</span>`;
    right.innerHTML = `<strong>${item.type === "in" ? "+" : "−"} ${PLN(item.amount)}</strong>`;
    li.appendChild(left);
    li.appendChild(right);
    ledgerEl.appendChild(li);
  });
}

// ====== Sell buttons ======
function ensureSellButtons() {
  const buyBtn = document.getElementById('buyBtn');
  const cancelTrade = document.getElementById('cancelTrade');
  if (buyBtn && !document.getElementById('sellBtn')) {
    const sellBtn = document.createElement('button');
    sellBtn.id = 'sellBtn';
    sellBtn.className = 'btn';
    sellBtn.setAttribute('data-i18n', 'sell');
    sellBtn.textContent = TT().sell || 'Sell';
    buyBtn.parentNode.insertBefore(sellBtn, cancelTrade);
    sellBtn.addEventListener('click', () => {
      if (!selectedStock) return;
      const qty = Math.max(1, parseInt(document.getElementById('qty').value || "1", 10));
      sellStock(selectedStock, qty);
    });
    }
  const fxBuyBtn = document.getElementById('fxBuyBtn');
  const fxCancel = document.getElementById('fxCancelTrade');
  if (fxBuyBtn && !document.getElementById('fxSellBtn')) {
    const fxSellBtn = document.createElement('button');
    fxSellBtn.id = 'fxSellBtn';
    fxSellBtn.className = 'btn';
    fxSellBtn.setAttribute('data-i18n', 'sell');
    fxSellBtn.textContent = TT().sell || 'Sell';
    fxBuyBtn.parentNode.insertBefore(fxSellBtn, fxCancel);
    fxSellBtn.addEventListener('click', () => {
      if (!selectedFxPair) return;
      const qty = Math.max(1, parseFloat(document.getElementById('fxQty').value || "1"));
      sellFx(selectedFxPair, qty);
    });
  

  }
}
// ====== TRADE — Stocks ======
function updateTradeBox() {
  ensureSellButtons();
  const ch = activeChild();
  if (!tradeBox || !ch || !selectedStock) { 
    tradeBox && (tradeBox.style.display = "none"); 
    return; 
  }
  const s = ch.stocks.find(x => x.t === selectedStock);
  const qty = Math.max(1, parseInt(qtyInput.value || "1", 10));
  const cur = priceOfStock(s.t, s.p); // ⬅️ pobierz cenę z HUB-a
  lastStockUiPrice = cur;
  if (tradeTitle) tradeTitle.textContent = `Trade ${s.t}`;
  if (costEl) costEl.textContent = PLN(qty * cur);
  tradeBox.style.display = "block";  
  const sellBtn = document.getElementById('sellBtn');
  if (sellBtn) {
    const pos = ch.portfolio?.[s.t];
    const canSell = !!(pos && pos.s > 0);
    sellBtn.disabled = !canSell;
    sellBtn.title = canSell ? "" : "You have 0 shares to sell";
  }
}
  
function buyStock() {
  const ch = activeChild(); if (!ch || !selectedStock) return;
  const s = ch.stocks.find(x => x.t === selectedStock);
  const qty = Math.max(1, parseInt(qtyInput.value || "1", 10));
const price = (lastStockUiPrice ?? priceOfStock(s.t, s.p));
  const cost = qty * price;
  if (cost > ch.jars.save) return toast(TT().needFunds(PLN(cost)));
  ch.jars.save -= cost;
  ch.jars.invest += cost;

  let pos = ch.portfolio[s.t] || { s: 0, b: price };
  if (pos.s < 0) {
    const cover = Math.min(qty, -pos.s);
    const pnl = (pos.b - price) * cover;
    ch.realizedStocks += pnl;
    ch.tradeLedgerStocks.unshift({ ts: nowISO(), t: s.t, qty: cover, price: price, basis: pos.b, pnl });
    pos.s += cover;
    const remaining = qty - cover;
    if (remaining > 0) {
      if (pos.s === 0) { pos.b = price; pos.s = remaining; }
      else { pos.b = ((pos.s * pos.b) + (remaining * price)) / (pos.s + remaining); pos.s += remaining; }
    }
  } else {
    const newShares = pos.s + qty;
    pos.b = ((pos.s * pos.b) + (qty * price)) / newShares;
    pos.s = newShares;
  }
  if (pos.s === 0) { delete ch.portfolio[s.t]; }
  else { ch.portfolio[s.t] = { s: Number(pos.s), b: Number(pos.b.toFixed(5)) }; }

  save(app);
  costEl && (costEl.textContent = PLN(cost));
  toast(TT().bought(qty, s.t));
  renderJars();
  renderPortfolioStocks();
  renderProfits();
}
function sellStock(t, qty) {
  qty = Math.max(1, parseInt(qty || "1", 10));

  const ch = activeChild(); 
  if (!ch) return;

  const pos = ch.portfolio?.[t];
  if (!pos || pos.s <= 0) {
    return toast(`You don't own ${t} yet.`);
  }

  // nie pozwalaj sprzedać więcej niż posiadane
  qty = Math.min(qty, pos.s);

  const s = ch.stocks.find(x => x.t === t) || { p: pos.b || 0 };
  const proceeds = s.p * qty;
  const basisOut = pos.b * qty;

  // wpływy do Earnings/Spend, baza schodzi z Investments
  ch.jars.spend += proceeds;
  ch.jars.invest = Math.max(0, (ch.jars.invest || 0) - basisOut);

  const realized = (s.p - pos.b) * qty;
  ch.realizedStocks += realized;
  ch.tradeLedgerStocks.unshift({ ts: nowISO(), t, qty, price: s.p, basis: pos.b, pnl: realized });

  pos.s -= qty;

  if (pos.s <= 0) delete ch.portfolio[t];
  else ch.portfolio[t] = { s: Number(pos.s), b: Number(pos.b.toFixed(5)) };

  save(app);
  toast(TT().sold ? TT().sold(qty, t, PLN(realized)) : `Sold ${qty} ${t} (P/L: ${PLN(realized)})`);
  renderJars();
  renderPortfolioStocks();
  renderProfits();
}
// ====== TRADE — FX (WERSJA USD) ======
function updateFxTradeBox() {
  ensureSellButtons();
  if (!fxTradeBox || !selectedFxPair) { fxTradeBox && (fxTradeBox.style.display = "none"); return; }
  const rUsd = rateUsdFromPair(selectedFxPair);
  lastFxUiPrice = rUsd;
  const qty = Math.max(1, parseFloat(fxQty.value || "1"));
  if (fxTradeTitle) fxTradeTitle.textContent = `FX Trade ${selectedFxPair}`;
  if (fxCost) fxCost.textContent = PLN(rUsd * qty); // koszt w USD
  fxTradeBox.style.display = "block";
}
  const fxSellBtn = document.getElementById('fxSellBtn');
  if (fxSellBtn) {
    const pos = activeChild()?.fxPortfolio?.[selectedFxPair];
    const canSell = !!(pos && pos.q > 0);
    fxSellBtn.disabled = !canSell;
    fxSellBtn.title = canSell ? "" : "You have 0 units to sell";
  }

function buyFx() {
  const ch = activeChild(); if (!ch || !selectedFxPair) return;
  const rUsd = (lastFxUiPrice ?? rateUsdFromPair(selectedFxPair));
  const qty = Math.max(1, parseFloat(fxQty.value || "1"));
  const cost = rUsd * qty;
  if (cost > ch.jars.save) return toast(TT().needFunds(PLN(cost)));
  ch.jars.save -= cost;
  ch.jars.invest += cost;

  let pos = ch.fxPortfolio[selectedFxPair] || { q: 0, b: rUsd };
  if (pos.q < 0) {
    const cover = Math.min(qty, -pos.q);
    const pnl = (pos.b - rUsd) * cover;
    ch.realizedFx += pnl;
    ch.tradeLedgerFx.unshift({ ts: nowISO(), pair: selectedFxPair, qty: cover, price: rUsd, basis: pos.b, pnl });
    pos.q += cover;
    const remaining = qty - cover;
    if (remaining > 0) {
      if (pos.q === 0) { pos.b = rUsd; pos.q = remaining; }
      else { pos.b = ((pos.q * pos.b) + (remaining * rUsd)) / (pos.q + remaining); pos.q += remaining; }
    }
  } else {
    const newQ = pos.q + qty;
    pos.b = ((pos.q * pos.b) + (qty * rUsd)) / newQ;
    pos.q = newQ;
  }

  if (pos.q === 0) { delete ch.fxPortfolio[selectedFxPair]; }
  else { ch.fxPortfolio[selectedFxPair] = { q: Number(pos.q), b: Number(pos.b.toFixed(5)) }; }

  save(app);
  fxCost && (fxCost.textContent = PLN(cost));
  toast(TT().bought(qty, selectedFxPair));
  renderJars();
  renderPortfolioFx();
  renderProfits();
}
function sellFx(pair, qty) {
  qty = Math.max(1, parseFloat(qty || "1"));

  const ch = activeChild(); 
  if (!ch) return;

  const pos = ch.fxPortfolio?.[pair];
  if (!pos || pos.q <= 0) {
    return toast(`You don't own ${pair} yet.`);
  }

  // nie pozwalaj sprzedać więcej niż posiadane
  qty = Math.min(qty, pos.q);

  const rUsd = rateUsdFromPair(pair);
  const proceeds = rUsd * qty;
  const basisOut = pos.b * qty;

  ch.jars.spend += proceeds;
  ch.jars.invest = Math.max(0, (ch.jars.invest || 0) - basisOut);

  const realized = (rUsd - pos.b) * qty;
  ch.realizedFx += realized;
  ch.tradeLedgerFx.unshift({ ts: nowISO(), pair, qty, price: rUsd, basis: pos.b, pnl: realized });

  pos.q -= qty;

  if (pos.q <= 0) delete ch.fxPortfolio[pair];
  else ch.fxPortfolio[pair] = { q: Number(pos.q), b: Number(pos.b.toFixed(5)) };

  save(app);
  toast(TT().sold ? TT().sold(qty, pair, PLN(realized)) : `Sold ${qty} ${pair} (P/L: ${PLN(realized)})`);
  renderJars();
  renderPortfolioFx();
  renderProfits();
}

// ====== LEDGER / TABS / PARENT GUARD / QUICK ACTIONS / EVENTS ======
// ====== BASKET (stocks + fx) ======
function findBasketItem(list, key) {
  return (list || []).find(x => x.key === key) || null;
}

// --- add to basket: STOCKS
function addToBasketStocks(sym, name, price, qty) {
  qty = Math.max(1, parseInt(qty || "1", 10));
  price = Number(price || 0);
  if (!sym || !qty || price <= 0) return;

  if (!app.basket) app.basket = { stocks: [], fx: [] };

  const it = findBasketItem(app.basket.stocks, sym);
  if (it) {
    it.qty += qty;
    it.price = price;       // aktualizuj do bieżącej ceny
  } else {
    app.basket.stocks.push({ key: sym, t: sym, n: name || sym, price, qty });
  }
  save(app);
  renderBasketStocks();
  toast(`Added to basket: ${qty} × ${sym}`);
}

// --- remove
function removeFromBasketStocks(sym) {
  if (!app?.basket?.stocks) return;
  app.basket.stocks = app.basket.stocks.filter(x => x.t !== sym);
  save(app);
  renderBasketStocks();
}

function removeFromBasketFx(pair) {
  if (!app?.basket?.fx) return;
  app.basket.fx = app.basket.fx.filter(x => x.pair !== pair);
  save(app);
  renderBasketFx();
}

// --- totals
function basketTotals(list) {
  let q = 0, sum = 0;
  (list || []).forEach(it => {
    const qty = Number(it.qty || 0);
    const unit = toCents(Number(it.price || it.priceUsd || 0)); // ⬅️ najpierw 2 dp
    q += qty;
    sum = toCents(sum + toCents(qty * unit));
  });
  return { qty: q, sum: toCents(sum) };
}



// === RENDER: STOCK BASKET (dopasowane do Twojego HTML) ===
// HTML:
// <div id="stock-basket">
//   <div class="basket-list">…</div>
//   <strong data-basket-qty="stocks"></strong>
//   <strong data-basket-amt="stocks"></strong>
// </div>
function renderBasketStocks() {
  const wrap = document.getElementById('stock-basket');
  if (!wrap) return;

  const listEl  = wrap.querySelector('.basket-list') || wrap;
  const emptyEl = listEl.querySelector('.basket-empty');
  const qtyEl   = wrap.querySelector('[data-basket-qty="stocks"]');
  const amtEl   = wrap.querySelector('[data-basket-amt="stocks"]');

  const items = app?.basket?.stocks || [];

  if (emptyEl) emptyEl.classList.toggle('hidden', items.length > 0);

  // wyczyść listę
  listEl.querySelectorAll('.basket-item').forEach(n => n.remove());

  // wiersze
  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'basket-item';
    row.innerHTML = `
      <div class="b-item-asset">
        <span class="b-ticker">${it.t}</span>
        <span class="b-name">${it.n || ''}</span>
      </div>
      <div class="b-price">${PLN(it.price)}</div>
      <div class="b-change"><span class="arrow-flat">—</span></div>
      <div class="b-qty">
        <input class="input basket-qty" type="number" min="1" step="1" value="${it.qty}">
        <button class="btn" data-act="upd">Set</button>
      </div>
      <div class="b-subtotal">${PLN(toCents(it.qty * it.price))}</div>
      <div class="b-remove"><button class="btn danger" data-act="rm">×</button></div>
    `;

    const inp = row.querySelector('input');

    // Enter = klik "Set"
    inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        row.querySelector('[data-act="upd"]')?.click();
      }
    });

    row.querySelector('[data-act="upd"]').addEventListener('click', () => {
      it.qty = Math.max(1, parseInt(inp.value || "1", 10));
      save(app);
      renderBasketStocks();
    });

 row.querySelector('[data-act="rm"]').addEventListener('click', () => removeFromBasketStocks(it.t));

    listEl.appendChild(row);
  });

const t = basketTotals(items);
if (qtyEl) qtyEl.textContent = '\u00A0\u00A0' + t.qty;
if (amtEl) amtEl.textContent = '\u00A0\u00A0' + PLN(t.sum);

}


// === RENDER: FX BASKET (dopasowane do Twojego HTML) ===
function renderBasketFx() {
  const wrap = document.getElementById('fx-basket');
  if (!wrap) return;

  const listEl  = wrap.querySelector('.basket-list') || wrap;
  const emptyEl = listEl.querySelector('.basket-empty');
  const qtyEl   = wrap.querySelector('[data-basket-qty="fx"]');
  const amtEl   = wrap.querySelector('[data-basket-amt="fx"]');

  const items = app?.basket?.fx || [];

  if (emptyEl) emptyEl.classList.toggle('hidden', items.length > 0);

  listEl.querySelectorAll('.basket-item').forEach(n => n.remove());

  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'basket-item';
    row.innerHTML = `
      <div class="b-item-asset">
        <span class="b-ticker">${it.pair}</span>
        <span class="b-name">${it.n || ''}</span>
      </div>
      <div class="b-price">${PLN(it.price)}</div>
      <div class="b-change"><span class="arrow-flat">—</span></div>
      <div class="b-qty">
        <input class="input basket-qty" type="number" min="1" step="1" value="${it.qty}">
        <button class="btn" data-act="upd">Set</button>
      </div>
      <div class="b-subtotal">${PLN(toCents(it.qty * it.price))}</div>
      <div class="b-remove"><button class="btn danger" data-act="rm">×</button></div>
    `;

    const inp = row.querySelector('input');

    // Enter = klik "Set"
    inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        row.querySelector('[data-act="upd"]')?.click();
      }
    });

    row.querySelector('[data-act="upd"]').addEventListener('click', () => {
      it.qty = Math.max(1, parseFloat(inp.value || "1"));
      save(app);
      renderBasketFx();
    });

   row.querySelector('[data-act="rm"]').addEventListener('click', () => removeFromBasketFx(it.pair));
    listEl.appendChild(row);
  });

  const t = basketTotals(items);
if (qtyEl) qtyEl.textContent = '\u00A0\u00A0' + t.qty;
if (amtEl) amtEl.textContent = '\u00A0\u00A0' + PLN(t.sum);
}

// ===== BUY FROM BASKET =====
function buyBasketStocks() {
  const ch = activeChild(); if (!ch) return;
  const items = app?.basket?.stocks || [];
  if (!items.length) return toast('Basket is empty');

const total = toCents(items.reduce((s, it) => toCents(s + toCents(Number(it.qty||0) * Number(it.price||0))), 0));

  if (total > ch.jars.save) return toast(TT().needFunds(PLN(total)));

  ch.jars.save   -= total;
  ch.jars.invest += total;

  items.forEach(it => {
    const t = it.t; const qty = Number(it.qty||0); const price = Number(it.price||0);
    if (!t || qty<=0 || price<=0) return;
    let pos = ch.portfolio[t] || { s:0, b:price };
    const newS = pos.s + qty;
    pos.b = ((pos.s * pos.b) + (qty * price)) / newS;
    pos.s = newS;
    ch.portfolio[t] = { s: Number(pos.s), b: Number(pos.b.toFixed(5)) };
  });

  app.basket.stocks = [];
  save(app);
  renderBasketStocks();
  renderJars();
  renderPortfolioStocks();
  toast('Bought all stock items from basket');
}

function buyBasketFx() {
  const ch = activeChild(); if (!ch) return;
  const items = app?.basket?.fx || [];
  if (!items.length) return toast('Basket is empty');

  // ✅ licz sumę z priceUsd
  const total = toCents(items.reduce(
    (s, it) => toCents(s + toCents(Number(it.qty||0) * Number(it.priceUsd||0))), 0));

  if (total > ch.jars.save) return toast(TT().needFunds(PLN(total)));

  ch.jars.save   -= total;
  ch.jars.invest += total;

  items.forEach(it => {
    const pair = it.pair || it.key;
    const qty  = Number(it.qty||0);
    const rUsd = Number(it.priceUsd||0);      // ✅ cena z priceUsd
    if (!pair || qty <= 0 || rUsd <= 0) return;

    let pos = ch.fxPortfolio[pair] || { q: 0, b: rUsd };
    const newQ = pos.q + qty;
    pos.b = ((pos.q * pos.b) + (qty * rUsd)) / newQ;
    pos.q = newQ;
    ch.fxPortfolio[pair] = { q: Number(pos.q), b: Number(pos.b.toFixed(5)) };
  });

  app.basket.fx = [];
  save(app);
  renderBasketFx();
  renderJars();
  renderPortfolioFx();
  toast('Bought all FX items from basket');
}


// --- podpięcie przycisków „Buy (investment cash)” w kartach koszyka
document.querySelector('[data-basket-buy="stocks"]')?.addEventListener('click', buyBasketStocks);
document.querySelector('[data-basket-buy="fx"]')?.addEventListener('click', buyBasketFx);


function addLedger(type, amount, note) {
  const ch = activeChild(); if (!ch) return;
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
  ch.ledger.unshift({ id, ts: nowISO(), type, amount: Number(amount), note: (note || "").slice(0, 60) });
  save(app);
}

document.querySelectorAll('.tab').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const t = b.dataset.tab;
    ["invest", "fx", "profits", "parent"].forEach(id => {
      const el = document.getElementById(`tab-${id}`);
      if (el) el.classList.toggle('hidden', id !== t);
    });
    updateGlobalTrendsForTab(t);
  });
});

document.querySelectorAll('.tab').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    b.classList.add('active');

    const t = b.dataset.tab;
    ["invest","fx","profits","parent"].forEach(id => {
      const el = document.getElementById(`tab-${id}`);
      if (el) el.classList.toggle('hidden', id!==t);
    });

    // chowaj sekcje spoza kart
    const homeTop = document.getElementById('homeTop');
    if (homeTop) homeTop.classList.toggle('hidden', t!=='invest');
    const gt = document.getElementById('globalTrendsCard');
    if (gt) gt.classList.toggle('hidden', !(t==='invest' || t==='fx'));

    updateGlobalTrendsForTab(t);
  });
});

function requireParent() {
  const a = JSON.parse(localStorage.getItem(AUTH_KEY) || '{"role":"guest"}');
  if (a.role !== 'parent') { alert((TT().onlyParent) || 'Parent only: please log in as Parent.'); return false; }
  return true;
}

document.getElementById('addAllowance')?.addEventListener('click', () => {
  const ch = activeChild(); if (!ch) return;
  const amt = 10;
  ch.jars.save += amt;
  addLedger("in", amt, "Allowance");
 toast( (TT().addedPocket && TT().addedPocket(fmtMoneyFromUSD(10))) || `Added allowance ${fmtMoneyFromUSD(10)}` );

  renderJars();
});

function moveAllEarningsToSavings() {
  const ch = activeChild(); if (!ch) return;
  const amt = Number(ch.jars.spend || 0);
  if (amt <= 0) return toast("Nothing to move");
  ch.jars.spend = 0;
  ch.jars.save += amt;
  save(app);
  toast(`Moved ${PLN(amt)} Earnings → Savings`);
  renderJars();
}
document.getElementById('moveSpendSave')?.addEventListener('click', moveAllEarningsToSavings);
document.getElementById('moveEarningsToSavings')?.addEventListener('click', moveAllEarningsToSavings);

function moveAllDonationsToSavings() {
  const ch = activeChild(); if (!ch) return;
  const amt = Number(ch.jars.give || 0);
  if (amt <= 0) return toast("Nothing to move");
  ch.jars.give = 0;
  ch.jars.save += amt;
  save(app);
  toast(`Moved ${PLN(amt)} Donations → Savings`);
  renderJars();
}
document.getElementById('moveDonationsToSavings')?.addEventListener('click', moveAllDonationsToSavings);
document.getElementById('moveDonToSave')?.addEventListener('click', moveAllDonationsToSavings);

/* === TRADE – STOCKS (btns) === */
document.getElementById('buyBtn')?.addEventListener('click', buyStock);
document.getElementById('cancelTrade')?.addEventListener('click', () => {
  selectedStock = null; updateTradeBox(); renderStocks(stockSearch?.value || "");
});
document.getElementById('qty')?.addEventListener('input', updateTradeBox);

/* === TRADE – FX (btns) === */
document.getElementById('fxBuyBtn')?.addEventListener('click', buyFx);
document.getElementById('fxCancelTrade')?.addEventListener('click', () => {
  selectedFxPair = null; updateFxTradeBox(); renderFxList($("#fxSearch")?.value || "");
});
document.getElementById('fxQty')?.addEventListener('input', updateFxTradeBox);

/* === LISTY / SZUKAJKI === */
document.getElementById('fxSearch')?.addEventListener('input', (e) => renderFxList(e.target.value));
document.getElementById('fxAddAllMajors')?.addEventListener('click', () => {
  const ch = activeChild(); if (!ch) return;
  const majors = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD"];
  majors.forEach(A => { if (A !== "USD") ch.fxPairsEnabled.push(`${A}/USD`); });
  ch.fxPairsEnabled = [...new Set(ch.fxPairsEnabled)];
  save(app);
  renderFxList(document.getElementById('fxSearch')?.value || "");
});

/* === JARS – szybkie dodawanie (z konwersją do USD) === */
document.querySelectorAll('[data-add]').forEach(btn => {
  btn.addEventListener('click', () => {
    const ch = activeChild(); if (!ch) return;
    const k = btn.getAttribute('data-add');

    const input = btn.parentElement.querySelector('.jar-input');
    let incDisp = Number(input?.value || 0);

    if (!incDisp || incDisp <= 0) {
      incDisp = (k === 'give' ? 2 : 5); // fallback
    }

    const incUSD = convertToUSD(incDisp, getDisplayCurrency()); // ⬅️ najważniejsze
    ch.jars[k] += incUSD;

    save(app);
    renderJars();
    if (input) input.value = '';
  });
});


/* === PARENT top-up / settings / clear === */
document.getElementById('topupForm')?.addEventListener('submit', e => {
  e.preventDefault();
  if (!requireParent()) return;

  const amtDisp = Number(document.getElementById("topupAmount").value); // wpisane w walucie wyświetlania
  const note = document.getElementById("topupNote").value;
  const pin = document.getElementById("parentPin").value;

  try { verifyPin(app, pin); } catch (err) { return alert(err.message); }
  if (!amtDisp || amtDisp <= 0) return alert("Enter amount > 0");

  const amtUSD = convertToUSD(amtDisp, getDisplayCurrency()); // ⬅️ konwersja
  const ch = activeChild(); if (!ch) return;

  ch.jars.save += amtUSD;
  addLedger("in", amtUSD, note || "Parent top-up");
  save(app);

  toast(TT().topupDone ? TT().topupDone(fmtMoneyFromUSD(amtUSD)) : `Topped up Savings by ${fmtMoneyFromUSD(amtUSD)}`);
  e.target.reset();
  renderJars();
});


document.getElementById('settingsForm')?.addEventListener('submit', e => {
  e.preventDefault();
  if (!requireParent()) return;
  const newLimit = document.getElementById("setDailyLimit").value;
  const newPin = document.getElementById("setPin").value;
  if (newLimit) {
    const v = Number(newLimit);
    if (v < 1) return alert("Limit ≥ 1");
    app.dailyLimit = v;
  }
  if (newPin) {
    try { setPin(app, newPin); } catch (err) { return alert(err.message); }
  }
  save(app);
  alert("Settings saved.");
  e.target.reset();
});

document.getElementById('clearDataBtn')?.addEventListener('click', () => {
  if (!requireParent()) return;
  if (confirm("Clear all demo data?")) {
    localStorage.removeItem(DB_KEY);
    app = load();
    renderAll();
  }
});

/* === Ledger & child switch === */
document.getElementById('filterType')?.addEventListener('change', () => renderLedger());

childSel?.addEventListener('change', () => {
  app.activeChildId = childSel.value;
  save(app);
  renderAll();
});

/* === Add Child === */
addChildBtn?.addEventListener('click', () => {
  if (!requireParent()) return;
  const name = prompt("Child's name:");
  if (!name) return;
  const id = crypto.randomUUID ? crypto.randomUUID() : `child_${Date.now()}`;
  app.children[id] = newChild(name);
  ensureExpandedStocks(app.children[id]);
  app.childrenOrder.push(id);
  app.activeChildId = id;
  save(app);
  renderChildSelector();
  renderAll();
  setTimeout(fillLoginChildSelector, 0);
  toast(`Added: ${name}`);
});

/* === NEW: Add to basket (Stocks) === */
document.getElementById('addToStockBasket')?.addEventListener('click', () => {
  if (!selectedStock) return toast('Pick a stock first.');
  const ch = activeChild();
  const s = ch?.stocks.find(x => x.t === selectedStock);
  const qty = Math.max(1, parseInt(document.getElementById('qty')?.value || '1', 10));
  const price = (lastStockUiPrice ?? s?.p ?? 0);
 addToBasketStocks(selectedStock, s?.n, price, qty);

});

/* === NEW: Add to basket (FX) === */
document.getElementById('addToFxBasket')?.addEventListener('click', () => {
  if (!selectedFxPair) return toast('Pick a currency pair first.');
  const qty = Math.max(1, parseFloat(document.getElementById('fxQty')?.value || '1'));
  const priceUsd = (lastFxUiPrice ?? rateUsdFromPair(selectedFxPair) ?? 0);
  addToBasketFx(selectedFxPair, priceUsd, qty);
});

/* === NEW: Buy from baskets === */
document.querySelector('[data-basket-buy="stocks"]')?.addEventListener('click', buyBasketStocks);
document.querySelector('[data-basket-buy="fx"]')?.addEventListener('click', buyBasketFx);



// ====== LIVE MODE (BEGIN)
let liveFetchLock = false;
let liveFxTimer = null;
let liveStTimer = null;

function setLiveTimers(on) {
  clearInterval(liveFxTimer);
  clearInterval(liveStTimer);
  liveFxTimer = null;
  liveStTimer = null;

  if (on) {
    // pierwszy tick
    refreshStocksFromApi();
    refreshFxFromApi();
    // cyklicznie (łagodniej dla limitów)
    liveStTimer = setInterval(() => refreshStocksFromApi(), 45_000);
    liveFxTimer = setInterval(() => refreshFxFromApi(),    70_000);
  }
}

// ==== OFFLINE FX SIMULATION ====
function simulateFxOfflineTick() {
  if (app.liveMode) return;
  const next = { ...baseFx, PLN: 1 };
  ISO.forEach(code => {
    if (code === "PLN" || code === "USD") return;
    const v = Number(next[code]);
    if (!Number.isFinite(v) || v <= 0) return;
    const drift = 1 + (Math.random() - 0.5) * 0.005; // ±0.25%
    next[code] = Number((v * drift).toFixed(5));
  });
  baseFx = next;
  const fxSearchEl = document.getElementById("fxSearch");
  renderFxList((fxSearchEl && fxSearchEl.value) || "");
  renderPortfolioFx(); renderJars(); renderProfits();
  renderGlobalTrends(currentTrendsMode);
}
setInterval(simulateFxOfflineTick, 3000);

function syncLiveToggleUI() {
  const t = document.getElementById('liveModeToggle');
  const l = document.getElementById('liveModeLabel');
  const s = document.getElementById('liveStatus');
  if (t) t.checked = !!app.liveMode;
  if (l) l.textContent = app.liveMode ? TT().live : TT().sim;
  if (s) s.textContent = app.liveMode ? TT().apiConn : TT().apiNot;
}

// --- Self-test łączności ---
async function liveSelfTest() {
  const s = document.getElementById('liveStatus');
  const q = "AAPL,MSFT";

  async function ping(url, name) {
    const started = Date.now();
    try {
      const r = await fetch(url, { headers: { "Accept": "application/json" } });
      return { ok: r.ok, code: r.status, ms: Date.now() - started, name };
    } catch {
      return { ok: false, code: "ERR", ms: Date.now() - started, name };
    }
  }

const proxyUrl = `${PROXY}/yahoo/quote?symbols=${encodeURIComponent(q)}`;
const fxUrl    = `${PROXY}/fx/latest?base=USD&places=6`;

  const [proxy, fx] = await Promise.all([ ping(proxyUrl, "Proxy"), ping(fxUrl, "FXhost") ]);
  const ok = (proxy.ok && fx.ok);

  if (s) s.textContent = `API self-test: ${proxy.ok ? "✅" : "❌"} Proxy(${proxy.code}) • ${fx.ok ? "✅" : "❌"} FXhost(${fx.code})`;
  window.__lastSelfTest = { proxy, fx, ok, route: proxy.ok ? 'proxy' : 'offline' };
  return window.__lastSelfTest;
}

// --- Force refresh ---
async function forceLiveRefresh() {
  if (liveFetchLock) return false;
  liveFetchLock = true;

  const s = document.getElementById('liveStatus');
  if (s) s.textContent = TT().apiConn;

  try {
    let st = null, okNet = false;
    try { st = await liveSelfTest(); okNet = !!st.ok; } catch { okNet = false; }

    const [fxRes, stRes] = await Promise.allSettled([ refreshFxFromApi(), refreshStocksFromApi() ]);
    const fxOk = (fxRes.status === 'fulfilled' && fxRes.value === true);
    const stOk = (stRes.status === 'fulfilled' && stRes.value === true);

    let route = 'offline';
    if (st) {
      const proxyOk  = !!st.proxy?.ok;
      route = proxyOk ? 'proxy' : 'offline';
    }

    const rateLimited = window.__yahooCooldownUntil && Date.now() < window.__yahooCooldownUntil;
    const suffix = rateLimited ? ' • rate-limited – slowing down' : '';

    if (s) {
      s.textContent = `API: ${fxOk ? TT().fxOk : TT().fxFail} • ${stOk ? TT().stOk : TT().stFail}${suffix} (via ${route})`;
    }
    return (fxOk || stOk);
  } finally {
    liveFetchLock = false;
    renderGlobalTrends(currentTrendsMode);
  }
}

// --- Update UI + timery ---
function updateLiveUI(forceFetch = false) {
  const l = document.getElementById('liveModeLabel');
  const s = document.getElementById('liveStatus');
  if (l) l.textContent = app.liveMode ? TT().live : TT().sim;
  if (s) s.textContent = app.liveMode ? TT().apiConn : TT().apiNot;

  renderStocks(document.getElementById('stockSearch')?.value || "");
  renderFxList(document.getElementById('fxSearch')?.value || "");
  renderPortfolioStocks();
  renderPortfolioFx();
  renderJars(); renderProfits();
  renderGlobalTrends(currentTrendsMode);

  setLiveTimers(app.liveMode);
  if (app.liveMode && forceFetch) forceLiveRefresh();
}

// --- Toggle + watchdog ---
function wireLiveToggleOnce() {
  const node  = document.getElementById('liveModeToggle');
  const label = document.getElementById('liveModeLabel');

  function applyToggle(nextVal) {
    app.liveMode = !!nextVal; save(app);

    if (typeof clearTrendsAll === 'function') clearTrendsAll();
    lastFxUiPrice = null; lastStockUiPrice = null;

    // zasiej PRICE_HUB przy starcie
    (function seedHubFromLocal(){
      const ch = activeChild();
      if (!ch || !window.PRICE_HUB || typeof PRICE_HUB.set !== 'function') return;
      (ch.stocks || []).forEach(s => {
        const v = Number(s?.p);
        if (Number.isFinite(v) && v > 0) PRICE_HUB.set(s.t, v);
      });
    })();

    updateLiveUI(true);
    toast(app.liveMode ? 'Live ON' : 'Live OFF');
  }

  if (node && !node._wired) {
    node.addEventListener('change', () => applyToggle(node.checked));
    node._wired = true;
  }
  if (label && !label._wired) {
    label.addEventListener('click', () => {
      const t = document.getElementById('liveModeToggle');
      const next = !(t?.checked);
      if (t) t.checked = next;
      applyToggle(next);
    });
    label._wired = true;
  }
}

(function initLive(){
  syncLiveToggleUI(); wireLiveToggleOnce();
  setTimeout(wireLiveToggleOnce, 0);
  setTimeout(wireLiveToggleOnce, 1000);
  updateLiveUI(false);
  if (app.liveMode) forceLiveRefresh();
})();

document.addEventListener('visibilitychange', () => {
  if (!app.liveMode) return;
  const s = document.getElementById('liveStatus');
  if (document.hidden) {
    setLiveTimers(false);
    if (s) s.textContent = 'API: paused (tab hidden)';
  } else {
    setLiveTimers(true);
    if (s) s.textContent = TT().apiConn;
    forceLiveRefresh();
  }
});
// ====== LIVE MODE (END)


// ====== LIVE DATA FETCHERS (BEGIN)

// --- YAHOO (proxy-first) + cooldown + bezpieczny parser ---
async function yahooQuote(symbolsArr) {
  const CHUNK = 3;              // ile tickerów na jedno zapytanie
  const SLEEP_MS = 2300;        // przerwa między chunkami
  const MAX_CD_MS = 10 * 60 * 1000; // maks. cooldown po 429
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function pickPrice(q) {
    const cand = [q?.regularMarketPrice, q?.postMarketPrice, q?.preMarketPrice, q?.bid, q?.ask];
    for (const v of cand) if (typeof v === "number" && isFinite(v)) return Number(v);
    return null;
  }

  // cooldown – jeśli aktywny, zwróć „pusty” wynik, ale z flagą rate-limited
  if (window.__yahooCooldownUntil && Date.now() < window.__yahooCooldownUntil) {
    const arr = []; arr._pickPrice = pickPrice; arr._rateLimited = true; return arr;
  }

  async function safeJson(r) {
    try { return await r.json(); } catch { return JSON.parse(await r.text()); }
  }

  async function fetchList(symbolsCsv) {
    const url = `${PROXY}/yahoo/quote?symbols=${encodeURIComponent(symbolsCsv)}&nocache=${Date.now()}`;
    try {
      const r = await fetch(url, { headers: { "Accept": "application/json" }, cache: "no-store" });
      if (r.status === 429) {
        const prev = window.__yahooCooldownSecs || 90;
        const next = Math.min(prev * 2, Math.floor(MAX_CD_MS / 1000));
        window.__yahooCooldownSecs  = next;
        window.__yahooCooldownUntil = Date.now() + next * 1000;
        return { list: [], rateLimited: true };
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await safeJson(r);
      return { list: j?.quoteResponse?.result || [], rateLimited: false };
    } catch (e) {
      console.warn("[yahooQuote] fetch fail (network?)", e);
      // potraktuj jak cooldown — nie zamrażaj UI
      const prev = window.__yahooCooldownSecs || 90;
      const next = Math.min(prev * 2, Math.floor(MAX_CD_MS / 1000));
      window.__yahooCooldownSecs  = next;
      window.__yahooCooldownUntil = Date.now() + next * 1000;
      return { list: [], rateLimited: true };
    }
  }

  // unikalizacja i dzielenie na chunki
  const uniq = Array.from(new Set((symbolsArr || []).map(s => String(s || "").trim()).filter(Boolean)));
  const chunks = [];
  for (let i = 0; i < uniq.length; i += CHUNK) chunks.push(uniq.slice(i, i + CHUNK));

  // pobieranie
  const out = []; let anyRL = false;
  for (const c of chunks) {
    const { list, rateLimited } = await fetchList(c.join(","));
    if (rateLimited) { anyRL = true; break; }
    if (list?.length) out.push(...list);
    await sleep(SLEEP_MS);
  }

  out._pickPrice   = pickPrice;
  out._rateLimited = anyRL;
  return out;
}

// --- FX FETCHER (z obejściem 400 i fallbackami) ---
async function refreshFxFromApi() {
  try {
    const next = { PLN: 1 };

    // lista walut: z ISO (obcięcie np. „:1”) albo domyślna
    const isoList = Array.isArray(ISO) && ISO.length
      ? ISO.map(s => String(s).replace(/:.*$/, ''))
      : ['USD','EUR','PLN','GBP','JPY','CHF','AUD','CAD','NZD'];

    async function fetchFxBaseUsd(symbolsCsvOrNull) {
      const fxUrl = symbolsCsvOrNull
        ? `${PROXY}/fx/latest?base=USD&places=6&symbols=${encodeURIComponent(symbolsCsvOrNull)}`
        : `${PROXY}/fx/latest?base=USD&places=6`;
      const r = await fetch(fxUrl, { headers: { "Accept": "application/json" }, cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json().catch(async () => JSON.parse(await r.text()));
    }

    // 1) próbuj z symbols, a jeśli (np. 400) → bez symbols
    let fx;
    try { fx = await fetchFxBaseUsd(isoList.join(',')); }
    catch (e) {
      console.warn("[FXhost via PROXY] symbols failed, retrying without symbols", e);
      fx = await fetchFxBaseUsd(null);
    }

    const rates = fx?.rates || null;
    const pln_per_usd = Number(rates?.PLN);
    if (Number.isFinite(pln_per_usd) && pln_per_usd > 0) {
      next.USD = +pln_per_usd.toFixed(5);
      isoList.forEach(code => {
        if (code === "PLN") return;
        const val = Number(rates?.[code]);
        if (Number.isFinite(val) && val > 0) next[code] = +((pln_per_usd / val).toFixed(5));
      });
    }

    // 2) Yahoo uzupełnia braki (np. EURPLN=X)
    const missing = isoList.filter(c => c !== "PLN" && !Number.isFinite(next[c]));
    if (missing.length) {
      const items = await yahooQuote(missing.map(c => `${c}PLN=X`));
      const pick  = items._pickPrice;
      items.forEach(q => {
        const m  = String(q?.symbol || "").match(/^([A-Z]{3})PLN=X$/);
        const px = Number(pick(q));
        if (m && Number.isFinite(px) && px > 0) next[m[1]] = +px.toFixed(5);
      });
    }

    // 3) fallback dla USD przez base=PLN
    if (!Number.isFinite(next.USD) || next.USD <= 0) {
      const urls = [
        `${PROXY}/fx/latest?base=PLN&places=6&symbols=USD`,
        // awaryjnie przez r.jina.ai (gdyby PROXY padł, a CSP na to pozwala)
        `https://r.jina.ai/http://api.exchangerate.host/latest?base=PLN&places=6&symbols=USD`
      ];
      for (const u of urls) {
        try {
          const r = await fetch(u, { headers: { "Accept": "application/json" }, cache: "no-store" });
          if (!r.ok) continue;
          const j = await r.json().catch(async () => JSON.parse(await r.text()));
          const usd_per_pln = Number(j?.rates?.USD);
          if (usd_per_pln > 0) { next.USD = +(1 / usd_per_pln).toFixed(5); break; }
        } catch {}
      }
    }

    // domknięcie luk poprzednią mapą
    isoList.forEach(c => {
      if (c !== "PLN" && (!Number.isFinite(next[c]) || next[c] <= 0)) {
        const prev = baseFx?.[c];
        if (Number.isFinite(prev) && prev > 0) next[c] = prev;
      }
    });

    // bezpiecznik USD
    if (!Number.isFinite(next.USD) || next.USD <= 0) next.USD = baseFx?.USD > 0 ? baseFx.USD : 4.00;

    baseFx = next;
    renderFxList(document.getElementById("fxSearch")?.value || "");
    renderPortfolioFx(); renderJars(); renderProfits();
    renderGlobalTrends(currentTrendsMode);
    return true;
  } catch (e) {
    console.warn("[refreshFxFromApi] fatal", e);
    return false;
  }
}

// --- STOCKS FETCHER ---
async function refreshStocksFromApi() {
  try {
    const ch = activeChild(); if (!ch) return false;

    const list = await yahooQuote((ch.stocks || []).map(s => mapToYahooSafe(s.t)));
    const pick = list._pickPrice;

    const onCD = window.__yahooCooldownUntil && Date.now() < window.__yahooCooldownUntil;
    if (!list?.length) return (onCD || list._rateLimited) ? true : false;

    const bySym = {};
    list.forEach(q => { bySym[String(q.symbol).toUpperCase()] = q; });

    ch.stocks = ch.stocks.map(s => {
      const q = bySym[String(mapToYahooSafe(s.t)).toUpperCase()];
      const v = Number(pick(q));
      if (Number.isFinite(v)) {
        if (window.PRICE_HUB && typeof PRICE_HUB.set === 'function') PRICE_HUB.set(s.t, v);
        return { ...s, p: v };
      }
      return s;
    });

    save(app);
    renderStocks(document.getElementById("stockSearch")?.value || "");
    renderPortfolioStocks(); renderJars(); renderProfits();
    renderGlobalTrends(currentTrendsMode);
    return true;
  } catch (e) {
    console.warn("[refreshStocksFromApi] fatal", e);
    return false;
  }
}

// ====== LIVE DATA FETCHERS (END)




// ====== CHART SERIES (Yahoo `chart` przez proxy, z fallbackiem) ======
async function seriesFor(symbolOrPair, rangeLabel, isFx){
  // Mapuj zakresy na range/interval Yahoo
  const MAP = { '1D':['1d','5m'], '5D':['5d','15m'], '1M':['1mo','1d'],
                '6M':['6mo','1d'], 'YTD':['ytd','1d'], '1Y':['1y','1d'] };
  const L = String(rangeLabel||'1D').toUpperCase();
  const [range, interval] = MAP[L] || MAP['1D'];

  const key = isFx
    ? String(symbolOrPair).replace('/','') + '=X'   // EUR/PLN -> EURPLN=X
    : String(symbolOrPair).toUpperCase();

  const url = `https://r.jina.ai/http://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(key)}?range=${range}&interval=${interval}`;

  try {
    const r = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!r.ok) throw new Error('HTTP '+r.status);
    const j = await r.json();
    const res = j?.chart?.result?.[0];
    const ts = (res?.timestamp || []).map(t => t*1000);
    const cl = (res?.indicators?.quote?.[0]?.close || []).map(Number);
    return { dates: ts, closes: cl };
  } catch (e) {
    console.warn("[seriesFor] Yahoo chart fail, using fallback", e);
    // fallback syntetyczny – żeby sparkline'y zawsze żyły
    const span = (function(){ if (L==='1D') return {n:288,step:300000};
      if (L==='5D') return {n:2016,step:300000};
      if (L==='1M') return {n:22,step:86400000};
      if (L==='6M') return {n:26,step:604800000};
      if (L==='YTD'||L==='1Y') return {n:52,step:604800000};
      return {n:288,step:300000}; })();
    const start = 40 + (Math.random()*360|0);
    const dates = Array.from({length:span.n}, (_,i)=> Date.now()-span.n*span.step + i*span.step);
    const closes = Array.from({length:span.n}, (_,i)=> +(start*(1+0.0006*i + (Math.random()-0.5)*0.02)).toFixed(4));
    return { dates, closes };
  }
}



// ====== SIMULATIONS (offline) ======
setInterval(() => {
  if (app.liveMode) return;
  Object.values(app.children).forEach(ch => {
    ch.stocks = ch.stocks.map(s => {
      const drift = 1 + (Math.random() - 0.5) * 0.01;
      const np = clamp(s.p * drift, 1, 9999);
      return { ...s, p: Number(np.toFixed(2)) };
    });
  });
  save(app);
 if (!__qtyTyping) {
  renderStocks(stockSearch?.value || "");
  renderPortfolioStocks();
  renderJars();
  renderProfits();
  renderBasketStocks();   // ⬅️ NEW
  renderBasketFx();       // ⬅️ NEW
}

}, 2000);

// Odświeżaj Global Trends
setInterval(() => { renderGlobalTrends(currentTrendsMode); }, app.liveMode ? 20000 : 5000);

// ====== AUTH ======
let appAuth = loadAuth();
function loadAuth() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || { role: 'guest' }; }
  catch { return { role: 'guest' }; }
}
function saveAuth(a) { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); }
function isParent() { return appAuth.role === 'parent'; }
function isChild() { return appAuth.role === 'child'; }
function isGuest() { return appAuth.role === 'guest'; }

const authBadge = document.getElementById('authBadge');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginModal = document.getElementById('loginModal');
const loginSubmit = document.getElementById('loginSubmit');
const loginCancel = document.getElementById('loginCancel');
const roleRadios = document.querySelectorAll('input[name="role"]');
const childFields = document.getElementById('childFields');
const parentFields = document.getElementById('parentFields');
const loginChild = document.getElementById('loginChild');
const loginPin = document.getElementById('loginPin');
const parentTabBtn = document.querySelector('button[data-tab="parent"]');
const parentSection = document.getElementById('tab-parent');
const tBtnLoginTop = document.getElementById('t-btnLoginTop');
const tBtnLogoutTop = document.getElementById('t-btnLogout');

// === App title (nagłówek/logotyp tekstowy) ===
const appTitleEl = document.querySelector('#t-appTitle, #appTitle, .brand-title') // <div id="appTitle"></div> w HTML

function fillLoginChildSelector() {
  if (!loginChild) return;
  loginChild.innerHTML = '';
  (app.childrenOrder || []).forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = app.children[id]?.name || 'Child';
    if (id === app.activeChildId) opt.selected = true;
    loginChild.appendChild(opt);
  });
}
function openLogin() {
  fillLoginChildSelector();
  childFields && childFields.classList.remove('hidden');
  parentFields && parentFields.classList.add('hidden');
  roleRadios.forEach(r => r.checked = (r.value === 'child'));
  loginPin && (loginPin.value = '');
  loginModal && loginModal.classList.remove('hidden');
  refreshAuthI18n();
}
function closeLogin() { loginModal && loginModal.classList.add('hidden'); }

function applyAuthUI() {
  // --- NEW: ustaw body[data-role] dla CSS (child: ukrycie placeholderów pod słoikami) ---
  document.body.dataset.role = appAuth?.role || 'guest';

  // --- NEW: ustaw tytuł aplikacji zależnie od roli ---
  if (appTitleEl) {
    if (isChild()) {
      appTitleEl.textContent = "Money Flow Kids";
    } else if (isParent()) {
      appTitleEl.textContent = "Money Flow";
    } else {
      appTitleEl.textContent = "Money Flow";
    }
  }

  const tr = TT();
  if (isParent()) {
    authBadge && (authBadge.textContent = tr.badgeParent || "Parent");
    loginBtn && loginBtn.classList.add('hidden');
    logoutBtn && logoutBtn.classList.remove('hidden');
  } else if (isChild()) {
    const ch = activeChild();
    const label = (tr.badgeChild ? tr.badgeChild(ch?.name || "") : `Child: ${ch?.name || ""}`);
    if (authBadge) authBadge.textContent = label;
    if (loginBtn)  loginBtn.classList.add('hidden');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
  } else {
    authBadge && (authBadge.textContent = tr.badgeGuest || "Guest");
    loginBtn && loginBtn.classList.remove('hidden');
    logoutBtn && logoutBtn.classList.add('hidden');
  }

  if (isParent()) {
    parentTabBtn && parentTabBtn.classList.remove('hidden');
  } else {
    parentTabBtn && parentTabBtn.classList.add('hidden');
    parentSection && parentSection.classList.add('hidden');
    const activeTab = document.querySelector('.tab.active');
    if (activeTab && activeTab.dataset.tab === 'parent') {
      document.querySelector('button[data-tab="invest"]')?.click();
    }
  }
  const hideForNonParent = !isParent();
  const dataModeCard = getDataModeSection();
  setHidden(addChildBtn, hideForNonParent);
  setHidden(addAllowanceBtn, hideForNonParent);
  setHidden(dataModeCard, hideForNonParent);
  document.querySelectorAll('[data-add]').forEach(b => setHidden(b, hideForNonParent));
  document.querySelectorAll('.role-parent-only').forEach(el => setHidden(el, hideForNonParent));
}
function refreshAuthI18n() { applyAuthUI(); }

// --- NEW: jednorazowe wywołanie, by data-role było ustawione od startu ---
applyAuthUI();


loginBtn?.addEventListener('click', openLogin);
loginCancel?.addEventListener('click', closeLogin);

roleRadios.forEach(r => {
  r.addEventListener('change', () => {
    const role = [...roleRadios].find(x => x.checked)?.value;
    if (role === 'parent') {
      childFields && childFields.classList.add('hidden');
      parentFields && parentFields.classList.remove('hidden');
    } else {
      parentFields && parentFields.classList.add('hidden');
      childFields && childFields.classList.remove('hidden');
    }
  });
});

loginSubmit?.addEventListener('click', () => {
  const role = [...roleRadios].find(x => x.checked)?.value;
  try {
    if (role === 'parent') {
      const pin = (loginPin?.value || '').trim();
      verifyPin(app, pin);
      appAuth = { role: 'parent' };
      saveAuth(appAuth);
      closeLogin();
      applyAuthUI();
      toast('Logged in as Parent');
    } else {
      const kidId = loginChild?.value || app.activeChildId;
      if (!kidId) { alert('No child in the list. Add a child as Parent.'); return; }
      app.activeChildId = kidId; save(app);
      appAuth = { role: 'child', childId: kidId }; saveAuth(appAuth);
      closeLogin(); renderAll(); applyAuthUI(); toast('Logged in as Child');
    }
  } catch (err) { alert(err?.message || 'Login error'); }
});

logoutBtn?.addEventListener('click', () => {
  if (isParent()) {
    // Rodzic -> przełącz na aktywne dziecko (jak było)
    const kidId = app.activeChildId || (app.childrenOrder?.[0] || null);
    if (kidId) {
      app.activeChildId = kidId;
      save(app);
      appAuth = { role: 'child', childId: kidId };
      saveAuth(appAuth);
      if (document.querySelector('.tab.active')?.dataset.tab === 'parent') {
        document.querySelector('button[data-tab="invest"]')?.click();
      }
      renderAll();
      const name = app.children?.[kidId]?.name || '';
      toast(TT().badgeChild ? TT().badgeChild(name) : `Child: ${name}`);
    } else {
      appAuth = { role: 'guest' };
      saveAuth(appAuth);
      applyAuthUI();
      toast('Logged out');
    }
  } else if (isChild()) {
    // Dziecko -> pokaż modala logowania z rolą Parent (nie przechodź do Guest)
    try {
      // ustaw radio „parent” i pola PIN
      roleRadios.forEach(r => (r.checked = r.value === 'parent'));
      childFields && childFields.classList.add('hidden');
      parentFields && parentFields.classList.remove('hidden');
      loginPin && (loginPin.value = '');
      fillLoginChildSelector(); // dla porządku – choć Parent nie używa listy
      loginModal && loginModal.classList.remove('hidden');
      refreshAuthI18n();
      // Uwaga: rola zostaje „child”, dopóki użytkownik nie poda poprawnego PINu w submit
    } catch {
      // awaryjnie, gdyby czegoś brakło w DOM – zostaw stare zachowanie
      appAuth = { role: 'guest' };
      saveAuth(appAuth);
      applyAuthUI();
      toast('Logged out');
    }
  } else {
    // Guest -> bez zmian
    appAuth = { role: 'guest' };
    saveAuth(appAuth);
    applyAuthUI();
    toast('Logged out');
  }
});


document.getElementById('addChildBtn')?.addEventListener('click', () => setTimeout(fillLoginChildSelector, 200));
document.getElementById('langSelect')?.addEventListener('change', () => setTimeout(refreshAuthI18n, 0));

function renderAll() {
  refreshStaticI18n();
  renderChildSelector();
  renderJars();
  renderAvailableCash();
  renderMiniJars();  // ⬅️ DODANE
  renderStocks(document.getElementById('stockSearch')?.value || "");
  renderPortfolioStocks();
  renderFxList(document.getElementById('fxSearch')?.value || "");
  renderPortfolioFx();
  renderProfits();
  renderLedger();
  applyAuthUI();
  updateGlobalTrendsForTab(document.querySelector('.tab.active')?.dataset.tab || 'invest');
}



// ===== Parent PIN – storage key =====
const PIN_KEY = "kidmoney_parent_pin_v1";

// Keep only digits in PIN inputs
function km_onlyDigits(e) { e.target.value = e.target.value.replace(/\D/g, ''); }
// Toggle eye (show/hide)
function km_toggleEye(inputId, eyeId) {
  const inp = document.getElementById(inputId);
  const btn = document.getElementById(eyeId);
  if (!inp || !btn) return;
  inp.type = (inp.type === "password") ? "text" : "password";
  btn.textContent = (inp.type === "password") ? "👁️" : "🙈";
}
// Save PIN with validation
function km_saveParentPin() {
  const msg = document.getElementById("pinMsg");
  const p1 = (document.getElementById("pin1")?.value || "").trim();
  const p2 = (document.getElementById("pin2")?.value || "").trim();
  if (p1.length < 4 || p1.length > 6) { msg.textContent = "PIN must be 4–6 digits."; msg.dataset.state = "error"; return; }
  if (p1 !== p2) { msg.textContent = "PINs do not match."; msg.dataset.state = "error"; return; }
  localStorage.setItem(PIN_KEY, p1);
  msg.textContent = "✅ PIN saved."; msg.dataset.state = "ok";
  const i1 = document.getElementById("pin1"); const i2 = document.getElementById("pin2");
  if (i1) i1.value = ""; if (i2) i2.value = "";
}
// Helper to read PIN elsewhere
function getParentPin() { return localStorage.getItem(PIN_KEY) || ""; }

// ---- Wire up events once DOM is ready ----
(function km_initPinUI() {
  const p1 = document.getElementById("pin1");
  const p2 = document.getElementById("pin2");
  const eye1 = document.getElementById("pin1Eye");
  const eye2 = document.getElementById("pin2Eye");
  const save = document.getElementById("savePinBtn");
  if (p1) p1.addEventListener("input", km_onlyDigits);
  if (p2) p2.addEventListener("input", km_onlyDigits);
  if (eye1) eye1.addEventListener("click", () => km_toggleEye("pin1", "pin1Eye"));
  if (eye2) eye2.addEventListener("click", () => km_toggleEye("pin2", "pin2Eye"));
  if (save) save.addEventListener("click", km_saveParentPin);
})();
// ===== Watchdog – dopina eventy gdy poprzedni błąd je uciął =====
setTimeout(() => {
  const tb = document.getElementById("tutorialBtn");
  if (tb && !tb._wired) { tb.addEventListener("click", () => openTutorial(true)); tb._wired = true; }

  const lb = document.getElementById("loginBtn");
  if (lb && !lb._wired) { lb.addEventListener("click", openLogin); lb._wired = true; }
 
}

, 0);
// ==== REMOVE "Max" buttons from Stock & FX tables ====
document.addEventListener('DOMContentLoaded', () => {
  document
    .querySelectorAll('[data-sell-max], [data-fxmax]')
    .forEach(btn => btn.remove());
});

// dodatkowo przy każdym rerenderze (po klikach) – obserwator
const observer = new MutationObserver(() => {
  document
    .querySelectorAll('[data-sell-max], [data-fxmax]')
    .forEach(btn => btn.remove());
});
observer.observe(document.body, { childList: true, subtree: true });




/* === YouTube mini-player wiring === */
(function () {
  const ytMini   = document.getElementById('ytMini');
  const iframe   = document.getElementById('ytFrame');
  if (!ytMini || !iframe) return;

  const openers  = [document.getElementById('tutorialBtn'), document.getElementById('drawerTutorial')].filter(Boolean);
  const btnClose = document.getElementById('ytClose');
  const btnSize  = document.getElementById('ytToggleSize');

  // Wersja nocookie + playsinline (ważne na iOS/Android)
  const YT_URL = "https://www.youtube-nocookie.com/embed/eIpCd1wRhYE?rel=0&modestbranding=1&playsinline=1";
  iframe.setAttribute('data-src', YT_URL);

  function openMini() {
    ytMini.classList.remove('hidden');
    if (!iframe.src) iframe.src = iframe.dataset.src; // lazy init
  }
  function closeMini() {
    ytMini.classList.add('hidden');
    const tmp = iframe.src;
    iframe.src = '';
    setTimeout(() => { iframe.src = iframe.dataset.src; }, 0);
  }
  function toggleSize() {
    ytMini.classList.toggle('expanded');
  }

  // Proste handlery — bez żadnych „blokad” klików
  openers.forEach(btn => btn && btn.addEventListener('click', (e) => {
    e.preventDefault(); openMini();
  }));
  btnClose && btnClose.addEventListener('click', (e) => { e.preventDefault(); closeMini(); });
  btnSize  && btnSize.addEventListener('click',  (e) => { e.preventDefault(); toggleSize(); });

  // ESC zamyka
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !ytMini.classList.contains('hidden')) closeMini();
  });

  // Dodatkowa korekta safe-area przy zmianie rozmiaru
  function safeAreaFix() {
    ytMini.style.bottom = `calc(12px + env(safe-area-inset-bottom, 0px))`;
    ytMini.style.right  = `calc(12px + env(safe-area-inset-right, 0px))`;
  }
  safeAreaFix();
  window.addEventListener('resize', safeAreaFix, { passive: true });
})();

// === Auto-start tutorial video przy pierwszym uruchomieniu ===
document.addEventListener("DOMContentLoaded", () => {
  const mini = document.getElementById("ytMini");
  const frame = document.getElementById("ytFrame");
  if (!mini || !frame) return;

  // Sprawdź, czy użytkownik już oglądał
  const seen = localStorage.getItem("tutorialSeen");

  if (!seen) {
    // Pierwsze uruchomienie → pokaż mini-player
    mini.classList.remove("hidden");

    // Zapisz, że już wyświetlono tutorial
    localStorage.setItem("tutorialSeen", "1");
  }
});
// === SORT: globalny kierunek + togglery ===
window.__sortStocksDir = window.__sortStocksDir || null; // 'asc' | 'desc' | null
window.__sortFxDir     = window.__sortFxDir     || null;

function setSortState(btn, dir){
  if (!btn) return;
  btn.dataset.dir = dir;
  btn.classList.toggle('desc', dir === 'desc');
  btn.setAttribute('aria-label', dir==='desc' ? 'Sort: highest to lowest' : 'Sort: lowest to highest');
}

function toggleStocksSort(){
  const btn  = document.querySelector('#stockControls .maxprice-filter .sort');
  const next = (btn?.dataset.dir === 'desc') ? 'asc' : 'desc';
  window.__sortStocksDir = next;
  setSortState(btn, next);
  renderStocks(document.getElementById('stockSearch')?.value || "");
}

function toggleFxSort(){
  const btn  = document.querySelector('#fxControls .maxprice-filter .sort');
  const next = (btn?.dataset.dir === 'desc') ? 'asc' : 'desc';
  window.__sortFxDir = next;
  setSortState(btn, next);
  renderFxList(document.getElementById('fxSearch')?.value || "");
}


window.addEventListener('DOMContentLoaded', () => {
  // 1) Podłącz kliki (po załadowaniu DOM)
  const sBtn = document.querySelector('#stockControls .maxprice-filter .sort');
  const fBtn = document.querySelector('#fxControls .maxprice-filter .sort');

  if (sBtn && !sBtn._wired) {
    sBtn._wired = true;
    sBtn.addEventListener('click', (e)=>{ e.preventDefault(); toggleStocksSort(); });
  }
  if (fBtn && !fBtn._wired) {
    fBtn._wired = true;
    fBtn.addEventListener('click', (e)=>{ e.preventDefault(); toggleFxSort(); });
  }

  // 2) Przywróć zapamiętany kierunek na przyciskach
  if (window.__sortStocksDir) setSortState(sBtn, window.__sortStocksDir);
  if (window.__sortFxDir)     setSortState(fBtn, window.__sortFxDir);

  // 3) Normalny start UI
  renderAll();
});

/* ===== I18N bootstrap (safe, single-init) ===== */
(function () {
  if (window.__MFK_I18N_INIT__) return;
  window.__MFK_I18N_INIT__ = true;

  const LANG_KEY = (typeof window.LANG_KEY !== 'undefined') ? window.LANG_KEY : 'pf_lang';

  function getLang(){
    const saved = localStorage.getItem(LANG_KEY);
    return (saved === 'en' || saved === 'pl') ? saved : 'pl';
  }
  function setLang(l){ localStorage.setItem(LANG_KEY, l); }

  // Minimalny słownik — rozbudujesz wg potrzeb
  const I18N = window.I18N || {
    en: {
      "nav.kidflow": "Kid Flow",
      "nav.logout": "Parent Logout",
      "netWorth": "Net Worth",
      "quickActions": "Quick Actions",
      "jarSavings": "Savings",
      "jarSpending": "Earnings",
      "jarGiving": "Gifts",
      "jarInvest": "Investments",
      "tabStocks": "Stocks",
      "tabFx": "Currencies (FX)",
      "tabPnL": "Profits",
      "tabParent": "Parent"
    },
    pl: {
      "nav.kidflow": "Kid Flow",
      "nav.logout": "Wyloguj rodzica",
      "netWorth": "Wartość netto",
      "quickActions": "Szybkie akcje",
      "jarSavings": "Oszczędności",
      "jarSpending": "Zarobki",
      "jarGiving": "Prezenty",
      "jarInvest": "Inwestycje",
      "tabStocks": "Akcje",
      "tabFx": "Waluty (FX)",
      "tabPnL": "Zyski",
      "tabParent": "Rodzic"
    }
  };

  const CURRENCY_NAMES = window.CURRENCY_NAMES || {
    en: { PLN: "Polish Złoty", USD: "US Dollar", EUR: "Euro", GBP: "British Pound" },
    pl: { PLN: "Polski złoty", USD: "Dolar amerykański", EUR: "Euro", GBP: "Funt brytyjski" }
  };

  let CURRENT_LOCALE = 'pl-PL';

  function applyLang(){
    const l = getLang();

    document.documentElement.lang = l;

    // Zsynchronizuj oba przełączniki
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.textContent = l.toUpperCase();

    const sel = document.getElementById('langSelect');
    if (sel && sel.value !== l) sel.value = l;

    CURRENT_LOCALE = (l === 'en') ? 'en-US' : 'pl-PL';

    // Teksty z data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const dict = I18N[l] || {};
      if (dict[key]) el.textContent = dict[key];
    });

    // Nazwy walut po pełnej nazwie (opcjonalnie)
    document.querySelectorAll('[data-currency]').forEach(el => {
      const code = el.getAttribute('data-currency');
      const names = CURRENCY_NAMES[l] || {};
      if (names[code]) el.textContent = names[code];
    });

    // Jeżeli masz centralny rerender — odśwież wszystko
    if (typeof window.reRenderAll === 'function') window.reRenderAll();
  }

  function toggleLang(){
    const next = getLang() === 'pl' ? 'en' : 'pl';
    setLang(next);
    applyLang();
  }

  // Udostępnij formatter jeśli jeszcze nie istnieje
  if (!window.fmtMoney) {
    window.fmtMoney = function(value, currencyCode){
      try{
        return new Intl.NumberFormat(CURRENT_LOCALE, { style: 'currency', currency: currencyCode }).format(value);
      }catch(e){
        return `${Number(value || 0).toFixed(2)} ${currencyCode}`;
      }
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Podpięcie przycisku w top-barze (mobile)
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.addEventListener('click', toggleLang);

    // Podpięcie istniejącego selecta (desktop)
    const sel = document.getElementById('langSelect');
    if (sel) {
      sel.value = getLang();
      sel.addEventListener('change', (e) => {
        setLang(e.target.value);
        applyLang();
      });
    }

    applyLang();
  });
})();
// PRZED Watchlist (ważne!)
window.baseFx = {
  PLN: 1, USD: 3.90, EUR: 4.30, GBP: 5.05, CHF: 4.35, JPY: 0.026, AUD: 2.60, CAD: 2.85,
  NOK: 0.36, SEK: 0.38, DKK: 0.58, CZK: 0.18, HUF: 0.011, UAH: 0.10, RUB: 0.045, TRY: 0.12,
  ZAR: 0.22, CNY: 0.54, HKD: 0.50, NZD: 2.35, MXN: 0.22, BRL: 0.70, ILS: 1.05, INR: 0.047,
  KRW: 0.0030, SGD: 2.90
};
// rozszerzenia (jeśli chcesz)
(function(){
  const ADD={AED:1.06,SAR:1.04,QAR:1.07,KWD:12.70,BHD:10.33,OMR:10.14,THB:0.11,PHP:0.07,MYR:0.82,TWD:0.12,RON:0.86,BGN:2.18,MAD:0.38,EGP:0.08,CLP:0.0043,COP:0.0010,ARS:0.0043,PEN:1.05};
  for(const [ccy,pln] of Object.entries(ADD)) window.baseFx[ccy]=pln;
})();
window.getFxUniverse = () => Object.keys(window.baseFx).filter(k=>/^[A-Z]{3}$/.test(k)).sort();
// (gdy doładowujesz lub zmieniasz listę)
window.dispatchEvent(new Event('fx:universe-changed'));



// ===== WATCHLIST (stocks + FX) — unified with Currency Market / World Trends =====
(() => {
  const LS_KEY = 'mfk_watchlist_v1';

  /* ---------- DOM ---------- */
  const $panel = document.querySelector('.panel.watchlist');
  const $list  = document.getElementById('wl-list');
  const $form  = document.getElementById('wl-form');
  const $pick  = document.getElementById('wl-pick');

  const $modal = document.getElementById('wl-modal');
  const $title = document.getElementById('wl-modal-title');
  const $mPrice= document.getElementById('wl-price');
  const $mChg  = document.getElementById('wl-chg');
  const $big   = document.getElementById('wl-big');

  const $wlTabs = $panel?.querySelector('.wl-tabs') || null;

  /* ---------- STATE ---------- */
  let mode   = 'stock';              // 'stock' | 'fx'
  let filter = 'stock';              // 'stock' | 'fx' | 'all'
  let watchlist = loadLS();

  function loadLS(){
    try{
      return JSON.parse(localStorage.getItem(LS_KEY)) ??
        [{type:'stock',symbol:'AAPL'},{type:'stock',symbol:'NFLX'},{type:'fx',base:'EUR',quote:'USD'}];
    }catch(_){ return []; }
  }
  function saveLS(){ localStorage.setItem(LS_KEY, JSON.stringify(watchlist)); }

  /* ---------- STOCK UNIVERSE ---------- */
  const normalizeTicker = t => String(t||'').toUpperCase().trim()
    .replace(/\s+/g,'')
    .replace(/^BRK[.\-_]B$/,'BRKB')
    .replace(/^BRK[.\-_]A$/,'BRKA');

  function stockUniverseRef(){
    if (typeof window.getStockUniverse === 'function') return window.getStockUniverse();
    if (Array.isArray(window.__stockUniverseRef))     return window.__stockUniverseRef;
    if (typeof STOCK_UNIVERSE !== 'undefined' && Array.isArray(STOCK_UNIVERSE)) return STOCK_UNIVERSE;
    return [];
  }

  /* ---------- FX UNIVERSE (1 źródło prawdy) ---------- */
  function fxUniverseFromMarket(){
    if (typeof window.getFxUniverse === 'function') {
      const arr = window.getFxUniverse();
      if (Array.isArray(arr) && arr.length) return arr.slice();
    }
    if (window.baseFx && typeof window.baseFx === 'object'){
      const keys = Object.keys(window.baseFx).filter(k=>/^[A-Z]{3}$/.test(k)).sort();
      if (keys.length) return keys;
    }
    if (Array.isArray(window.ISO) && window.ISO.length) return window.ISO.slice().sort();
    return ['USD','EUR','PLN','GBP','JPY','CHF','AUD','CAD','NZD','SEK','NOK','CZK','HUF'];
  }
  function safeQuote(){
    const q = (typeof window.fxQuote==='function') ? window.fxQuote() : 'USD';
    return String(q||'USD').toUpperCase();
  }

  function fxRate(pair){
    if (typeof window.fxRate === 'function'){
      const v = Number(window.fxRate(pair));
      if (Number.isFinite(v) && v>0) return v;
    }
    // fallback: z mapy baseFx (PLN per 1)
    const m = window.baseFx || {};
    const [b,q] = String(pair).split('/');
    const B = Number(m[String(b).toUpperCase()]);
    const Q = Number(m[String(q).toUpperCase()]);
    if (Number.isFinite(B) && Number.isFinite(Q) && Q>0) return B/Q;
    return NaN;
  }

  /* ---------- UI currency / formatting ---------- */
  function uiQuote() {
    const q = (typeof window.fxQuote === 'function') ? window.fxQuote() : 'PLN';
    return String(q || 'PLN').toUpperCase();
  }
  let CURRENT_QUOTE = uiQuote();
  const uiLocaleFor = q => (q === 'PLN' ? 'pl-PL' : 'en-US');
  function fmtMoney(v) {
    const q = CURRENT_QUOTE;
    try {
      return new Intl.NumberFormat(uiLocaleFor(q), { style:'currency', currency:q, maximumFractionDigits:2 })
        .format(Number(v||0));
    } catch {
      return Number(v||0).toLocaleString(uiLocaleFor(q), { maximumFractionDigits:2 }) + ' ' + q;
    }
  }
  const fmtPlain = (x) => Number(x ?? 0).toLocaleString(uiLocaleFor(CURRENT_QUOTE),{maximumFractionDigits:2});
  const fmtFx    = (x) => new Intl.NumberFormat(uiLocaleFor(CURRENT_QUOTE),{minimumFractionDigits:4,maximumFractionDigits:4}).format(Number(x||0));

  /* ---------- sandbox / wykresy ---------- */
  const DPR   = Math.min(2, Math.max(1, window.devicePixelRatio||1));
  const pad2  = n => String(n).padStart(2,'0');
  const WDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MONTHS= ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function seedRng(s){
    let h = 2166136261>>>0;
    for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function(){
      h += 0x6D2B79F5; let t = Math.imul(h^(h>>>15), 1|h);
      t ^= t + Math.imul(t^(t>>>7), 61|t);
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }

  function genSeries({points, stepMs, start, drift, vol, seedKey}){
    const dates=new Array(points), values=new Array(points);
    const r=seedRng(JSON.stringify({seedKey,points,stepMs,start,drift,vol}));
    let x=start, t0=Date.now()-points*stepMs;
    for(let i=0;i<points;i++){
      const shock=(r()*2-1)*vol*x;
      const trend=drift*x;
      x=Math.max(0.01, x+shock+trend);
      dates[i]=t0+i*stepMs; values[i]=+x.toFixed(4);
    }
    return {dates, values};
  }
  const span = L => {
    L = String(L||'1D').toUpperCase();
    if (L==='1D') return { points: 288,        step: 5*60*1000 };
    if (L==='5D') return { points: 288*7,      step: 5*60*1000 };
    if (L==='1M') return { points: 22,         step: 24*60*60*1000 };
    if (L==='6M') return { points: 26,         step: 7*24*60*60*1000 };
    if (L==='1Y'||L==='YTD') return { points: 52, step: 7*24*60*1000 };
    return { points: 288, step: 5*60*1000 };
  };

  function basePriceFxGuess(b,q){
    const live = fxRate(`${b}/${q}`);
    if (Number.isFinite(live) && live>0) return live;
    const m = window.baseFx || {};
    const B = Number(m[b]); const Q = Number(m[q]);
    if (Number.isFinite(B) && Number.isFinite(Q) && Q>0) return B/Q;
    return 1.0;
  }

  async function seriesFor(symbolOrPair, rangeLabel, isFx){
    const S = String(symbolOrPair||'').toUpperCase();
    const s = span(rangeLabel);
    const seedKey = `${S}:${rangeLabel}:${isFx?'FX':'STK'}`;
    if (isFx){
      const [b,q] = S.split('/');
      const start = basePriceFxGuess(b,q);
      const g = genSeries({ points:s.points, stepMs:s.step, start, drift:0.00012, vol:0.0028, seedKey });
      return { dates:g.dates, closes:g.values };
    } else {
      const start = 40 + (seedRng('STK:'+S)()*360|0);
      const g = genSeries({ points:s.points, stepMs:s.step, start, drift:0.0006, vol:0.009, seedKey });
      return { dates:g.dates, closes:g.values };
    }
  }

  /* ---------- unified spot ---------- */
  function hubSpotStock(sym, fallback){
    const HUB = window.PRICE_HUB;
    const S = String(sym||'').toUpperCase().replace(/\.US$/,'');
    const keys = [ `${S}:${CURRENT_QUOTE}`, `${S}/${CURRENT_QUOTE}`, `${S}-${CURRENT_QUOTE}`, `${S}_${CURRENT_QUOTE}`, `${S}.${CURRENT_QUOTE}`, S, `${S}.US` ];
    let v = NaN;
    if (HUB) {
      for (const k of keys){
        let raw = (typeof HUB.use==='function') ? HUB.use(k, null)
                 : (typeof HUB.get==='function') ? HUB.get(k)
                 : HUB[k];
        if (raw && typeof raw==='object') raw = raw.price ?? raw.last ?? raw.value;
        const n = Number(raw);
        if (Number.isFinite(n) && n>0){ v = n; break; }
      }
      if (Number.isFinite(v) && CURRENT_QUOTE!=='USD' && !keys.includes(S+':'+CURRENT_QUOTE)) {
        const r = fxRate(`USD/${CURRENT_QUOTE}`);
        if (Number.isFinite(r) && r>0) v = v*r;
      }
    }
    if (!Number.isFinite(v)) v = Number.isFinite(fallback) ? fallback : (40 + (seedRng('STK:'+S)()*360|0));
    return v;
  }

  function liveFx(base, quote){
    const r = fxRate(`${String(base).toUpperCase()}/${String(quote).toUpperCase()}`);
    if (Number.isFinite(r) && r>0) return r;
    return NaN;
  }

  /* ---------- picker (spięty z rynkiem) ---------- */
  function fillPicker(){
    if (!$pick) return;

    if (mode === 'fx'){
      const ISO = fxUniverseFromMarket();
      const quote = safeQuote();
      const arr = ISO
        .filter(c => c!==quote && /^[A-Z]{3}$/.test(c))
        .sort()
        .map(b => `${b}/${quote}`);
      $pick.innerHTML = arr.map(v => `<option value="${v}">${v}</option>`).join('');
      return;
    }

    const rows = stockUniverseRef();
    const seen = new Set(); const out = [];
    for (const o of rows){
      const t = normalizeTicker(o?.t);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      const n = (o?.n || '').trim();
      out.push(`<option value="${t}">${t}${n ? ' — ' + n : ''}</option>`);
    }
    $pick.innerHTML = out.join('');
  }

  /* ---------- X-ticks ---------- */
  function computeXTicks(datesMs, rangeLabel){
    const out = [];
    if (!datesMs?.length) return out;
    const L = String(rangeLabel||'').toUpperCase();
    const lowerBound = (arr,x)=>{ let lo=0,hi=arr.length-1,ans=arr.length-1;
      while(lo<=hi){ const m=(lo+hi)>>1; if(arr[m]<x) lo=m+1; else { ans=m; hi=m-1; } }
      return Math.max(0,Math.min(ans,arr.length-1));
    };

    if (L==='1D'){
      const first = datesMs[0], last = datesMs.at(-1);
      const d = new Date(first); d.setMinutes(0,0,0);
      const ticks=[];
      while(d.getTime()<=last){ ticks.push(d.getTime()); d.setHours(d.getHours()+1); }
      const step=Math.max(1,Math.ceil(ticks.length/7));
      for(let i=0;i<ticks.length;i+=step){
        const t=ticks[i], idx=lowerBound(datesMs,t);
        const hh=pad2(new Date(t).getHours()), mm=pad2(new Date(t).getMinutes());
        out.push({ i: idx, lbl: `${hh}:${mm}` });
      }
      return out;
    }

    if (L === '5D') {
      const dayTicks = [];
      let lastKey = null;
      for (let i = 0; i < datesMs.length; i++) {
        const d  = new Date(datesMs[i]);
        const wd = d.getDay();
        if (wd === 0 || wd === 6) continue;
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (key !== lastKey) {
          dayTicks.push({ i, lbl: WDAYS[wd] });
          lastKey = key;
        }
      }
      return dayTicks.slice(-5);
    }

    const monthStart = (y,m)=>{ const d=new Date(y,m,1); d.setHours(0,0,0,0); return d.getTime(); };
    const ticksLastNMonths=n=>{
      const now=new Date(); const arr=[];
      for(let k=n-1;k>=0;k--){ const d=new Date(now.getFullYear(), now.getMonth()-k, 1); arr.push({ y:d.getFullYear(), m:d.getMonth(), lbl:MONTHS[d.getMonth()] }); }
      return arr;
    };
    const ticksYTD=()=>{ const now=new Date(); const arr=[]; for(let m=0;m<=now.getMonth();m++) arr.push({ y:now.getFullYear(), m, lbl:MONTHS[m] }); return arr; };
    const ticks1Y=()=>{ const arr=ticksLastNMonths(12); arr[0].lbl=`${arr[0].lbl} ${arr[0].y}`; arr.at(-1).lbl=`${arr.at(-1).lbl} ${arr.at(-1).y}`; return arr; };

    let plan=[];
    if (L==='1M')      plan = ticksLastNMonths(2).slice(-2);
    else if (L==='6M') plan = ticksLastNMonths(6);
    else if (L==='YTD')plan = ticksYTD();
    else if (L==='1Y') plan = ticks1Y();

    if (plan.length){
      for(const m of plan){
        const idx=lowerBound(datesMs, monthStart(m.y,m.m));
        out.push({ i: idx, lbl: m.lbl });
      }
      const seen=new Set(), uniq=[]; for(const t of out){ if(!seen.has(t.i)){ uniq.push(t); seen.add(t.i); } }
      return uniq;
    }
    return out;
  }

  /* ---------- rysowanie ---------- */
  function _domain(values){
    let lo=Math.min(...values), hi=Math.max(...values);
    if (lo===hi){ const pad=Math.max(1,Math.abs(hi)*0.005); lo-=pad; hi+=pad; }
    return {lo,hi};
  }
  function drawSpark(c, values){
    const cssW=c.clientWidth||c.offsetWidth||220, cssH=c.clientHeight||38;
    c.width=Math.max(220,cssW)*DPR; c.height=cssH*DPR;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height);
    if (!values||values.length<2) return;
    const {lo:min, hi:max}=_domain(values); const pad=c.height*0.18; const step=(c.width)/(values.length-1); const yy=v=>c.height-((v-min)/(max-min||1))*(c.height-pad*2)-pad;
    ctx.beginPath(); ctx.moveTo(0,yy(values[0])); values.forEach((v,i)=>ctx.lineTo(i*step,yy(v)));
    ctx.lineTo(c.width,c.height); ctx.lineTo(0,c.height); ctx.closePath();
    const up=values.at(-1)>=values[0]; const grad=ctx.createLinearGradient(0,0,0,c.height);
    if (up){ grad.addColorStop(0,"rgba(0,200,255,0.35)"); grad.addColorStop(1,"rgba(0,200,255,0.08)"); }
    else   { grad.addColorStop(0,"rgba(153,27,27,0.45)");  grad.addColorStop(1,"rgba(244,114,182,0.12)"); }
    ctx.fillStyle=grad; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0,yy(values[0])); values.forEach((v,i)=>ctx.lineTo(i*step,yy(v)));
    ctx.lineWidth=2*DPR; ctx.strokeStyle=up?"#00ff6a":"#b91c1c"; ctx.stroke();
  }
  function drawBig(c, datesMs, values, label){
    const cssW=c.clientWidth||720, cssH=280; c.width=cssW*DPR; c.height=cssH*DPR;
    const ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); if(!values||values.length<2) return;
    const left=56*DPR, right=16*DPR, top=16*DPR, bottom=44*DPR;
    const {lo:min, hi:max}=_domain(values); const w=c.width-left-right, h=c.height-top-bottom; const stepX=w/(values.length-1); const y=v=>c.height-bottom-((v-min)/(max-min||1))*h;

    ctx.strokeStyle='rgba(35,48,77,0.9)'; ctx.lineWidth=1*DPR;
    for(let i=0;i<=4;i++){ const yy=top+i*h/4; ctx.beginPath(); ctx.moveTo(left,yy); ctx.lineTo(left+w,yy); ctx.stroke(); }

    ctx.fillStyle='#9ca3af'; ctx.font=`${12*DPR}px system-ui,sans-serif`; ctx.textBaseline='middle';
    const mid=(min+max)/2;
    ctx.fillText(min.toFixed(2),8*DPR,y(min));
    ctx.fillText(mid.toFixed(2),8*DPR,y(mid));
    ctx.fillText(max.toFixed(2),8*DPR,y(max));

    const ticks=computeXTicks(datesMs,label);
    ctx.textAlign='center'; ctx.textBaseline='top';
    for(const t of ticks){
      const xx=left+t.i*stepX;
      ctx.beginPath(); ctx.moveTo(xx,top); ctx.lineTo(xx,top+h); ctx.strokeStyle='rgba(35,48,77,0.45)'; ctx.stroke();
      ctx.fillStyle='#9ca3af'; ctx.fillText(t.lbl, xx, c.height-bottom+10*DPR);
    }

    const up=values.at(-1)>=values[0];
    ctx.beginPath(); ctx.moveTo(left, y(values[0]));
    values.forEach((v,i)=> ctx.lineTo(left+i*stepX, y(v)));
    ctx.lineTo(left+w, c.height-bottom); ctx.lineTo(left, c.height-bottom); ctx.closePath();
    const grad=ctx.createLinearGradient(0,top,0,c.height-bottom);
    if(up){grad.addColorStop(0,"rgba(0,200,255,0.35)");grad.addColorStop(1,"rgba(0,200,255,0.08)");}
    else {grad.addColorStop(0,"rgba(153,27,27,0.45)");grad.addColorStop(1,"rgba(244,114,182,0.12)");}
    ctx.fillStyle=grad; ctx.fill();

    ctx.beginPath(); ctx.moveTo(left,y(values[0]));
    values.forEach((v,i)=> ctx.lineTo(left+i*stepX,y(v)));
    ctx.lineWidth=2*DPR; ctx.strokeStyle=up?"#00ff6a":"#b91c1c"; ctx.stroke();
  }

  /* ---------- cards ---------- */
  const io = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
        for (const e of entries) {
          const el = e.target;
          if (e.isIntersecting && el._wl_values && !el._wl_drawn) {
            el._wl_drawn = true;
            const c = el.querySelector('canvas.wl-spark');
            if (c) requestAnimationFrame(() => drawSpark(c, el._wl_values));
            io.unobserve(el);
          }
        }
      }, { root: null, threshold: 0.1 })
    : null;

  const hubKeyFor = (item) => {
    if (item.type==='stock') return String(item.symbol||'').toUpperCase().replace(/\.US$/,'');
    const k = `${item.base}${item.quote}`.toUpperCase();
    return [k, k+'=X'];
  };

  function applyLiveToCard(el, cur, prev){
    const p = el.querySelector('.wl-price');
    const d = el.querySelector('.wl-diff');
    if (!p || !d) return;
    const isFx = (el._wl_item?.type === 'fx');

    // ⭐ FX pokazujemy z jednostką quote (np. "4,2842 PLN")
    p.textContent = isFx
      ? `${fmtFx(cur)} ${(el._wl_item?.quote || CURRENT_QUOTE)}`
      : fmtMoney(cur);

    const ch = cur - (prev ?? cur);
    const pc = (prev && prev !== 0) ? (ch/prev)*100 : 0;
    d.textContent = `${ch>=0?'+':''}${isFx ? fmtFx(ch) : fmtPlain(ch)} (${pc.toFixed(2)}%)`;
    d.className   = 'wl-diff ' + (ch>=0 ? 'pos' : 'neg');
    el._wl_prev   = cur;
  }

  async function mountCard(item, idx){
    const el   = document.createElement('article'); el.className='wl-card'; el.setAttribute('role','listitem');
    const left = document.createElement('div');     left.className='wl-left';
    const right= document.createElement('div');     right.className='wl-right';
    const spark= document.createElement('canvas');  spark.className='wl-spark';
    const removeBtn = document.createElement('button'); removeBtn.className='wl-remove'; removeBtn.setAttribute('aria-label','Remove'); removeBtn.textContent='×';
    const t = document.createElement('div'); t.className='wl-ticker';
    const n = document.createElement('div'); n.className='wl-name';
    const p = document.createElement('div'); p.className='wl-price';
    const d = document.createElement('div'); d.className='wl-diff';

    left.appendChild(t); left.appendChild(n);
    right.appendChild(p); right.appendChild(d);
    el.appendChild(left); el.appendChild(right); el.appendChild(removeBtn); el.appendChild(spark);
    $list.appendChild(el);

    let hist;
    if (item.type==='fx'){
      t.textContent=`${item.base}/${item.quote}`; n.textContent=`FX`;
      hist=await seriesFor(`${item.base}/${item.quote}`, '1D', true);
    } else {
      t.textContent=item.symbol.toUpperCase(); n.textContent='Stock';
      hist=await seriesFor(item.symbol, '1D', false);
    }
    const vals = (hist?.closes || []).slice(-120);
    if (vals.length >= 2){
      el._wl_item     = item;
      el._wl_lastHist = vals.at(-1);
      el._wl_prev     = vals.at(-2);
      el._wl_values   = vals;
      if (io) io.observe(el); else requestAnimationFrame(() => drawSpark(spark, vals));

      const last = vals.at(-1), prev = vals.at(-2) ?? last;
      const cur  = (item.type==='fx') ? liveFx(item.base,item.quote) : hubSpotStock(item.symbol,last);
      applyLiveToCard(el, Number.isFinite(cur)&&cur>0?cur:last, prev);

      const unsub = (window.PRICE_HUB && typeof window.PRICE_HUB.subscribe==='function')
        ? window.PRICE_HUB.subscribe((key,val) => {
            const keys = hubKeyFor(item);
            const hit = Array.isArray(keys)
              ? keys.some(k => String(key).toUpperCase()===String(k).toUpperCase())
              : (String(key).toUpperCase()===String(keys).toUpperCase());
            if (!hit) return;

            let curLive = Number(val);
            if (!Number.isFinite(curLive)) return;

            if (item.type !== 'fx' && CURRENT_QUOTE !== 'USD'){
              const rfx = fxRate(`USD/${CURRENT_QUOTE}`);
              if (Number.isFinite(rfx) && rfx > 0) curLive = curLive * rfx;
            }
            const prevLive = el._wl_prev ?? curLive;
            applyLiveToCard(el, curLive, prevLive);
          })
        : null;
      el._wl_unsub = unsub;
    } else {
      p.textContent='—'; d.textContent='—';
    }

    el.addEventListener('click', ()=> openModal(item));
    removeBtn.addEventListener('click', (e)=>{ e.stopPropagation(); if (el._wl_unsub) try{el._wl_unsub();}catch{}; watchlist.splice(idx, 1); saveLS(); render(); });
  }

  function render(){
    if (!$list) return;
    $list.innerHTML='';
    watchlist
      .filter(x => filter==='all' ? true : x.type===filter)
      .forEach((item, idx) => mountCard(item, idx));
  }

  /* ---------- MODAL ---------- */
  let MODAL_SUB = null;
  const RANGE_LABELS = ['1D','5D','1M','6M','YTD','1Y'];

  function stopModalLive(){ if (MODAL_SUB){ try{MODAL_SUB();}catch{} MODAL_SUB=null; } }

  function openModal(item){
    if (!$modal) return;
    $modal.setAttribute('aria-hidden','false');
    const ttl = item.type==='fx' ? `${item.base}/${item.quote}` : item.symbol.toUpperCase();
    $title.textContent = ttl;

    const ranges = $modal.querySelectorAll('.wl-range button');
    const isFx   = (item.type === 'fx');
    const modalSeries = new Map();

    async function fetchRange(label){
      const L = (RANGE_LABELS.includes(String(label).toUpperCase()) ? String(label).toUpperCase() : '1D');
      if (modalSeries.has(L)) return modalSeries.get(L);
      const y = await seriesFor(ttl, L, isFx);
      const out = { dates: y.dates, values: y.closes, label: L };
      modalSeries.set(L, out);
      return out;
    }

    function paint(datesMs, values, label){
      if (!datesMs?.length || !values?.length){
        $mPrice.textContent='—'; $mChg.textContent='Brak danych';
        const ctx=$big.getContext('2d'); ctx.clearRect(0,0,$big.width,$big.height);
        ranges.forEach(b=> b.disabled = true);
        stopModalLive();
        return;
      }
      ranges.forEach(b=> b.disabled = false);

      const lastLive   = isFx ? liveFx(item.base,item.quote) : hubSpotStock(item.symbol, values.at(-1));
      const lastVal    = Number.isFinite(lastLive)&&lastLive>0 ? lastLive : values.at(-1);
      const prev       = values.at(-2) ?? lastVal;

      const ch = lastVal - (prev ?? lastVal);
      const pc = (prev && prev!==0) ? (ch/prev)*100 : 0;
      $mPrice.textContent = isFx ? `${fmtFx(lastVal)} ${item.quote}` : fmtMoney(lastVal);
      $mChg.textContent   = `${ch>=0?'+':''}${isFx?fmtFx(ch):fmtPlain(ch)} (${pc.toFixed(2)}%)`;
      $mChg.style.color   = ch>=0 ? 'var(--ok)' : '#b91c1c';

      drawBig($big, datesMs, values, label);

      stopModalLive();
      if (window.PRICE_HUB && typeof window.PRICE_HUB.subscribe==='function' && !isFx){
        const keys = hubKeyFor(item);
        MODAL_SUB = window.PRICE_HUB.subscribe((key,val)=>{
          const hit = Array.isArray(keys) ? keys.some(k => String(k).toUpperCase()===String(key).toUpperCase())
                                          : (String(keys).toUpperCase()===String(key).toUpperCase());
          if (!hit) return;
          let cur  = Number(val);
          if (!Number.isFinite(cur)) return;
          if (CURRENT_QUOTE !== 'USD'){
            const rfx = fxRate(`USD/${CURRENT_QUOTE}`);
            if (Number.isFinite(rfx) && rfx > 0) cur = cur * rfx;
          }
          const prev = values.at(-2) ?? cur;
          const ch   = cur - (prev ?? cur);
          const pc   = (prev && prev!==0) ? (ch/prev)*100 : 0;
          $mPrice.textContent = fmtMoney(cur);
          $mChg.textContent   = `${ch>=0?'+':''}${fmtPlain(ch)} (${pc.toFixed(2)}%)`;
          $mChg.style.color   = ch>=0 ? 'var(--ok)' : '#b91c1c';
        });
      }
    }

    async function setRange(btn){
      Array.from(ranges).forEach(b=>b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const L = (btn.dataset.range||'1D').toUpperCase();
      const {dates, values} = await fetchRange(L);
      paint(dates, values, L);
    }

    const def = $modal.querySelector('.wl-range button.is-active') ||
                $modal.querySelector('.wl-range button[data-range]') ||
                ranges[0];
    if (def) setRange(def);

    const closeModal = () => { $modal.setAttribute('aria-hidden','true'); stopModalLive(); };
    $modal?.querySelector('.wl-close')?.addEventListener('click', closeModal, { once:true });
    $modal?.querySelector('.wl-modal__backdrop')?.addEventListener('click', closeModal, { once:true });
    Array.from(ranges).forEach(btn => btn.onclick = () => setRange(btn));
  }

  /* ---------- TABS / MODE ---------- */
  function applyMode(next){
    mode = next;
    filter = next;
    fillPicker(); render();

    if ($wlTabs){
      $wlTabs.querySelectorAll('button[data-filter]').forEach(b => {
        const bf = (b.dataset.filter||'').toLowerCase();
        const on =
          (filter==='all'   && bf==='all') ||
          (filter==='stock' && (bf==='stock' || bf==='stocks' || bf==='equities')) ||
          (filter==='fx'    && (bf==='fx' || bf==='currencies' || bf==='currency'));
        b.classList.toggle('is-active', on);
      });
    }
  }

  document.querySelectorAll('[data-tab]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const t = (btn.getAttribute('data-tab')||'').toLowerCase();
      if (t==='invest' || t==='stock' || t==='stocks' || t==='tab-invest') applyMode('stock');
      if (t==='fx'     || t==='currencies' || t==='currency' || t==='tab-fx')  applyMode('fx');
    });
  });

  if ($wlTabs){
    $wlTabs.addEventListener('click', (e)=>{
      const b = e.target.closest('button[data-filter]'); if (!b) return;
      const f = (b.dataset.filter||'').toLowerCase();
      if (f==='all'){ filter='all'; fillPicker(); render(); }
      if (f==='stock' || f==='stocks' || f==='equities'){ applyMode('stock'); }
      if (f==='fx' || f==='currencies' || f==='currency'){ applyMode('fx'); }
    });
  }

  /* ---------- ADD ---------- */
  $form?.addEventListener('submit', e=>{
    e.preventDefault();
    const val = $pick?.value; if (!val) return;
    if (mode==='fx'){
      const [base, quote] = val.split('/');
      if (!base || !quote) return;
      watchlist.unshift({type:'fx', base, quote});
    } else {
      watchlist.unshift({type:'stock', symbol: val.toUpperCase()});
    }
    saveLS(); render();
  });

  /* ---------- Remap FX do aktualnego quote ---------- */
  function remapWatchlistFxTo(quote){
    const Q = String(quote||'USD').toUpperCase();
    const seen = new Set();
    watchlist = watchlist.map(it => {
      if (it.type !== 'fx') return it;
      const base = String(it.base).toUpperCase();
      if (base === Q) return it; // nie tworzymy PLN/PLN
      return { type:'fx', base, quote:Q };
    }).filter(it => {
      if (it.type !== 'fx') return true;
      const key = `${it.base}/${it.quote}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    saveLS();
  }

  /* ---------- currency/lang/universe change ---------- */
  function onQuoteChanged(){
    const next = uiQuote();
    if (!next || next === CURRENT_QUOTE) return;
    CURRENT_QUOTE = next;
    remapWatchlistFxTo(CURRENT_QUOTE);
    fillPicker();
    render();
  }
  window.addEventListener('fx:quote-changed', onQuoteChanged);
  window.addEventListener('lang:changed', onQuoteChanged);
  document.addEventListener('stock:universe', fillPicker);
  document.addEventListener('mfk:stock_universe_ready', fillPicker);
  window.addEventListener('fx:universe-changed', fillPicker);

  try{
    const mo = new MutationObserver(onQuoteChanged);
    mo.observe(document.documentElement, { attributes:true, attributeFilter:['lang','data-locale','data-currency'] });
  }catch{}

  /* ---------- RESIZE redraw ---------- */
  let _rTO=null;
  window.addEventListener('resize', () => {
    clearTimeout(_rTO);
    _rTO = setTimeout(() => {
      document.querySelectorAll('.wl-card').forEach(card=>{
        const c = card.querySelector('canvas.wl-spark');
        if (card._wl_values && c && card.getBoundingClientRect().top < window.innerHeight) {
          drawSpark(c, card._wl_values);
        }
      });
    }, 120);
  });

  /* ---------- FX live refresh ---------- */
  const pumpFx = () => {
    document.querySelectorAll('.wl-card').forEach(card => {
      const it = card._wl_item;
      if (!it || it.type!=='fx') return;
      const cur = liveFx(it.base, it.quote);
      if (!Number.isFinite(cur) || cur<=0) return;
      const prev = card._wl_prev ?? cur;
      applyLiveToCard(card, cur, prev);
    });
  };
  setInterval(pumpFx, 1500);
  window.addEventListener('fx:ticked', pumpFx);

  /* ---------- init ---------- */
  function initWL(){
    // ⭐ ważne: remap NA STARcie, jeśli LocalStorage trzyma stare /USD
    remapWatchlistFxTo(CURRENT_QUOTE);
    fillPicker();
    render();
  }
  initWL();

  // safety: zawęż select na mobile (nie wypycha +Add)
  (function fixPickerWidth(){
    const sel = document.getElementById('wl-pick');
    if (!sel) return;
    sel.style.width = '';
    sel.style.maxWidth = '100%';
    sel.style.minWidth = '0';
  })();
})();

// === MAX PRICE FILTERS: Watchlist / Stock Market / Currency Market (robust) ===
(() => {
  const CONFIG = [
    { input:'#wl-max', list:'#wl-list' },    // Watchlist
    { input:'#sm-max', list:'#stockList' },  // Stock Market
    { input:'#cm-max', list:'#fxList' }      // Currency Market
  ];

  const debounce=(fn,ms=120)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}};
  const toNum=(x)=>{ if(x==null) return NaN; const v=parseFloat(String(x).replace(/[^\d.,-]/g,'').replace(',', '.')); return Number.isFinite(v)?v:NaN; };

  // spróbuj many-ways: data-* -> element z klasą price -> pierwszy numer w treści
  function getRowPrice(row){
    // 1) dataset
    let v = row.dataset?.price ?? row.getAttribute?.('data-price') ?? row.getAttribute?.('data-last');
    if (v!=null && Number.isFinite(parseFloat(v))) return parseFloat(v);

    // 2) elementy typowo-cenowe
    const priceEl =
      row.querySelector('[data-price]') ||
      row.querySelector('[data-last]') ||
      row.querySelector('.price') ||
      row.querySelector('[class*="price"]') || // np. .price-pill, .last-price
      row.querySelector('.wl-price') ||
      row.querySelector('.row-price');

    if (priceEl){
      v = toNum(priceEl.getAttribute?.('data-price') ?? priceEl.textContent);
      if (Number.isFinite(v)) return v;
    }

    // 3) fallback: pierwszy numer w całej karcie (np. "$151.71")
    const m = (row.textContent || '').match(/[-+]?\d{1,3}(?:[ \u00A0,]\d{3})*(?:[.,]\d+)?/);
    if (m){ v = toNum(m[0]); if (Number.isFinite(v)) return v; }

    return NaN; // brak ceny -> nie ukrywamy
  }

  function applyFilter(listEl, maxVal){
    if (!listEl) return;
    // bierzemy każde bezpośrednie dziecko listy jako „wiersz/kartę”
    const rows = Array.from(listEl.children);
    for (const row of rows){
      const p = getRowPrice(row);
      const show = (!Number.isFinite(maxVal) || maxVal<=0) || (!Number.isFinite(p)) || (p <= maxVal + 1e-10);
      row.style.display = show ? '' : 'none';
    }
  }

  function wireOne({input, list}){
    const $in = document.querySelector(input);
    const $list = document.querySelector(list);
    if(!$in || !$list) return;
    const $clr = $in.parentElement?.querySelector('.clear');

    const run = ()=> {
      const v = toNum($in.value);
      applyFilter($list, Number.isFinite(v)?v:NaN);
    };
    const runDeb = debounce(run, 80);

    $in.addEventListener('input', runDeb);
    $clr && $clr.addEventListener('click', ()=>{ $in.value=''; run(); });

    // Reaplikuj po przebudowie list (JS doda/zmieni karty)
    new MutationObserver(run).observe($list, { childList:true, subtree:true });

    // Reaplikuj po globalnych eventach cen/waluty
    ['prices:updated','ui:currency-changed','watchlist:rendered','stocks:rendered','fx:rendered']
      .forEach(ev => window.addEventListener(ev, run));

    // LS
    const LS_KEY = 'mfk_max_'+input.slice(1);
    const saved = localStorage.getItem(LS_KEY);
    if (saved!=null) $in.value = saved;
    $in.addEventListener('change', ()=> localStorage.setItem(LS_KEY, $in.value || ''));

    run(); // start
  }

  CONFIG.forEach(wireOne);
})();



/* ============================================================================
 * Money Flow Kids — AI Agent v7.1 (no‑conflict)
 * Changes vs 7.0: renamed .tab -> .ai-tab, .tabpane -> .ai-pane
 * data-tab -> data-aitab, data-pane -> data-aipane
 * Everything namespaced to avoid header collisions.
 * ============================================================================ */
(() => {
  if (window.__AIAgentV71_NC__) return; window.__AIAgentV71_NC__ = true;

  /* ========== helpers ========== */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const onReady = (fn)=> (document.readyState==='loading')
    ? document.addEventListener('DOMContentLoaded', fn, {once:true})
    : fn();
  const toNum = (x)=> { if(x==null) return 0; const t=String(x).replace(/[\s\u00A0]/g,'').replace(/[^\d.,-]/g,'').replace(',', '.'); const v=parseFloat(t); return Number.isFinite(v)?v:0; };
  const getLang = ()=> {
    const sel = $("#langSelect")?.value?.toLowerCase();
    const attr = document.documentElement.getAttribute('lang') || '';
    const v = sel || attr || 'en';
    return v.startsWith('pl') ? 'pl' : 'en';
  };
  const setLang = (code) => {
    const c = (code||'en').toLowerCase();
    document.documentElement.setAttribute('lang', c);
    const sel = $("#langSelect"); if (sel) { sel.value = c; sel.dispatchEvent(new Event('change',{bubbles:true})); }
    refreshPanelLang();
  };
  const speak = (text)=>{ try{ window.speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(String(text||'')); u.lang=getLang()==='pl'?'pl-PL':'en-US'; speechSynthesis.speak(u);}catch{} };
  const stopSpeak = ()=>{ try{ window.speechSynthesis.cancel(); }catch{} };
  const getRole = () => { const t = $('#authBadge')?.textContent?.toLowerCase() || ''; return t.includes('parent') ? 'parent' : 'child'; };
  const fmtCur = (v, cur='USD') => { try { return new Intl.NumberFormat(getLang()==='pl'?'pl-PL':'en-US',{style:'currency',currency:cur}).format(v); } catch { return (v!=null?v.toFixed(2):'—') + ' ' + cur; } };
  const save = (k,v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} };
  const load = (k,d=null)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } };

  /* ========== UI text (expanded) ========== */
  const UI = {
    title:{pl:"AI Agent+",en:"AI Agent+"},
    subtitle:{pl:"Pytaj • Ucz się • Graj • Odkrywaj",en:"Ask • Learn • Play • Explore"},
    tabs:{pl:["Chat","Nauka","Tutoriale","Zabawa"],en:["Chat","Learn","Tutorials","Play"]},
    send:{pl:"Wyślij",en:"Send"},
    read:{pl:"Czytaj",en:"Read"},
    stop:{pl:"Stop",en:"Stop"},
    tour:{pl:"Start tour",en:"Start tour"},
    ph:{pl:"Napisz… (np. co to trading, kurs AAPL, pokaż wykres EUR/USD tydzień, start quiz)",
        en:"Type… (e.g., what is trading, price AAPL, show chart EUR/USD week, start quiz)"},
    quick:{
  pl:["Jak czytać wykres","Co to Watchlist?","Rebalans","Start quiz"],
  en:["Read a chart","What is watchlist?","Rebalance","Start quiz"]
},
    learnHead:{pl:"Tematy Nauki",en:"Learning Topics"},
    tutHead:{pl:"Szybkie Tutoriale",en:"Quick Tutorials"},
    playHead:{pl:"Mini gry i quizy",en:"Mini games & quizzes"},
    noPrice:{pl:"Nie znalazłam kursu dla",en:"Couldn't find a price for"},
    good:{pl:"Brawo!",en:"Nice!"}, bad:{pl:"Spróbuj ponownie",en:"Try again"}
  };

/* ========== LEARN content — KID-FRIENDLY • EXPANDED (2×) ========== */
const LEARN = {
  /* ——— PODSTAWA: SŁOIKI ——— */
  jars_intro:{
    title:{pl:"Słoiki: baza Twoich finansów",en:"Jars: your money base"},
    body:{
      pl:`U nas pieniądze mieszkają w słoikach 🫙✨ Każdy ma zadanie:
🟢 Oszczędności – odkładamy na marzenia.
🟠 Zarobki – pieniądze za zadania i projekty.
🔴 Prezenty – to, co dostajemy.
🔵 Inwestycje – „paliwo” do kupowania akcji i walut.`,
      en:`Here money lives in jars 🫙✨ Each has a job:
🟢 Savings – we save for dreams.
🟠 Earnings – money for chores and projects.
🔴 Gifts – money we receive.
🔵 Investments – fuel for buying stocks and currencies.`
    }
  },

  savings:{
    title:{pl:"Słoik Oszczędności (🟢)",en:"Savings Jar (🟢)"},
    body:{
      pl:`To skarbonka bezpieczeństwa. Małe wpłaty + cierpliwość = wielka moc.
Tip: nazwij cel, np. „Rower na wakacje”.`,
      en:`This is your safety piggy bank. Small deposits + patience = big power.
Tip: name your goal, e.g. “Bike for summer”.`
    }
  },
  earnings:{
    title:{pl:"Słoik Zarobków (🟠)",en:"Earnings Jar (🟠)"},
    body:{
      pl:`Tu trafia kieszonkowe i nagrody za zadania. Część przenosimy do Oszczędności.`,
      en:`Pocket money and rewards live here. Move a part to Savings to grow faster.`
    }
  },
  gifts:{
    title:{pl:"Słoik Prezentów (🔴)",en:"Gifts Jar (🔴)"},
    body:{
      pl:`Urodziny? Święta? Super! Uczymy się dzielić i planować, a nie wydawać wszystko naraz.`,
      en:`Birthday? Holiday? Yay! We learn to share and plan, not spend all at once.`
    }
  },
  invest:{
    title:{pl:"Słoik Inwestycji (🔵)",en:"Investments Jar (🔵)"},
    body:{
      pl:`Z tego słoika kupujemy akcje i waluty. Bez niego nie zrobimy zakupu w aplikacji.`,
      en:`We buy stocks and currencies from here. Without it we can’t buy in the app.`
    }
  },

  allowance:{
    title:{pl:"Kieszonkowe (Allowance)",en:"Allowance"},
    body:{
      pl:`Rodzic jednym kliknięciem dodaje kieszonkowe. Zasada: trochę do Oszczędności, trochę do Inwestycji.`,
      en:`A parent adds allowance with one click. Rule: some to Savings, some to Investments.`
    }
  },
  pocket_rules:{
    title:{pl:"Proste zasady kieszonkowego",en:"Pocket money rules"},
    body:{
      pl:`1) Najpierw odkładam. 2) Potem planuję. 3) Na końcu wydaję z głową.`,
      en:`1) Save first. 2) Plan next. 3) Spend wisely at the end.`
    }
  },

  needs_wants:{
    title:{pl:"Potrzeby vs Zachcianki",en:"Needs vs Wants"},
    body:{
      pl:`Potrzeba = coś ważnego (np. plecak). Zachcianka = fajne, ale niekonieczne (np. kolejna gra). Najpierw potrzeby.`,
      en:`Need = important (e.g., school bag). Want = nice but not necessary (e.g., another game). Needs first.`
    }
  },

  goals:{
    title:{pl:"Cele (małe kroki → wielkie rzeczy)",en:"Goals (small steps → big things)"},
    body:{
      pl:`Zapisz cel, kwotę i datę. Każda wpłata to krok bliżej. Małe kroki działają najlepiej.`,
      en:`Write your goal, amount and date. Every deposit is a step closer. Small steps work best.`
    }
  },
  goal_smart:{
    title:{pl:"Cel SMART dla dzieci",en:"SMART goal for kids"},
    body:{
      pl:`S – konkretny, M – mierzalny, A – osiągalny, R – ważny, T – do kiedy. Przykład: „Oszczędzę 200 zł do 30 czerwca na rolki”.`,
      en:`S – specific, M – measurable, A – achievable, R – relevant, T – time-bound. Example: “Save $50 by June 30 for roller skates”.`
    }
  },
  vision_board:{
    title:{pl:"Tablica marzeń",en:"Dream board"},
    body:{
      pl:`Narysuj lub wklej zdjęcia celu. Gdy widzisz cel codziennie, łatwiej odkładać.`,
      en:`Draw or paste pictures of your goal. Seeing it daily makes saving easier.`
    }
  },

  budget:{
    title:{pl:"Budżet = plan na pieniądze",en:"Budget = a plan for money"},
    body:{
      pl:`Budżet mówi „ile na co”. Dzięki temu decyzje są łatwiejsze, a niespodzianki mniejsze.`,
      en:`A budget says “how much for what”. It makes choices easier and surprises smaller.`
    }
  },
  split_rule:{
    title:{pl:"Podział na 4 słoiki",en:"4-jars split idea"},
    body:{
      pl:`Przykład: 40% Oszczędności • 30% Inwestycje • 20% Wydatki • 10% Prezenty. Ustalcie własne proporcje.`,
      en:`Example: 40% Savings • 30% Investments • 20% Spend • 10% Gifts. Make your own split.`
    }
  },
  habit_loop:{
    title:{pl:"Nawyk odkładania",en:"Saving habit"},
    body:{
      pl:`Sygnał → wpłata → nagroda (odznaka, pochwała, krok do celu). Powtarzaj co tydzień.`,
      en:`Cue → deposit → reward (badge, praise, step to goal). Repeat weekly.`
    }
  },

  jar_refill:{
    title:{pl:"Doładowania słoików",en:"Refilling jars"},
    body:{
      pl:`Dostałeś 20 zł? Zrób szybki podział: 10 zł Oszczędności, 6 zł Inwestycje, 3 zł Wydatki, 1 zł Prezenty.`,
      en:`Got $10? Quick split: $5 Savings, $3 Investments, $2 Spend, $1 Gifts.`
    }
  },

  /* ——— RYNEK I PROSTE POJĘCIA ——— */
  trading_intro:{
    title:{pl:"Co to jest trading?",en:"What is trading?"},
    body:{
      pl:`Kupujemy i sprzedajemy aktywa (akcje, waluty). Ćwiczymy w trybie nauki — bez prawdziwych pieniędzy. Słowa: bid/ask (oferty), order (zlecenie), ryzyko (dbamy o bezpieczeństwo).`,
      en:`We buy and sell assets (stocks, currencies). We practice in learning mode — no real money. Words: bid/ask (offers), order, risk (we stay safe).`
    }
  },
  market_stock:{
    title:{pl:"Akcje i giełda",en:"Stocks & the market"},
    body:{
      pl:`Akcja to cząstka firmy. Jeśli firma rośnie i zarabia, często rośnie też cena akcji (ale nie zawsze).`,
      en:`A stock is a tiny piece of a company. If the company grows and earns, its price often rises (not always).`
    }
  },
  stock_vs_etf:{
    title:{pl:"Akcja vs ETF (prosto)",en:"Stock vs ETF (simple)"},
    body:{
      pl:`Akcja = jedna firma. ETF = koszyk wielu firm. ETF pomaga w dywersyfikacji.`,
      en:`Stock = one company. ETF = a basket of many companies. ETFs help diversify.`
    }
  },
  dividend_intro:{
    title:{pl:"Dywidenda (prosto)",en:"Dividend (simple)"},
    body:{
      pl:`Czasem firma dzieli się zyskiem i wypłaca dywidendę. Nie każda firma to robi.`,
      en:`Sometimes a company shares profit and pays a dividend. Not every company does.`
    }
  },

  market_fx:{
    title:{pl:"Waluty (FX)",en:"Currencies (FX)"},
    body:{
      pl:`Para EUR/USD mówi, ile USD kosztuje 1 EUR. Gdy wykres rośnie — EUR zwykle się wzmacnia wobec USD.`,
      en:`EUR/USD shows how many USD for 1 EUR. If the chart goes up, EUR usually gets stronger to USD.`
    }
  },
  fx_examples:{
    title:{pl:"Przykłady siły walut",en:"Currency strength examples"},
    body:{
      pl:`EUR/PLN: 4.00 → 4.20 ⇒ PLN słabszy. 4.20 → 4.00 ⇒ PLN silniejszy. Tak czytamy zmianę kursu.`,
      en:`EUR/PLN: 4.00 → 4.20 ⇒ PLN weaker. 4.20 → 4.00 ⇒ PLN stronger. That’s how we read it.`
    }
  },

  charts_ranges:{
    title:{pl:"Wykresy i zakresy (1D, 1W, 1M…)",en:"Charts & ranges (1D, 1W, 1M…)"},
    body:{
      pl:`Krótki zakres = dużo detali dnia. Długi zakres = widać trend. Zmieniaj zakres, by zrozumieć całość.`,
      en:`Short range = day details. Long range = trend view. Switch ranges to see the big picture.`
    }
  },
  chart_patterns:{
    title:{pl:"Wzrosty, spadki i zygzaki",en:"Ups, downs & zig-zags"},
    body:{
      pl:`Linia w górę → wzrost. W dół → spadek. Zygzaki → zmienność. To normalne – dlatego mamy plan.`,
      en:`Line up → rise. Down → drop. Zig-zags → volatility. That’s normal — that’s why we plan.`
    }
  },

  accounting:{
    title:{pl:"Księgowość = ślad pieniędzy",en:"Accounting = money trail"},
    body:{
      pl:`Zapisujemy każdą transakcję: ile, kiedy i za ile. Dzięki temu wiemy, co działa, a co poprawić.`,
      en:`We record every transaction: how much, when and for how much. Then we know what works and what to improve.`
    }
  },
  pl_meaning:{
    title:{pl:"P/L – wynik gry",en:"P/L – your score"},
    body:{
      pl:`Unrealized P/L – wynik na pozycjach, które trzymasz. Realized P/L – wynik po sprzedaży. Ucz się na swoich decyzjach.`,
      en:`Unrealized P/L – result on positions you still hold. Realized P/L – after selling. Learn from your choices.`
    }
  },
  fees_note:{
    title:{pl:"Opłaty i podatki (prawdziwy świat)",en:"Fees & taxes (real world)"},
    body:{
      pl:`W naszej nauce nie ma prawdziwych opłat. W realnym świecie opłaty i podatki mogą występować.`,
      en:`In learning mode there are no real fees. In the real world, fees and taxes may apply.`
    }
  },

  /* ——— NARZĘDZIA W APLIKACJI ——— */
  watchlist:{
    title:{pl:"Watchlist = lista ciekawych rzeczy",en:"Watchlist = list of interesting things"},
    body:{
      pl:`Dodaj spółki lub pary walut do obserwacji. Kliknij kartę, by zobaczyć szczegóły i duży wykres.`,
      en:`Add stocks or currency pairs to track. Click a card to see details and a big chart.`
    }
  },
  basket:{
    title:{pl:"Koszyk (Basket)",en:"Basket"},
    body:{
      pl:`Najpierw planujemy w koszyku, dopiero potem kupujemy. To jak lista zakupów — bez pośpiechu.`,
      en:`Plan in the basket first, buy later. It’s like a shopping list — no rush.`
    }
  },
  portfolio:{
    title:{pl:"Portfel i średni koszt",en:"Portfolio & average cost"},
    body:{
      pl:`Portfel pokazuje, co posiadasz. Średni koszt mówi, ile średnio zapłaciłeś za 1 sztukę.`,
      en:`Portfolio shows what you own. Average cost tells how much you paid on average per unit.`
    }
  },

  /* ——— BEZPIECZEŃSTWO I DOBRE NAWYKI ——— */
  safety:{
    title:{pl:"Bezpieczeństwo 100%",en:"100% Safety"},
    body:{
      pl:`W aplikacji nie używamy prawdziwych pieniędzy. Zawsze pytaj dorosłego, gdy czegoś nie rozumiesz. PIN i hasła są tajne.`,
      en:`We don’t use real money here. Always ask an adult if you don’t understand. PINs and passwords are secret.`
    }
  },
  online_safety:{
    title:{pl:"Bezpieczny internet",en:"Online safety"},
    body:{
      pl:`Nie klikaj w dziwne linki. Nie podawaj danych. Jeśli coś brzmi „zbyt pięknie”, zapytaj rodzica.`,
      en:`Don’t click weird links. Don’t share data. If it sounds “too good”, ask a parent.`
    }
  },
  scam_check:{
    title:{pl:"Test „czy to ściema?”",en:"“Is it a scam?” test"},
    body:{
      pl:`Czy obiecują pewny zysk? Czy proszą o szybki przelew? Czy wymagają tajemnicy? Jeśli TAK — stop i zapytaj dorosłego.`,
      en:`Do they promise guaranteed profit? Ask for fast payment? Ask for secrecy? If YES — stop and ask an adult.`
    }
  },

  /* ——— KROK PO KROKU ——— */
  howto_stock:{
    title:{pl:"Krok po kroku: kup akcję",en:"Step by step: buy a stock"},
    body:{
      pl:`1) Stocks → wybierz spółkę.
2) Add to basket → ustaw ilość.
3) Sprawdź Investment Jar.
4) Kliknij Buy → gotowe! Potem śledź P/L w Portfelu.`,
      en:`1) Stocks → choose a company.
2) Add to basket → set quantity.
3) Check Investment Jar.
4) Click Buy → done! Then track P/L in Portfolio.`
    }
  },
  howto_fx:{
    title:{pl:"Krok po kroku: kup walutę (FX)",en:"Step by step: buy a currency (FX)"},
    body:{
      pl:`1) Currencies (FX) → wybierz parę.
2) Add to basket → ilość.
3) Sprawdź Investment Jar.
4) Buy → obserwuj kurs i wynik.`,
      en:`1) Currencies (FX) → choose a pair.
2) Add to basket → quantity.
3) Check Investment Jar.
4) Buy → watch rate and result.`
    }
  },

  /* ——— NAWYKI & POSTAWA ——— */
  money_mindset:{
    title:{pl:"Nastawienie do pieniędzy",en:"Money mindset"},
    body:{
      pl:`Pieniądze to narzędzie do celów. Dbamy o szacunek, plan i cierpliwość.`,
      en:`Money is a tool for goals. We practice respect, planning and patience.`
    }
  },
  reflection_journal:{
    title:{pl:"Dziennik pieniędzy (2 minuty)",en:"Money journal (2 minutes)"},
    body:{
      pl:`Zapisz 1 rzecz, której się dziś nauczyłeś i 1 decyzję, z której jesteś dumny.`,
      en:`Write 1 thing you learned today and 1 decision you are proud of.`
    }
  },
  gratitude_share:{
    title:{pl:"Wdzięczność i dzielenie się",en:"Gratitude & sharing"},
    body:{
      pl:`Małe wsparcie dla innych daje wielką radość. 10% do słoika „Prezenty” to dobry start.`,
      en:`Small support for others brings big joy. 10% to the “Gifts” jar is a great start.`
    }
  },
  inflation_simple:{
    title:{pl:"Inflacja (prosto)",en:"Inflation (simple)"},
    body:{
      pl:`Gdy ceny rosną, ta sama kwota kupuje mniej. Dlatego oszczędzamy i planujemy zakupy mądrze.`,
      en:`If prices rise, the same money buys less. That’s why we save and plan wisely.`
    }
  },
  compound_magic:{
    title:{pl:"Magia procentu składanego",en:"Magic of compounding"},
    body:{
      pl:`Gdy oszczędności rosną, „odsetki” też mogą rosnąć. Śnieżna kula dobra — zaczyna się od małej kulki.`,
      en:`As savings grow, “interest” can grow too. A good snowball starts small and rolls on.`
    }
  }
};

/* ========== LEARN renderer — porządek, tylko karty, bez quizów ========== */
function fillLearn(){
  const L = getLang();
  const wrap = $('#ai-learn');
  if (!wrap) return;

  // Kolejność: od słoików → planowania → rynek → narzędzia → bezpieczeństwo → krok-po-kroku → mindset
  const order = [
    // Słoiki
    'jars_intro','savings','earnings','gifts','invest','allowance','pocket_rules',
    // Plan i cele
    'needs_wants','goals','goal_smart','vision_board','budget','split_rule','habit_loop','jar_refill',
    // Rynek i pojęcia
    'trading_intro','market_stock','stock_vs_etf','dividend_intro','market_fx','fx_examples',
    'charts_ranges','chart_patterns','accounting','pl_meaning','fees_note',
    // Narzędzia w aplikacji
    'watchlist','basket','portfolio',
    // Bezpieczeństwo
    'safety','online_safety','scam_check',
    // Krok po kroku
    'howto_stock','howto_fx',
    // Mindset
    'money_mindset','reflection_journal','gratitude_share','inflation_simple','compound_magic'
  ];

  wrap.innerHTML = order.map(key => {
    const card = LEARN[key];
    if (!card) return '';
    const title = card.title[L] || card.title.en;
    const body  = card.body[L]  || card.body.en;
    return cardHTML(title, body);
  }).join('');
}


  /* ========== Glossary ========== */
  const GLOSSARY = {
    spread:{pl:"Spread — różnica bid/ask.", en:"Spread — difference between bid/ask."},
    ticker:{pl:"Ticker — krótki kod (AAPL).", en:"Ticker — short code (AAPL)."},
    leverage:{pl:"Dźwignia — pożyczona moc (ostrożnie).", en:"Leverage — borrowed power (careful)."},
    liquidity:{pl:"Płynność — łatwość handlu po cenie.", en:"Liquidity — ease of trading at fair price."},
    diversification:{pl:"Dywersyfikacja — nie wszystko w jednym.", en:"Diversification — don’t put all in one."},
    stoploss:{pl:"Stop‑loss — ucina stratę automatycznie.", en:"Stop‑loss — cuts loss automatically."},
    takeprofit:{pl:"Take‑profit — zamyka zysk automatycznie.", en:"Take‑profit — locks profit automatically."}
  };

  /* ========== FAQ prompts ========== */
  const FAQ = { pl:["co to trading?","co to spread?","jak działa dźwignia?","typy zleceń","pokaż wykres AAPL tydzień","kurs EUR/USD","start quiz","rebalance","co to P/L?","krok po kroku kup akcję"],
                en:["what is trading?","what is spread?","how does leverage work?","order types","show chart AAPL week","price EUR/USD","start quiz","rebalance","what is P/L?","step by step buy a stock"] };

  /* ========== App concepts mapping ========== */
  const KB = {
    availableCash:{aliases:["available cash","cash","gotówka","dostępna gotówka"], ids:["#availableCash","#miniCash"], desc:{en:"Available Cash – money ready now.", pl:"Available Cash – środki dostępne od razu."}},
    netWorth:{aliases:["net worth","wartość netto","wartosc netto"], ids:["#netWorth"], desc:{en:"Net Worth – jars + portfolios.", pl:"Wartość netto – słoiki + portfele."}},
    savings:{aliases:["savings","oszczędności","oszczednosci","słoik oszczędności"], ids:["#saveAmt"], desc:{en:"Savings jar – long term.", pl:"Słoik Oszczędności – długoterminowo."}},
    earnings:{aliases:["earnings","zarobki","słoik zarobków"], ids:["#spendAmt"], desc:{en:"Earnings jar – chores.", pl:"Słoik Zarobków – zadania."}},
    gifts:{aliases:["gifts","prezenty","słoik prezentów"], ids:["#giveAmt"], desc:{en:"Gifts jar.", pl:"Słoik Prezentów."}},
    investCash:{aliases:["investments","inwestycje","słoik inwestycje"], ids:["#investAmt"], desc:{en:"Investments jar – deploy cash.", pl:"Słoik Inwestycje – gotówka na zakupy."}},
    invFx:{aliases:["inv value fx","fx value","wartość fx","inv fx"], ids:["#miniInvFx"], desc:{en:"FX portfolio value.", pl:"Wartość pozycji FX."}},
    invStocks:{aliases:["inv value stocks","wartość akcji","inv stocks"], ids:["#miniInvStocks"], desc:{en:"Stocks portfolio value.", pl:"Wartość pozycji akcji."}},
    invTotal:{aliases:["inv value total","wartość portfela","inv total"], ids:["#miniInvTotal"], desc:{en:"Total investments value.", pl:"Łączna wartość inwestycji."}},
    totalEarned:{aliases:["total earned","zarobiono łącznie"], ids:["#miniTotalEarned","#kpiTotal"], desc:{en:"Realized profits sum.", pl:"Suma zrealizowanych zysków."}},
    totalLoss:{aliases:["total loss","łączne straty"], ids:["#miniTotalLoss","#kpiTotalLoss"], desc:{en:"Realized losses sum.", pl:"Suma zrealizowanych strat."}},
    trends:{aliases:["global trends","trendy"], ids:["#globalTrendsCard",".global-trends"], desc:{en:"World snapshot.", pl:"Migawka świata."}},
    watchlist:{aliases:["watchlist","lista obserwacyjna"], ids:["#watchlist",".watchlist",".wl-container"], desc:{en:"Your instruments.", pl:"Twoje instrumenty."}},
    stockMarket:{aliases:["stock market","stocks","rynek akcji"], ids:["#stockMarket",".stock-market",".tab-stocks"], desc:{en:"Browse stocks & basket.", pl:"Przegląd akcji i koszyka."}},
    currencyMarket:{aliases:["currency market","fx market","currencies","waluty"], ids:["#fxMarket",".fx-market",".tab-fx"], desc:{en:"Currency pairs.", pl:"Pary walutowe."}},
    basket:{aliases:["basket","koszyk"], ids:['[data-basket-list="stocks"]','.basket-stocks','#basketStocks'], desc:{en:"Pre-trade staging.", pl:"Przedsionek zakupu."}},
    portfolio:{aliases:["portfolio","stock portfolio","portfel akcji"], ids:["#portfolioBody",".stock-portfolio"], desc:{en:"Positions & P/L.", pl:"Pozycje i P/L."}},
    quickActions:{aliases:["quick actions","szybkie akcje","allowance"], ids:["#addAllowance","#moveSpendSave","#moveDonToSave",".quick-actions"], desc:{en:"Allowance & moves.", pl:"Kieszonkowe i przeniesienia."}},
    dataMode:{aliases:["data mode","simulation","live mode","tryb danych"], ids:["#liveModeLabel","#liveStatus",".data-mode"], desc:{en:"Demo vs Live.", pl:"Demo vs Live."}}
  };
  const resolveConcept = (q)=>{ const t=q.toLowerCase(); for (const [k,v] of Object.entries(KB)) if (v.aliases.some(a=>t.includes(a))) return k; return null; };
  const readValue = (ids)=> { for(const sel of ids||[]){ const el=$(sel); const txt=el?.textContent?.trim(); if(txt) return txt; } return null; };

  /* ========== Price helper ========== */
  async function checkPrice(symbol){
    const lang=getLang();
    try{
      if(!symbol) throw 0;
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
      const res = await fetch(url,{cache:'no-store'});
      const j = await res.json(); const r = j?.quoteResponse?.result?.[0];
      if(!r) throw 0;
      const price = r.regularMarketPrice ?? r.postMarketPrice ?? r.preMarketPrice;
      const chg = r.regularMarketChange ?? 0, chgp = r.regularMarketChangePercent ?? 0;
      const arrow = chgp>0?'▲':chgp<0?'▼':'•';
      writeLog(`${r.symbol} — ${price!=null?price:'—'} ${r.currency||''}\n${arrow} ${(chgp||0).toFixed(2)}% (${(chg||0).toFixed(2)})`);
    }catch{ writeLog(`${UI.noPrice[lang]} ${symbol}.`); }
  }

  /* ========== Rebalance tip ========== */
  function rebalanceTip(){
    const lang=getLang();
    const cash = toNum($('#saveAmt')?.textContent)+toNum($('#spendAmt')?.textContent)+toNum($('#giveAmt')?.textContent);
    const inv  = toNum($('#miniInvTotal')?.textContent);
    const total = cash+inv; if(!total) return lang==='pl'?'• Brak danych do rebalansu.':'• Not enough data for rebalance.';
    const cashPct = cash/total*100; const diff=Math.round(cashPct-50);
    if(Math.abs(diff)<5) return lang==='pl'?'• Portfel blisko 50/50 – OK.':'• Portfolio near 50/50 – OK.';
    const amt = total*Math.abs(diff)/100;
    return diff>0
      ? (lang==='pl'?`• Za dużo gotówki (~${diff}pp). Rozważ zakup za ok. ${fmtCur(amt)}.`:`• Too much cash (~${diff}pp). Consider buying ~${fmtCur(amt)}.`)
      : (lang==='pl'?`• Za dużo w aktywach (~${Math.abs(diff)}pp). Sprzedaj i podnieś gotówkę o ~${fmtCur(amt)}.`:`• Too much in assets (~${Math.abs(diff)}pp). Sell to raise ~${fmtCur(amt)} cash.`);
  }

  /* ========== Chart explainer ========== */
  const explainSeries = (series)=>{
    const lang=getLang();
    const s = Array.isArray(series)&&series.length>1?series:window.__LAST_SERIES__||[{x:0,y:10},{x:1,y:9.8},{x:2,y:10.2},{x:3,y:10.6},{x:4,y:10.5}];
    const y0=+s[0].y, y1=+s.at(-1).y, diff=+(y1-y0).toFixed(2);
    if(diff>0) return lang==='pl'?`Start → teraz: +${diff}. Trend w górę.`:`Start → now: +${diff}. Up trend.`;
    if(diff<0) return lang==='pl'?`Start → teraz: ${diff}. Trend w dół.`:`Start → now: ${diff}. Down trend.`;
    return lang==='pl'?`Start → teraz: 0. Bez zmian.`:`Start → now: 0. No big change.`;
  };

/* ========== QUIZ — advanced (PL/EN, live switch) ========== */
/* Drop-in za stary blok “Quiz (simple)” + stare renderQuiz() */

(() => {
  // --- etykiety (PL/EN) ---
  const QZ_LBL = {
    homeTitle:{pl:'Quiz mode', en:'Quiz mode'},
    homeSub:{pl:'Wybierz zestaw (10 zestawów × 20 pytań).', en:'Pick a set (10 sets × 20 questions).'},
    start:{pl:'Start', en:'Start'},
    random:{pl:'Losuj', en:'Random'},
    qOf:{pl:'Pytanie', en:'Question'},
    skip:{pl:'Pomiń', en:'Skip'},
    stop:{pl:'Zakończ', en:'Finish'},
    score:{pl:'Wynik', en:'Score'},
    again:{pl:'Nowy quiz', en:'New quiz'},
    choose:{pl:'Wybierz zestaw', en:'Choose set'},
    good:{pl:'Dobrze! ', en:'Nice! '},
    almost:{pl:'Prawie… ', en:'Almost… '},
    fb100:{pl:'Perfekcyjnie! Jesteś mistrzem rynku 🏆', en:'Perfect! You’re a market pro 🏆'},
    fb80:{pl:'Świetna robota! 💪', en:'Great job! 💪'},
    fb50:{pl:'Dobrze! Ćwicz dalej 🙂', en:'Good! Keep practicing 🙂'},
    fb0:{pl:'Spoko — spróbuj jeszcze raz!', en:'No worries — try again!'}
  };
  const qz_t = (k) => QZ_LBL[k][getLang()] || QZ_LBL[k].en;

  // --- helpers & templaty ---
  const QZ_A = s => `A. ${s}`;
  const QZ_B = s => `B. ${s}`;
  const QZ_C = s => `C. ${s}`;
  const QZ_D = s => `D. ${s}`;
  const qz_mc2 = (qPL,qEN, chPL, chEN, a, exPL='', exEN='') =>
    ({ q:{pl:qPL,en:qEN}, choices:{pl:chPL,en:chEN}, a, explain:{pl:exPL,en:exEN} });
  const qz_msgByPct = (p)=> p===100 ? qz_t('fb100') : p>=80 ? qz_t('fb80') : p>=50 ? qz_t('fb50') : qz_t('fb0');
  const qz_fmt = (s, vars) => s.replace(/\{\{(\w+)\}\}/g, (_,k)=> String(vars[k] ?? ''));

  // ---------- BANKI PYTAŃ (10x) ----------
  // 1) App basics & jars
  function qz_bankBasicsApp(lang){
    const Q = [
      qz_mc2('Który słoik jest do długoterminowego odkładania?','Which jar is for long-term saving?',
        [QZ_A('Savings'),QZ_B('Earnings'),QZ_C('Gifts')],[QZ_A('Savings'),QZ_B('Earnings'),QZ_C('Gifts')],0,'Savings = oszczędności.','Savings = money you keep.'),
      qz_mc2('Z którego miejsca idą pieniądze na zakupy akcji lub walut?','Where does the money for buying stocks/FX come from?',
        [QZ_A('Investment cash'),QZ_B('Savings'),QZ_C('Gifts')],[QZ_A('Investment cash'),QZ_B('Savings'),QZ_C('Gifts')],0,'Kupujemy z „Investment cash”.','We buy using “Investment cash”.'),
      qz_mc2('Przycisk „Move Earnings → Savings” służy do…','The “Move Earnings → Savings” button…',
        [QZ_A('przeniesienia kieszonkowego do oszczędności'),QZ_B('kupna akcji'),QZ_C('zmiany języka')],
        [QZ_A('moves pocket money to savings'),QZ_B('buys stocks'),QZ_C('changes language')],0),
      qz_mc2('„Allowance 10 USD” dodaje środki do…','“Allowance 10 USD” adds money to…',
        [QZ_A('Savings'),QZ_B('Gifts'),QZ_C('FX Portfolio')],[QZ_A('Savings'),QZ_B('Gifts'),QZ_C('FX Portfolio')],0),
      qz_mc2('W „Parent panel” ustawiasz…','In “Parent panel” you set…',
        [QZ_A('miesięczne kieszonkowe'),QZ_B('cenę akcji'),QZ_C('kurs walut')],
        [QZ_A('monthly allowance'),QZ_B('stock price'),QZ_C('FX rate')],0),
      qz_mc2('„Net Worth” to…','“Net Worth” is…',
        [QZ_A('suma słoików + akcje + waluty'),QZ_B('tylko słoiki'),QZ_C('tylko akcje')],
        [QZ_A('jars + stocks + FX total'),QZ_B('jars only'),QZ_C('stocks only')],0),
      qz_mc2('Szybkie sumy na górze to…','The small numbers on top are…',
        [QZ_A('mini słoiki'),QZ_B('tutorial'),QZ_C('watchlist')],
        [QZ_A('sticky mini-jars'),QZ_B('tutorial'),QZ_C('watchlist')],0),
      qz_mc2('Watchlist służy do…','Watchlist is for…',
        [QZ_A('obserwowania instrumentów'),QZ_B('płatności'),QZ_C('zmiany PIN')],
        [QZ_A('tracking instruments'),QZ_B('payments'),QZ_C('PIN change')],0),
      qz_mc2('„Basket (Stocks)” to…','“Basket (Stocks)” is…',
        [QZ_A('koszyk przed zakupem'),QZ_B('video'),QZ_C('chat')],
        [QZ_A('a pre-purchase basket'),QZ_B('video'),QZ_C('chat')],0),
      qz_mc2('„Stock Portfolio” pokazuje…','“Stock Portfolio” shows…',
        [QZ_A('kupione akcje'),QZ_B('plan lekcji'),QZ_C('pulpit rodzica')],
        [QZ_A('your bought stocks'),QZ_B('timetable'),QZ_C('parent panel')],0),
      qz_mc2('„FX Portfolio” pokazuje…','“FX Portfolio” shows…',
        [QZ_A('kupione waluty'),QZ_B('samouczek'),QZ_C('historię akcji')],
        [QZ_A('your bought currencies'),QZ_B('tutorial'),QZ_C('stock history')],0),
      qz_mc2('Filtr „Max” w listach robi…','The “Max” filter does…',
        [QZ_A('pokazuje tylko tańsze/niższy kurs niż wpisany limit'),QZ_B('powiększa wykres'),QZ_C('zmienia język')],
        [QZ_A('shows items cheaper/lower than limit'),QZ_B('zooms chart'),QZ_C('changes language')],0),
      qz_mc2('Przycisk sortowania ceny (↕) robi…','The sort price button (↕)…',
        [QZ_A('sortuje rosnąco/malejąco'),QZ_B('usuwa pozycje'),QZ_C('kupuje automatycznie')],
        [QZ_A('sorts up/down'),QZ_B('removes items'),QZ_C('auto-buys')],0),
      qz_mc2('„Add to basket” przy transakcji…','“Add to basket” in trade…',
        [QZ_A('dodaje pozycję do koszyka'),QZ_B('sprzedaje'),QZ_C('zmienia region')],
        [QZ_A('adds the item to basket'),QZ_B('sells'),QZ_C('changes region')],0),
      qz_mc2('„Buy (investment cash)” oznacza…','“Buy (investment cash)” means…',
        [QZ_A('zakup za środki inwestycyjne'),QZ_B('prezent'),QZ_C('nowy słoik')],
        [QZ_A('buy using investment cash'),QZ_B('a gift'),QZ_C('a new jar')],0),
      qz_mc2('„Sales History” pokazuje…','“Sales History” shows…',
        [QZ_A('zrealizowane transakcje'),QZ_B('przyszłe ceny'),QZ_C('PIN')],
        [QZ_A('completed trades'),QZ_B('future prices'),QZ_C('PIN')],0),
      qz_mc2('„Available Cash” to…','“Available Cash” is…',
        [QZ_A('Savings + Earnings + Gifts'),QZ_B('tylko Savings'),QZ_C('tylko Earnings')],
        [QZ_A('Savings + Earnings + Gifts'),QZ_B('Savings only'),QZ_C('Earnings only')],0),
      qz_mc2('„Investments” (słoik) oznacza…','“Investments” (jar) means…',
        [QZ_A('gotówkę na inwestowanie'),QZ_B('prezenty'),QZ_C('wydatki szkolne')],
        [QZ_A('cash for investing'),QZ_B('gifts'),QZ_C('school spend')],0),
      qz_mc2('Aby kupić akcje trzeba najpierw…','To buy stocks you first need…',
        [QZ_A('mieć środki w Investment cash'),QZ_B('YouTube'),QZ_C('tryb nocny')],
        [QZ_A('funds in Investment cash'),QZ_B('YouTube'),QZ_C('dark mode')],0),
      qz_mc2('Watchlist kupuje sama?','Does watchlist auto-buy?',
        [QZ_A('Nie, to tylko obserwacja'),QZ_B('Tak'),QZ_C('Tylko w piątki')],
        [QZ_A('No, it’s only tracking'),QZ_B('Yes'),QZ_C('Only on Fridays')],0)
    ];
    return { id:'app-basics', title:(lang==='pl'?'App basics & słoiki':'App basics & jars'), questions:Q };
  }

  // 2) Stocks • easy math
  function qz_bankStocksMath(lang){
    const pairs = [[5,3],[7,2],[10,3],[12,2],[15,4],[8,5],[9,4],[20,2],[25,1],[6,6],[4,7],[3,8]];
    const pnl   = [[12,15],[9,7],[5,9],[20,18],[10,10],[7,11],[14,12],[3,5]];
    const Q = [];
    pairs.forEach(([p,q])=>{
      const cost=p*q;
      const qPL = qz_fmt('Akcja kosztuje ${{p}}. Kupujesz {{q}} szt. Ile płacisz?',{p,q});
      const qEN = qz_fmt('The share costs ${{p}}. You buy {{q}} pcs. How much do you pay?',{p,q});
      Q.push(qz_mc2(qPL,qEN,[QZ_A(`$${cost}`),QZ_B(`$${p+q}`),QZ_C(`$${cost-1}`)],[QZ_A(`$${cost}`),QZ_B(`$${p+q}`),QZ_C(`$${cost-1}`)],0,'Koszt = cena × ilość.','Cost = price × quantity.'));
    });
    pnl.forEach(([buy,now])=>{
      const diff=now-buy, sign=diff>0?'+':'';
      const qPL = qz_fmt('Kupiłeś po ${{b}}. Teraz ${{n}}. Jaki zysk/strata na 1 akcję?',{b:buy,n:now});
      const qEN = qz_fmt('Bought at ${{b}}. Now ${{n}}. P/L per 1 share?',{b:buy,n:now});
      Q.push(qz_mc2(qPL,qEN,[QZ_A(`${sign}$${Math.abs(diff)}`),QZ_B(`$${buy+now}`),QZ_C(`$${Math.abs(diff)+1}`)],[QZ_A(`${sign}$${Math.abs(diff)}`),QZ_B(`$${buy+now}`),QZ_C(`$${Math.abs(diff)+1}`)],0,'P/L = cena teraz − cena zakupu.','P/L = now − buy.'));
    });
    return { id:'stocks-math', title:(lang==='pl'?'Akcje • prosta matematyka':'Stocks • easy math'), questions:Q.slice(0,20) };
  }

  // 3) Stocks • concepts
  function qz_bankStockConcepts(lang){
    const Q = [
      qz_mc2('„Ticker” to…','“Ticker” is…',
        [QZ_A('krótki symbol spółki, np. AAPL'),QZ_B('rodzaj wykresu'),QZ_C('konto rodzica')],
        [QZ_A('short company symbol, e.g., AAPL'),QZ_B('chart type'),QZ_C('parent account')],0),
      qz_mc2('Jeśli linia wykresu rośnie w prawo, to zwykle…','If the chart line goes up to the right, usually…',
        [QZ_A('cena rośnie'),QZ_B('cena spada'),QZ_C('nie wiemy')],
        [QZ_A('price is rising'),QZ_B('price is falling'),QZ_C('we don’t know')],0),
      qz_mc2('Kupując 1 akcję, stajesz się…','When you buy 1 share, you become…',
        [QZ_A('współwłaścicielem maleńkiej części firmy'),QZ_B('pracownikiem'),QZ_C('klientem banku')],
        [QZ_A('a tiny co-owner of the company'),QZ_B('an employee'),QZ_C('a bank client')],0),
      qz_mc2('„Portfolio (Stocks)” to…','“Portfolio (Stocks)” is…',
        [QZ_A('Twoje kupione akcje'),QZ_B('lista życzeń'),QZ_C('film instruktażowy')],
        [QZ_A('your bought stocks'),QZ_B('wishlist'),QZ_C('tutorial video')],0),
      qz_mc2('Czy cena akcji może się zmieniać codziennie?','Can a stock price change every day?',
        [QZ_A('Tak'),QZ_B('Nie'),QZ_C('Tylko w piątki')],
        [QZ_A('Yes'),QZ_B('No'),QZ_C('Only on Fridays')],0),
      qz_mc2('Dywersyfikacja to…','Diversification is…',
        [QZ_A('posiadanie różnych spółek'),QZ_B('kupno tylko 1 spółki'),QZ_C('zmiana waluty')],
        [QZ_A('owning different companies'),QZ_B('only 1 company'),QZ_C('changing currency')],0),
      qz_mc2('„Region” na liście rynku akcji wybiera…','“Region” on stocks list selects…',
        [QZ_A('USA/Europa/Chiny itd.'),QZ_B('kolor tła'),QZ_C('PIN')],
        [QZ_A('USA/Europe/China etc.'),QZ_B('background color'),QZ_C('PIN')],0),
      qz_mc2('„Add to basket” przed „Buy” pomaga…','“Add to basket” before “Buy” helps…',
        [QZ_A('zaplanować zakup kilku pozycji'),QZ_B('zmienić język'),QZ_C('otworzyć tutorial')],
        [QZ_A('plan several items before buying'),QZ_B('change language'),QZ_C('open tutorial')],0),
      qz_mc2('Wartość pozycji =','Position value =',
        [QZ_A('cena × liczba akcji'),QZ_B('cena + 1'),QZ_C('zawsze 10 USD')],
        [QZ_A('price × number of shares'),QZ_B('price + 1'),QZ_C('always 10 USD')],0),
      qz_mc2('Gdy cena spada poniżej ceny zakupu, masz…','If price drops under buy price, you have…',
        [QZ_A('tymczasową stratę'),QZ_B('stałą wygraną'),QZ_C('gratisowe akcje')],
        [QZ_A('a temporary loss'),QZ_B('guaranteed win'),QZ_C('free shares')],0),
      qz_mc2('„Sales History (Stocks)” to…','“Sales History (Stocks)” is…',
        [QZ_A('sprzedane transakcje'),QZ_B('lista filmów'),QZ_C('kursy walut')],
        [QZ_A('sold trades'),QZ_B('video list'),QZ_C('FX rates')],0),
      qz_mc2('Czy możesz mieć 0 akcji danej spółki?','Can you have 0 shares of a company?',
        [QZ_A('Tak, po sprzedaży'),QZ_B('Nie'),QZ_C('Tylko w weekend')],
        [QZ_A('Yes, after selling'),QZ_B('No'),QZ_C('Only on weekends')],0),
      qz_mc2('„Cancel” w oknie transakcji…','“Cancel” in trade window…',
        [QZ_A('zamyka okno bez zakupu'),QZ_B('sprzedaje akcje'),QZ_C('czyści słoiki')],
        [QZ_A('closes without buying'),QZ_B('sells stocks'),QZ_C('clears jars')],0),
      qz_mc2('„Quantity” w transakcji oznacza…','“Quantity” in trade means…',
        [QZ_A('ile sztuk kupujesz'),QZ_B('cenę jednej akcji'),QZ_C('nr odcinka')],
        [QZ_A('how many shares you buy'),QZ_B('price per share'),QZ_C('episode number')],0),
      qz_mc2('„Avg. cost” w portfelu to…','“Avg. cost” in portfolio is…',
        [QZ_A('średnia cena kupna akcji'),QZ_B('najwyższa cena dnia'),QZ_C('opłata bankowa')],
        [QZ_A('average buy price'),QZ_B('day high'),QZ_C('bank fee')],0),
      qz_mc2('Jedna spółka może mieć różne ceny w różne dni?','Can one company have different prices on different days?',
        [QZ_A('Tak'),QZ_B('Nie'),QZ_C('Tylko w środy')],
        [QZ_A('Yes'),QZ_B('No'),QZ_C('Only on Wednesdays')],0),
      qz_mc2('„Add more” na rynku akcji…','“Add more” on stock market…',
        [QZ_A('doładowuje listę popularnych spółek'),QZ_B('zmienia waluty'),QZ_C('otwiera Parent panel')],
        [QZ_A('adds popular stocks'),QZ_B('changes currencies'),QZ_C('opens Parent panel')],0),
      qz_mc2('„Max price” filtr…','“Max price” filter…',
        [QZ_A('pokazuje spółki tańsze niż limit'),QZ_B('ustawia nową cenę spółki'),QZ_C('wycisza dźwięk')],
        [QZ_A('shows stocks cheaper than limit'),QZ_B('sets a new company price'),QZ_C('mutes sounds')],0),
      qz_mc2('Warto mieć plan i budżet, bo…','It’s good to have a plan and budget because…',
        [QZ_A('rynek bywa zmienny'),QZ_B('pieniądze się nie kończą'),QZ_C('smok tak mówi')],
        [QZ_A('markets can be bumpy'),QZ_B('money never ends'),QZ_C('a dragon said so')],0),
      qz_mc2('Długi horyzont (lata) zwykle…','A long horizon (years) usually…',
        [QZ_A('zmniejsza wpływ krótkich wahań'),QZ_B('powiększa każdy spadek'),QZ_C('blokuje kupowanie')],
        [QZ_A('reduces short-term noise'),QZ_B('amplifies every drop'),QZ_C('blocks buying')],0)
    ];
    return { id:'stocks-concepts', title:(lang==='pl'?'Akcje • pojęcia':'Stocks • concepts'), questions:Q };
  }

  // 4) Charts & ranges
  function qz_bankCharts(lang){
    const Q = [
      qz_mc2('Zakres „1D” oznacza…','Range “1D” means…',[QZ_A('jeden dzień'),QZ_B('jeden miesiąc'),QZ_C('cały rok')],[QZ_A('one day'),QZ_B('one month'),QZ_C('full year')],0),
      qz_mc2('„5D” to…','“5D” is…',[QZ_A('5 dni'),QZ_B('5 tygodni'),QZ_C('5 lat')],[QZ_A('5 days'),QZ_B('5 weeks'),QZ_C('5 years')],0),
      qz_mc2('„1M” to…','“1M” is…',[QZ_A('1 miesiąc'),QZ_B('1 minuta'),QZ_C('1 milion')],[QZ_A('1 month'),QZ_B('1 minute'),QZ_C('1 million')],0),
      qz_mc2('„6M” pokazuje…','“6M” shows…',[QZ_A('ostatnie 6 miesięcy'),QZ_B('6 dni'),QZ_C('6 lat')],[QZ_A('last 6 months'),QZ_B('6 days'),QZ_C('6 years')],0),
      qz_mc2('„YTD” znaczy…','“YTD” means…',[QZ_A('od początku roku'),QZ_B('od wczoraj'),QZ_C('od 6 miesięcy')],[QZ_A('year-to-date (since Jan 1)'),QZ_B('since yesterday'),QZ_C('since 6 months')],0),
      qz_mc2('„1Y” to…','“1Y” is…',[QZ_A('ostatni rok'),QZ_B('1 dzień'),QZ_C('1 miesiąc')],[QZ_A('last year'),QZ_B('1 day'),QZ_C('1 month')],0),
      qz_mc2('Wykres idzie w dół →','Chart goes down →',[QZ_A('cena spadała'),QZ_B('cena rosła'),QZ_C('nic nie wiemy')],[QZ_A('price was falling'),QZ_B('price was rising'),QZ_C('no info')],0),
      qz_mc2('Szybkie zmiany góra-dół to…','Fast up-down moves are…',[QZ_A('zmienność'),QZ_B('dywidenda'),QZ_C('podatek')],[QZ_A('volatility'),QZ_B('dividend'),QZ_C('tax')],0),
      qz_mc2('Płaska linia to zwykle…','A flatter line usually means…',[QZ_A('mniejsze wahania'),QZ_B('większe wahania'),QZ_C('brak danych')],[QZ_A('smaller swings'),QZ_B('bigger swings'),QZ_C('no data')],0),
      qz_mc2('Czy można przełączać zakresy?','Can you switch ranges?',[QZ_A('Tak, 1D/5D/…'),QZ_B('Nie'),QZ_C('Tylko w nocy')],[QZ_A('Yes, 1D/5D/…'),QZ_B('No'),QZ_C('Only at night')],0),
      qz_mc2('Wzrost z 10 do 12 to…','Rise from 10 to 12 is…',[QZ_A('+2'),QZ_B('−2'),QZ_C('0')],[QZ_A('+2'),QZ_B('−2'),QZ_C('0')],0),
      qz_mc2('Spadek z 8 do 6 to…','Drop from 8 to 6 is…',[QZ_A('−2'),QZ_B('+2'),QZ_C('0')],[QZ_A('−2'),QZ_B('+2'),QZ_C('0')],0),
      qz_mc2('Wykres =','A chart is…',[QZ_A('historia ceny w czasie'),QZ_B('lista zakupów'),QZ_C('PIN rodzica')],[QZ_A('price over time'),QZ_B('shopping list'),QZ_C('parent PIN')],0),
      qz_mc2('Przełączanie zakresu pomaga…','Changing the range helps…',[QZ_A('zobaczyć szerzej/ciaśniej'),QZ_B('zmienić walutę'),QZ_C('zmienić profil')],[QZ_A('zoom out/in'),QZ_B('change currency'),QZ_C('change profile')],0),
      qz_mc2('Krótszy zakres (1D) pokazuje…','Short range (1D) shows…',[QZ_A('więcej szczegółów dnia'),QZ_B('wynik roczny'),QZ_C('listę życzeń')],[QZ_A('more day details'),QZ_B('year result'),QZ_C('wishlist')],0),
      qz_mc2('Dłuższy zakres (1Y) pokazuje…','Long range (1Y) shows…',[QZ_A('trend w dłuższym czasie'),QZ_B('tylko dziś'),QZ_C('historia zakupów')],[QZ_A('long-term trend'),QZ_B('today only'),QZ_C('shop history')],0),
      qz_mc2('Jeśli w „1Y” cena jest wyżej niż start…','If in “1Y” price is above start…',
        [QZ_A('był wzrost w roku'),QZ_B('na pewno strata'),QZ_C('zawsze 0')],
        [QZ_A('it grew this year'),QZ_B('sure loss'),QZ_C('always 0')],0),
      qz_mc2('Nagły skok w górę to…','A sudden jump up is…',[QZ_A('duży wzrost szybko'),QZ_B('cisza'),QZ_C('zmiana języka')],[QZ_A('a big quick rise'),QZ_B('silence'),QZ_C('language change')],0),
      qz_mc2('Zmiana zakresu nic nie kupuje — to…','Changing range doesn’t buy — it’s…',
        [QZ_A('tylko podgląd'),QZ_B('płatność'),QZ_C('koszyk')],
        [QZ_A('just a view'),QZ_B('payment'),QZ_C('basket')],0),
      qz_mc2('Analiza wykresu + plan =','Chart + plan =',
        [QZ_A('mądrzejsze decyzje'),QZ_B('magia'),QZ_C('gratisy')],
        [QZ_A('smarter decisions'),QZ_B('magic'),QZ_C('freebies')],0)
    ];
    return { id:'charts', title:(lang==='pl'?'Wykresy i zakresy':'Charts & ranges'), questions:Q };
  }

  // 5) FX • basics
  function qz_bankFXBasics(lang){
    const bases = [
      ['EUR/PLN','EUR'],['USD/PLN','USD'],['GBP/PLN','GBP'],
      ['USD/EUR','USD'],['CHF/PLN','CHF'],['EUR/USD','EUR'],
      ['JPY/PLN','JPY'],['AUD/USD','AUD'],['CAD/PLN','CAD'],['EUR/GBP','EUR']
    ];
    const strength = [
      {pair:'EUR/PLN',from:4.00,to:4.20,pl:'PLN słabszy',en:'PLN weaker'},
      {pair:'EUR/PLN',from:4.20,to:4.00,pl:'PLN silniejszy',en:'PLN stronger'},
      {pair:'USD/PLN',from:3.90,to:4.10,pl:'PLN słabszy',en:'PLN weaker'},
      {pair:'USD/PLN',from:4.10,to:3.90,pl:'PLN silniejszy',en:'PLN stronger'},
      {pair:'EUR/USD',from:1.05,to:1.10,pl:'EUR silniejszy',en:'EUR stronger'},
      {pair:'EUR/USD',from:1.10,to:1.05,pl:'EUR słabszy',en:'EUR weaker'},
      {pair:'GBP/PLN',from:5.00,to:4.80,pl:'PLN silniejszy',en:'PLN stronger'},
      {pair:'GBP/PLN',from:4.80,to:5.00,pl:'PLN słabszy',en:'PLN weaker'},
      {pair:'CHF/PLN',from:4.40,to:4.20,pl:'PLN silniejszy',en:'PLN stronger'},
      {pair:'CHF/PLN',from:4.20,to:4.40,pl:'PLN słabszy',en:'PLN weaker'}
    ];
    const Q=[];
    bases.forEach(([pair,base])=>{
      Q.push(qz_mc2(
        `W parze ${pair} walutą bazową jest…`,
        `In pair ${pair} the base currency is…`,
        [QZ_A(base),QZ_B(pair.split('/')[1]),QZ_C('obie')],[QZ_A(base),QZ_B(pair.split('/')[1]),QZ_C('both')],0,
        'Pierwsza w parze = waluta bazowa.','First in pair = base currency.'
      ));
    });
    strength.forEach(s=>{
      Q.push(qz_mc2(
        `${s.pair} zmienia się z ${s.from} → ${s.to}. Co to znaczy?`,
        `${s.pair} moves from ${s.from} → ${s.to}. What does it mean?`,
        [QZ_A(s.pl),QZ_B('nic to nie znaczy'),QZ_C('zmiana języka')],
        [QZ_A(s.en),QZ_B('means nothing'),QZ_C('language change')],0
      ));
    });
    return { id:'fx-basics', title:(lang==='pl'?'FX • podstawy':'FX • basics'), questions:Q };
  }

  // 6) FX • easy math
  function qz_bankFXMath(lang){
    const calc = [
      {pair:'EUR/PLN', rate:4.00, askPL:'Ile PLN za 5 EUR?', askEN:'How many PLN for 5 EUR?', ans:20, alt:[18,22]},
      {pair:'EUR/PLN', rate:4.20, askPL:'Ile PLN za 3 EUR?', askEN:'How many PLN for 3 EUR?', ans:12.6, alt:[11.4,13.2]},
      {pair:'USD/PLN', rate:4.00, askPL:'Ile PLN za 2 USD?', askEN:'How many PLN for 2 USD?', ans:8, alt:[6,10]},
      {pair:'USD/PLN', rate:3.90, askPL:'Ile PLN za 10 USD?',askEN:'How many PLN for 10 USD?', ans:39, alt:[40,35]},
      {pair:'GBP/PLN', rate:5.00, askPL:'Ile PLN za 1 GBP?', askEN:'How many PLN for 1 GBP?', ans:5, alt:[4,6]},
      {pair:'EUR/USD', rate:1.10, askPL:'Ile USD za 4 EUR?', askEN:'How many USD for 4 EUR?', ans:4.4, alt:[4.0,4.8]},
      {pair:'EUR/USD', rate:1.05, askPL:'Ile USD za 10 EUR?',askEN:'How many USD for 10 EUR?', ans:10.5, alt:[9.5,11]},
      {pair:'CHF/PLN', rate:4.20, askPL:'Ile PLN za 2 CHF?', askEN:'How many PLN for 2 CHF?', ans:8.4, alt:[8.2,8.8]},
      {pair:'JPY/PLN', rate:0.028,askPL:'Ile PLN za 100 JPY?',askEN:'How many PLN for 100 JPY?',ans:2.8, alt:[2.0,3.2]},
      {pair:'AUD/USD', rate:0.70, askPL:'Ile USD za 5 AUD?', askEN:'How many USD for 5 AUD?', ans:3.5, alt:[3.0,4.0]},
      {pair:'EUR/PLN', rate:4.00, askPL:'Ile EUR za 20 PLN?', askEN:'How many EUR for 20 PLN?', ans:5, alt:[4,6]},
      {pair:'USD/PLN', rate:4.00, askPL:'Ile USD za 12 PLN?', askEN:'How many USD for 12 PLN?', ans:3, alt:[2,4]},
      {pair:'EUR/USD', rate:1.10, askPL:'Ile EUR za 5.5 USD?',askEN:'How many EUR for 5.5 USD?',ans:5, alt:[4,6]},
      {pair:'GBP/PLN', rate:5.00, askPL:'Ile GBP za 25 PLN?',askEN:'How many GBP for 25 PLN?', ans:5, alt:[4,6]},
      {pair:'CHF/PLN', rate:4.00, askPL:'Ile CHF za 8 PLN?', askEN:'How many CHF for 8 PLN?', ans:2, alt:[1,3]},
      {pair:'CAD/PLN', rate:3.00, askPL:'Ile CAD za 9 PLN?', askEN:'How many CAD for 9 PLN?', ans:3, alt:[2,4]},
      {pair:'EUR/PLN', rate:4.50, askPL:'Ile PLN za 2 EUR?', askEN:'How many PLN for 2 EUR?', ans:9, alt:[8,10]},
      {pair:'USD/PLN', rate:4.20, askPL:'Ile PLN za 5 USD?', askEN:'How many PLN for 5 USD?', ans:21, alt:[20,22]},
      {pair:'EUR/USD', rate:1.20, askPL:'Ile USD za 1 EUR?', askEN:'How many USD for 1 EUR?', ans:1.2, alt:[1.1,1.3]},
      {pair:'EUR/GBP', rate:0.85, askPL:'Ile GBP za 2 EUR?', askEN:'How many GBP for 2 EUR?', ans:1.7, alt:[1.6,1.8]}
    ];
    const Q = calc.map(c => qz_mc2(
      `${c.pair} = ${c.rate}. ${lang==='pl'?c.askPL:c.askEN}`,
      `${c.pair} = ${c.rate}. ${c.askEN}`,
      [QZ_A(String(c.ans)),QZ_B(String(c.alt[0])),QZ_C(String(c.alt[1]))],
      [QZ_A(String(c.ans)),QZ_B(String(c.alt[0])),QZ_C(String(c.alt[1]))],
      0,'Prosty mnożnik/dzielnik według kursu.','Multiply/divide by the rate.'
    ));
    return { id:'fx-math', title:(lang==='pl'?'FX • prosta matematyka':'FX • easy math'), questions:Q };
  }

  // 7) Risk & diversification
  function qz_bankRisk(lang){
    const Q = [
      qz_mc2('Rynek bywa…','Markets can be…',[QZ_A('zmienny'),QZ_B('zawsze stały'),QZ_C('nudny')],[QZ_A('volatile'),QZ_B('always fixed'),QZ_C('boring')],0),
      qz_mc2('Dywersyfikacja zmniejsza ryzyko, bo…','Diversification lowers risk because…',
        [QZ_A('nie wszystko zależy od 1 spółki'),QZ_B('zawsze podwaja zysk'),QZ_C('blokuje zakupy')],
        [QZ_A('not all depends on 1 stock'),QZ_B('always doubles profit'),QZ_C('blocks buys')],0),
      qz_mc2('Nie inwestujemy pieniędzy, które są…','Don’t invest money that is…',
        [QZ_A('potrzebne na ważne wydatki'),QZ_B('na prezent'),QZ_C('na zabawę')],
        [QZ_A('needed for important costs'),QZ_B('for gifts'),QZ_C('for toys')],0),
      qz_mc2('Plan i budżet pomagają…','A plan and budget help…',
        [QZ_A('kontrolować ryzyko'),QZ_B('magicznie wygrywać'),QZ_C('wyłączyć internet')],
        [QZ_A('control risk'),QZ_B('win by magic'),QZ_C('turn off internet')],0),
      qz_mc2('Krótkie skoki cen to…','Short price jumps are…',
        [QZ_A('normalne wahania'),QZ_B('błąd aplikacji'),QZ_C('zawsze panika')],
        [QZ_A('normal swings'),QZ_B('an app error'),QZ_C('always panic')],0),
      qz_mc2('Emocje mogą…','Emotions can…',
        [QZ_A('psuć decyzje'),QZ_B('poprawiać kurs'),QZ_C('usuwać opłaty')],
        [QZ_A('hurt decisions'),QZ_B('fix prices'),QZ_C('remove fees')],0),
      qz_mc2('Długi horyzont…','A long horizon…',
        [QZ_A('pomaga przeczekać wahania'),QZ_B('blokuje rezultaty'),QZ_C('zmienia walutę')],
        [QZ_A('helps ride out swings'),QZ_B('blocks results'),QZ_C('changes currency')],0),
      qz_mc2('Małe kwoty na start to…','Small amounts to start are…',
        [QZ_A('bezpieczniejsze'),QZ_B('tajny cheat'),QZ_C('nowy PIN')],
        [QZ_A('safer'),QZ_B('a secret cheat'),QZ_C('a new PIN')],0),
      qz_mc2('Czy zysk jest gwarantowany?','Is profit guaranteed?',
        [QZ_A('Nie'),QZ_B('Tak'),QZ_C('Tak, w środy')],
        [QZ_A('No'),QZ_B('Yes'),QZ_C('Yes, on Wednesdays')],0),
      qz_mc2('Najważniejsze jest…','Most important is…',
        [QZ_A('rozumieć co kupujesz'),QZ_B('kopiować kolegę'),QZ_C('klikać losowo')],
        [QZ_A('understand what you buy'),QZ_B('copy a friend'),QZ_C('click random')],0),
      qz_mc2('Zbyt piękne obietnice…','If it sounds too good…',
        [QZ_A('bądź ostrożny'),QZ_B('kup podwójnie'),QZ_C('sprzedaj słoiki')],
        [QZ_A('be careful'),QZ_B('buy double'),QZ_C('sell jars')],0),
      qz_mc2('All-in w jedną rzecz to…','Going all-in on one thing is…',
        [QZ_A('duże ryzyko'),QZ_B('bez ryzyka'),QZ_C('wymóg aplikacji')],
        [QZ_A('high risk'),QZ_B('no risk'),QZ_C('an app rule')],0),
      qz_mc2('Ucz się na małych kwotach, bo…','Learn with small amounts because…',
        [QZ_A('łatwiej naprawić błąd'),QZ_B('będzie nudno'),QZ_C('wykres nie działa')],
        [QZ_A('mistakes cost less'),QZ_B('it’s boring'),QZ_C('charts break')],0),
      qz_mc2('Ryzyko i nagroda są…','Risk and reward are…',
        [QZ_A('często powiązane'),QZ_B('niezależne'),QZ_C('losowe')],
        [QZ_A('often linked'),QZ_B('independent'),QZ_C('random')],0),
      qz_mc2('Paper trading pozwala…','Paper trading lets you…',
        [QZ_A('trenować bez prawdziwych pieniędzy'),QZ_B('zarobić odsetki'),QZ_C('zmienić PIN')],
        [QZ_A('practice without real money'),QZ_B('earn interest'),QZ_C('change PIN')],0),
      qz_mc2('Cierpliwość w inwestowaniu jest…','Patience in investing is…',
        [QZ_A('bardzo ważna'),QZ_B('niepotrzebna'),QZ_C('zabroniona')],
        [QZ_A('very important'),QZ_B('useless'),QZ_C('forbidden')],0),
      qz_mc2('Jeśli nie rozumiesz instrumentu…','If you don’t understand an asset…',
        [QZ_A('najpierw poznaj, nie kupuj'),QZ_B('kup dla testu'),QZ_C('proś o spoiler')],
        [QZ_A('learn first, don’t buy yet'),QZ_B('buy to test'),QZ_C('ask for spoiler')],0),
      qz_mc2('Regularne przeglądy portfela…','Regular portfolio reviews…',
        [QZ_A('utrzymują porządek'),QZ_B('psują wyniki'),QZ_C('kasują historię')],
        [QZ_A('keep things tidy'),QZ_B('ruin results'),QZ_C('delete history')],0),
      qz_mc2('Cele (np. „rower w wakacje”) pomagają…','Goals (e.g., “bike in summer”) help…',
        [QZ_A('trzymać plan'),QZ_B('przewidzieć przyszłość'),QZ_C('ominąć budżet')],
        [QZ_A('stick to the plan'),QZ_B('predict the future'),QZ_C('skip budget')],0),
      qz_mc2('Nie ma wstydu w…','There’s no shame in…',
        [QZ_A('pytaniu i nauce'),QZ_B('udawaniu eksperta'),QZ_C('tajnym hazardzie')],
        [QZ_A('asking and learning'),QZ_B('pretending expert'),QZ_C('secret gambling')],0)
    ];
    return { id:'risk', title:(lang==='pl'?'Ryzyko i dywersyfikacja':'Risk & diversification'), questions:Q };
  }

  // 8) Watchlist & basket
  function qz_bankWatchlistBasket(lang){
    const Q = [
      qz_mc2('Watchlist to…','Watchlist is…',[QZ_A('lista obserwowanych'),QZ_B('historia sprzedaży'),QZ_C('PIN')],[QZ_A('your tracking list'),QZ_B('sales history'),QZ_C('PIN')],0),
      qz_mc2('Do watchlisty dodajemy…','We add to watchlist…',[QZ_A('spółki i pary FX'),QZ_B('zdjęcia'),QZ_C('kontakty')],[QZ_A('stocks and FX pairs'),QZ_B('photos'),QZ_C('contacts')],0),
      qz_mc2('Filtr „Stocks / Currencies / All” zmienia…','The “Stocks / Currencies / All” filter changes…',
        [QZ_A('co widzisz na liście'),QZ_B('język'),QZ_C('wysokość słoików')],
        [QZ_A('what you see on list'),QZ_B('language'),QZ_C('jar height')],0),
      qz_mc2('Karta w watchliście pokazuje…','A watchlist card shows…',[QZ_A('cenę/kurs i szybkie info'),QZ_B('PIN'),QZ_C('regulamin')],[QZ_A('price/rate and quick info'),QZ_B('PIN'),QZ_C('rules')],0),
      qz_mc2('Klik karty…','Clicking card…',[QZ_A('otwiera szczegóły + duży wykres'),QZ_B('kupuje'),QZ_C('zamyka appkę')],[QZ_A('opens details + big chart'),QZ_B('buys'),QZ_C('closes app')],0),
      qz_mc2('Koszyk (Basket) służy do…','Basket is for…',[QZ_A('zbierania pozycji przed zakupem'),QZ_B('zmiany motywu'),QZ_C('czatu')],[QZ_A('collecting items before buy'),QZ_B('theme change'),QZ_C('chat')],0),
      qz_mc2('„Add to basket”…','“Add to basket”…',[QZ_A('dodaje transakcję do koszyka'),QZ_B('usuwa watchlistę'),QZ_C('otwiera tutorial')],[QZ_A('adds the trade to basket'),QZ_B('deletes watchlist'),QZ_C('opens tutorial')],0),
      qz_mc2('„Quantity” w koszyku to…','“Quantity” in basket is…',[QZ_A('ile sztuk/kwoty kupujesz'),QZ_B('jaki region'),QZ_C('który język')],[QZ_A('how many units you buy'),QZ_B('which region'),QZ_C('which language')],0),
      qz_mc2('„Buy (investment cash)”…','“Buy (investment cash)”…',[QZ_A('kupuje za środki inwestycyjne'),QZ_B('sprzedaje wszystko'),QZ_C('zmienia PIN')],[QZ_A('buys using investment cash'),QZ_B('sells all'),QZ_C('changes PIN')],0),
      qz_mc2('Koszyk FX i koszyk Akcji są…','FX and Stocks baskets are…',[QZ_A('oddzielne'),QZ_B('tym samym koszykiem'),QZ_C('ukryte')],[QZ_A('separate'),QZ_B('the same'),QZ_C('hidden')],0),
      qz_mc2('Po zakupie pozycja…','After buying the item…',[QZ_A('znika z koszyka i trafia do portfela'),QZ_B('pojawia się w tutorialu'),QZ_C('znika z aplikacji')],[QZ_A('leaves basket and goes to portfolio'),QZ_B('goes to tutorial'),QZ_C('vanishes')],0),
      qz_mc2('W koszyku widać…','In basket you see…',[QZ_A('sumę ilości i kwotę'),QZ_B('PIN'),QZ_C('tylko obrazek')],[QZ_A('total qty and amount'),QZ_B('PIN'),QZ_C('picture only')],0),
      qz_mc2('Watchlist nie kupuje — to…','Watchlist doesn’t buy — it’s…',[QZ_A('tylko obserwacja'),QZ_B('magiczny sklep'),QZ_C('chat')],[QZ_A('just tracking'),QZ_B('magic shop'),QZ_C('chat')],0),
      qz_mc2('Możesz mieć w koszyku…','You can have in basket…',[QZ_A('kilka różnych pozycji'),QZ_B('tylko jedną'),QZ_C('zero i nic więcej')],[QZ_A('several different items'),QZ_B('only one'),QZ_C('zero forever')],0),
      qz_mc2('Usunięcie z koszyka…','Removing from basket…',[QZ_A('to nie sprzedaż z portfela'),QZ_B('kasuje portfel'),QZ_C('zmienia język')],[QZ_A('is not selling from portfolio'),QZ_B('deletes portfolio'),QZ_C('changes language')],0),
      qz_mc2('„X” w oknach zwykle…','The “X” in dialogs usually…',[QZ_A('zamyka okno'),QZ_B('kupuje'),QZ_C('dodaje do watchlisty')],[QZ_A('closes the window'),QZ_B('buys'),QZ_C('adds to watchlist')],0),
      qz_mc2('Gdy nie masz Investment cash…','If you have no Investment cash…',[QZ_A('nie kupisz — doładuj słoiki'),QZ_B('kupisz i tak'),QZ_C('appka płaci za Ciebie')],[QZ_A('you can’t buy — top up'),QZ_B('you still buy'),QZ_C('the app pays')],0),
      qz_mc2('Sort w liście instrumentów pomaga…','Sorting the list helps…',[QZ_A('ułożyć wg ceny/kursu'),QZ_B('zmienić PIN'),QZ_C('otworzyć YouTube')],[QZ_A('order by price/rate'),QZ_B('change PIN'),QZ_C('open YouTube')],0),
      qz_mc2('Wyszukiwarka (search) pozwala…','Search lets you…',[QZ_A('szybko znaleźć instrument'),QZ_B('zmienić region'),QZ_C('zmienić kolor')],[QZ_A('find an instrument fast'),QZ_B('change region'),QZ_C('change color')],0),
      qz_mc2('To Ty decydujesz — appka…','You decide — the app…',[QZ_A('nic nie kupuje sama'),QZ_B('kupuje o północy'),QZ_C('pyta sąsiada')],[QZ_A('never buys by itself'),QZ_B('buys at midnight'),QZ_C('asks a neighbor')],0)
    ];
    return { id:'wl-basket', title:(lang==='pl'?'Watchlist i koszyk':'Watchlist & basket'), questions:Q };
  }

  // 9) P/L & averages
  function qz_bankPnL(lang){
    const Q = [
      qz_mc2('„Unrealized P/L” to…','“Unrealized P/L” is…',
        [QZ_A('wynik na pozycjach niesprzedanych'),QZ_B('wynik po sprzedaży'),QZ_C('opłata')],
        [QZ_A('result on not-sold positions'),QZ_B('after selling'),QZ_C('a fee')],0),
      qz_mc2('„Realized P/L” to…','“Realized P/L” is…',
        [QZ_A('wynik po sprzedaży'),QZ_B('wynik na żywo'),QZ_C('kurs waluty')],
        [QZ_A('result after selling'),QZ_B('live only'),QZ_C('FX rate')],0),
      qz_mc2('Średni koszt rośnie, gdy…','Average cost goes up when…',
        [QZ_A('dokupisz drożej'),QZ_B('nic nie robisz'),QZ_C('zmienisz język')],
        [QZ_A('you add at higher price'),QZ_B('you do nothing'),QZ_C('you change language')],0),
      qz_mc2('Średni koszt spada, gdy…','Average cost drops when…',
        [QZ_A('dokupisz taniej'),QZ_B('kupisz drożej'),QZ_C('zjesz obiad')],
        [QZ_A('you add cheaper'),QZ_B('you buy higher'),QZ_C('you eat lunch')],0),
      qz_mc2('P/L liczymy mniej więcej jako…','P/L is roughly…',
        [QZ_A('wartość teraz − koszt'),QZ_B('koszt − 1'),QZ_C('zawsze 0')],
        [QZ_A('value now − cost'),QZ_B('cost − 1'),QZ_C('always 0')],0),
      qz_mc2('Net Worth to…','Net Worth is…',
        [QZ_A('słoiki + portfele'),QZ_B('tylko słoiki'),QZ_C('tylko FX')],
        [QZ_A('jars + portfolios'),QZ_B('jars only'),QZ_C('FX only')],0),
      qz_mc2('Sprzedaż przenosi wynik do…','Selling moves result to…',
        [QZ_A('Realized P/L'),QZ_B('Unrealized P/L'),QZ_C('Tutorial')],
        [QZ_A('Realized P/L'),QZ_B('Unrealized P/L'),QZ_C('Tutorial')],0),
      qz_mc2('Gdy cena = cena zakupu, P/L jest…','If price = buy price, P/L is…',
        [QZ_A('około 0'),QZ_B('+10'),QZ_C('−10')],[QZ_A('about 0'),QZ_B('+10'),QZ_C('−10')],0),
      qz_mc2('Wartość pozycji akcji =','Stock position value =',
        [QZ_A('cena × liczba akcji'),QZ_B('cena + ilość'),QZ_C('ilość − 1')],
        [QZ_A('price × shares'),QZ_B('price + qty'),QZ_C('qty − 1')],0),
      qz_mc2('Wartość pozycji FX liczona jest…','FX position value is…',
        [QZ_A('wg bieżącego kursu'),QZ_B('losowo'),QZ_C('1:1 zawsze')],
        [QZ_A('by current rate'),QZ_B('randomly'),QZ_C('always 1:1')],0),
      qz_mc2('Historia sprzedaży zawiera…','Sales history includes…',
        [QZ_A('datę, ilość, cenę, P/L'),QZ_B('tylko obrazek'),QZ_C('PIN')],
        [QZ_A('date, qty, price, P/L'),QZ_B('only a picture'),QZ_C('PIN')],0),
      qz_mc2('Możesz mieć zysk na jednej, stratę na innej?','Profit on one, loss on another?',
        [QZ_A('Tak'),QZ_B('Nie'),QZ_C('Tylko w piątek')],
        [QZ_A('Yes'),QZ_B('No'),QZ_C('Only on Friday')],0),
      qz_mc2('Duży wynik dziś nie oznacza…','A big result today doesn’t mean…',
        [QZ_A('tego samego jutro'),QZ_B('wygranej w loterii'),QZ_C('zmiany regionu')],
        [QZ_A('the same tomorrow'),QZ_B('lottery win'),QZ_C('region change')],0),
      qz_mc2('„Amount” w koszyku to…','“Amount” in basket is…',
        [QZ_A('łączny koszt planowanych zakupów'),QZ_B('zawsze 0'),QZ_C('PIN')],
        [QZ_A('total cost of planned buys'),QZ_B('always 0'),QZ_C('PIN')],0),
      qz_mc2('Po sprzedaży gotówka trafia do…','After a sale, cash goes to…',
        [QZ_A('Investment cash'),QZ_B('Gifts'),QZ_C('Savings zawsze')],
        [QZ_A('Investment cash'),QZ_B('Gifts'),QZ_C('always Savings')],0),
      qz_mc2('„Qty” w historii znaczy…','“Qty” in history means…',
        [QZ_A('ile sztuk/kwoty'),QZ_B('jaki region'),QZ_C('który wykres')],
        [QZ_A('how many units'),QZ_B('which region'),QZ_C('which chart')],0),
      qz_mc2('P/L w FX zależy od…','FX P/L depends on…',
        [QZ_A('różnicy kursów'),QZ_B('pory dnia'),QZ_C('motywu')],
        [QZ_A('rate differences'),QZ_B('time of day'),QZ_C('theme')],0),
      qz_mc2('Jeśli nie masz pozycji — unrealized P/L…','If you have no position — unrealized P/L…',
        [QZ_A('nie występuje'),QZ_B('jest ogromny'),QZ_C('zawsze −1')],
        [QZ_A('doesn’t exist'),QZ_B('is huge'),QZ_C('is always −1')],0),
      qz_mc2('Śledzenie P/L pomaga…','Tracking P/L helps…',
        [QZ_A('uczyć się na danych'),QZ_B('zgubić budżet'),QZ_C('zmienić PIN')],
        [QZ_A('learn from data'),QZ_B('lose budget'),QZ_C('change PIN')],0)
    ];
    return { id:'pnl', title:(lang==='pl'?'P/L i średnie':'P/L & averages'), questions:Q };
  }

  // 10) Safety & smart habits
  function qz_bankSafety(lang){
    const Q = [
      qz_mc2('PIN rodzica…','Parent PIN…',[QZ_A('nie udostępniaj nikomu'),QZ_B('pisz na tablicy'),QZ_C('wysyłaj w czacie')],[QZ_A('don’t share with anyone'),QZ_B('write on a board'),QZ_C('send in chat')],0),
      qz_mc2('Nie inwestuj prawdziwych pieniędzy bez…','Don’t invest real money without…',[QZ_A('zgody dorosłego'),QZ_B('memów'),QZ_C('losowania')],[QZ_A('adult permission'),QZ_B('memes'),QZ_C('a lottery')],0),
      qz_mc2('Paper trading w nauce jest…','Paper trading for learning is…',[QZ_A('bezpieczne i pomocne'),QZ_B('zakazane'),QZ_C('bezużyteczne')],[QZ_A('safe and helpful'),QZ_B('forbidden'),QZ_C('useless')],0),
      qz_mc2('Ustaw budżet, bo…','Set a budget because…',[QZ_A('chroni kieszonkowe'),QZ_B('wygrywa zawody'),QZ_C('zmienia kurs')],[QZ_A('it protects your cash'),QZ_B('wins contests'),QZ_C('changes rates')],0),
      qz_mc2('Czytaj i pytaj, gdy…','Read and ask when…',[QZ_A('czegoś nie rozumiesz'),QZ_B('wszyscy kupują'),QZ_C('masz drzemkę')],[QZ_A('you don’t understand'),QZ_B('everyone buys'),QZ_C('you nap')],0),
      qz_mc2('Gorące „tipy” z netu…','Hot tips online…',[QZ_A('traktuj z dystansem'),QZ_B('zawsze prawdziwe'),QZ_C('gwarantują zysk')],[QZ_A('treat carefully'),QZ_B('always true'),QZ_C('guarantee profit')],0),
      qz_mc2('Historia to nie gwarancja…','Past is not a guarantee of…',[QZ_A('przyszłych wyników'),QZ_B('koloru wykresu'),QZ_C('udziału w loterii')],[QZ_A('future results'),QZ_B('chart color'),QZ_C('lottery entry')],0),
      qz_mc2('Zabezpieczaj urządzenie…','Secure your device…',[QZ_A('hasłem/biometrią'),QZ_B('taśmą'),QZ_C('otwartym hasłem')],[QZ_A('with password/biometrics'),QZ_B('with tape'),QZ_C('with open password')],0),
      qz_mc2('„Buy” naprawdę…','“Buy” really…',[QZ_A('kupuje'),QZ_B('robi screen'),QZ_C('zmienia język')],[QZ_A('buys'),QZ_B('takes a screenshot'),QZ_C('changes language')],0),
      qz_mc2('Rozmawiaj z rodzicem o…','Talk with a parent about…',[QZ_A('celach i planie'),QZ_B('tajnych zakładach'),QZ_C('PIN-ie do banku')],[QZ_A('goals and plan'),QZ_B('secret bets'),QZ_C('bank PIN')],0),
      qz_mc2('Notuj wnioski, bo…','Write notes because…',[QZ_A('pamięć bywa ulotna'),QZ_B('to mem'),QZ_C('appka nie lubi notatek')],[QZ_A('memory fades'),QZ_B('it’s a meme'),QZ_C('app hates notes')],0),
      qz_mc2('Regularne przerwy…','Regular breaks…',[QZ_A('pomagają myśleć jasno'),QZ_B('psują wyniki'),QZ_C('blokują buy')],[QZ_A('help clear thinking'),QZ_B('ruin results'),QZ_C('block buy')],0),
      qz_mc2('Zaufane źródła wiedzy to…','Trusted sources are…',[QZ_A('materiały, rodzice, nauczyciele'),QZ_B('anonimowe komentarze'),QZ_C('magiczne reklamy')],[QZ_A('learning materials, parents, teachers'),QZ_B('anonymous comments'),QZ_C('magic ads')],0),
      qz_mc2('Cele SMART są…','SMART goals are…',[QZ_A('konkretne i mierzalne'),QZ_B('tajne i losowe'),QZ_C('magiczne')],[QZ_A('specific and measurable'),QZ_B('secret and random'),QZ_C('magic')],0),
      qz_mc2('Małe kroki →','Small steps →',[QZ_A('mądrzejsza nauka'),QZ_B('szybki hazard'),QZ_C('więcej losu')],[QZ_A('smarter learning'),QZ_B('quick gambling'),QZ_C('more luck')],0),
      qz_mc2('Zanim klikniesz — sprawdź…','Before clicking — check…',[QZ_A('ilość, cenę/kurs, koszyk'),QZ_B('pogodę'),QZ_C('kolor tła')],[QZ_A('qty, price/rate, basket'),QZ_B('weather'),QZ_C('background')],0),
      qz_mc2('Nie każda okazja jest dla Ciebie — ważne są…','Not every opportunity is for you — important are…',
        [QZ_A('Twoje cele i budżet'),QZ_B('plotki'),QZ_C('złote reklamy')],
        [QZ_A('your goals and budget'),QZ_B('gossip'),QZ_C('golden ads')],0),
      qz_mc2('Plan „co zrobię, gdy spadnie/urośnie” to…','A plan “what if it falls/rises” is…',
        [QZ_A('dobre przygotowanie'),QZ_B('zabobon'),QZ_C('nakaz')],
        [QZ_A('good preparation'),QZ_B('superstition'),QZ_C('a mandate')],0),
      qz_mc2('Pytaj, ucz się, testuj — to…','Ask, learn, test — that’s…',
        [QZ_A('sekret postępów'),QZ_B('trik na skróty'),QZ_C('zbędne')],
        [QZ_A('the secret of progress'),QZ_B('a shortcut trick'),QZ_C('useless')],0),
      qz_mc2('Szanuj pieniądze — to…','Respect money — it’s…',
        [QZ_A('narzędzie do celów'),QZ_B('gra bez zasad'),QZ_C('magiczna moneta')],
        [QZ_A('a tool for goals'),QZ_B('a rule-less game'),QZ_C('a magic coin')],0)
    ];
    return { id:'safety', title:(lang==='pl'?'Bezpieczeństwo i dobre nawyki':'Safety & smart habits'), questions:Q };
  }

  function qz_makeBANKS(lang){
    return [
      qz_bankBasicsApp(lang),
      qz_bankStocksMath(lang),
      qz_bankStockConcepts(lang),
      qz_bankCharts(lang),
      qz_bankFXBasics(lang),
      qz_bankFXMath(lang),
      qz_bankRisk(lang),
      qz_bankWatchlistBasket(lang),
      qz_bankPnL(lang),
      qz_bankSafety(lang)
    ];
  }

  // ---------- STATE + RENDER ----------
  const QZ = {
    host:null, lang:getLang(),
    BANKS: qz_makeBANKS(getLang()),
    mode:'home', bank:null, qs:[], idx:0, score:0,

    mount(){
      this.host = document.getElementById('ai-quiz-wrap');
      if (!this.host) return;
      this.BANKS = qz_makeBANKS(this.lang);
      this.home();
      // kompatybilność z przyciskiem w UI Play
      const sbtn = document.getElementById('ai-quiz-start');
      if (sbtn && !sbtn._wired){ sbtn.addEventListener('click', ()=> this.home()); sbtn._wired = true; }
    },

    home(){
      this.mode='home';
      const opts = this.BANKS.map((b,i)=>`<option value="${i}">${b.title} — 20Q</option>`).join('');
      this.host.innerHTML = `
        <div class="quiz-home" style="display:flex;flex-direction:column;gap:8px">
          <div class="title" style="font-weight:800">${qz_t('homeTitle')}</div>
          <div class="sub" style="opacity:.8">${qz_t('homeSub')}</div>
          <div class="row" style="display:flex;gap:8px;align-items:center">
            <select id="qzPick" style="flex:1;background:#0b1324;border:1px solid #334155;color:#e5e7eb;border-radius:10px;height:32px;padding:0 8px">${opts}</select>
            <button id="qzGo" class="abtn">${qz_t('start')}</button>
            <button id="qzRand" class="abtn">${qz_t('random')}</button>
          </div>
        </div>`;
      this.host.querySelector('#qzGo').addEventListener('click', ()=>{
        const i = +this.host.querySelector('#qzPick').value || 0; this.start(i);
      });
      this.host.querySelector('#qzRand').addEventListener('click', ()=> this.start(Math.floor(Math.random()*this.BANKS.length)));
    },

    start(i){
      this.bank = this.BANKS[i];
      this.qs = this.bank.questions.slice(0,20);
      this.idx = 0; this.score = 0; this.mode='q';
      this.renderQ();
    },

    renderQ(){
      this.mode='q';
      const q = this.qs[this.idx]; const n = this.idx+1; const L=this.lang;
      const choices = (q.choices[L]||q.choices.en).map((t,j)=>(
        `<button class="abtn" data-i="${j}" style="justify-content:flex-start">${t}</button>`
      )).join('');
      this.host.innerHTML = `
        <div class="quiz-q" style="display:flex;flex-direction:column;gap:8px">
          <div class="muted" style="opacity:.8">${this.bank.title} — ${qz_t('qOf')} ${n}/20</div>
          <div class="title" style="font-weight:700">${q.q[L]||q.q.en}</div>
          <div class="space" style="display:flex;flex-direction:column;gap:6px">${choices}</div>
          <div id="qzMsg" class="sub" style="min-height:22px;opacity:.95"></div>
          <div class="row" style="display:flex;gap:8px">
            <button id="qzSkip" class="abtn">${qz_t('skip')}</button>
            <button id="qzStop" class="abtn" style="background:#1f2937">${qz_t('stop')}</button>
          </div>
        </div>`;
      this.host.querySelectorAll('.abtn[data-i]').forEach(b=> b.addEventListener('click', (e)=> this.onPick(+e.currentTarget.dataset.i)));
      this.host.querySelector('#qzSkip').addEventListener('click', ()=> this.next());
      this.host.querySelector('#qzStop').addEventListener('click', ()=> this.finish());
    },

    onPick(pick){
      const q = this.qs[this.idx];
      const ok = pick===q.a; if (ok) this.score++;
      const msg = this.host.querySelector('#qzMsg');
      const L=this.lang;
      if (msg) msg.textContent = (ok ? qz_t('good') : qz_t('almost')) + (q.explain[L]||q.explain.en||'');
      setTimeout(()=> this.next(), 700);
    },

    next(){
      this.idx++;
      if (this.idx>=20) this.finish(); else this.renderQ();
    },

    finish(){
      this.mode='done';
      const pct = Math.round(100*this.score/20);
      this.host.innerHTML = `
        <div class="quiz-done" style="display:flex;flex-direction:column;gap:8px">
          <div class="title" style="font-weight:800">${qz_t('score')}: ${this.score}/20 (${pct}%)</div>
          <div class="sub" style="opacity:.9">${qz_msgByPct(pct)}</div>
          <div class="row" style="display:flex;gap:8px">
            <button id="qzAgain" class="abtn" style="background:#1f2937">${qz_t('again')}</button>
            <button id="qzHome"  class="abtn">${qz_t('choose')}</button>
          </div>
        </div>`;
      this.host.querySelector('#qzAgain').addEventListener('click', ()=> this.start(Math.floor(Math.random()*this.BANKS.length)));
      this.host.querySelector('#qzHome').addEventListener('click', ()=> this.home());
    },

    refreshLang(){
      const newLang = getLang();
      if (newLang === this.lang) return;
      this.lang = newLang;
      this.BANKS = qz_makeBANKS(this.lang);
      if (!this.host) this.host = document.getElementById('ai-quiz-wrap');
      if (!this.host) return;
      if (this.mode==='home') this.home();
      else if (this.mode==='q') this.renderQ();
      else if (this.mode==='done') this.finish();
    }
  };

  // --- HOOKI kompatybilne z Twoim agentem ---
  // (1) Komenda czatu: "start quiz" wywołuje to samo API
  window.startQuiz = function(){ switchTab('play'); QZ.mount(); };

  // (2) Funkcja wołana przy otwarciu panelu i przy zmianie języka
  window.renderQuiz = function(){ QZ.refreshLang(); if (!QZ.host) QZ.mount(); };

  // (3) Jeżeli gdzieś masz lokalny przycisk #ai-quiz-start, dociągniemy go po mount
  // (obsłużone w QZ.mount).

})();


  /* ========== Missions ========== */
  const MISSIONS = { pl:[{id:'watch-1w', title:'Obserwuj tydzień', text:'Wykres 1W i opisz trend.'}], en:[{id:'watch-1w', title:'Watch 1W', text:'Open 1W chart and describe.'}] };

  /* ========== Panel + FAB ========== */
  function removeOldRobots(){ $$('.ai-agent-btn, #aiAgentBtn').forEach(el=>el.remove()); }
  function makeFab(){ const b=document.createElement('button'); b.id='ai-fab'; b.setAttribute('aria-label','AI'); b.textContent='AI'; b.style.cssText="position:fixed;right:18px;bottom:18px;z-index:2147483646;width:56px;height:56px;border-radius:999px;border:0;box-shadow:0 10px 28px rgba(2,8,23,.45);cursor:pointer;background:linear-gradient(135deg,#60a5fa,#22c55e);color:#081225;font-weight:900;font-size:18px;pointer-events:auto;user-select:none"; return b; }
  function ensureFab(){ let b=$('#ai-fab'); if(!b){ b=makeFab(); document.body.appendChild(b); } const open = (e)=>{ e.preventDefault(); ensurePanel(); }; b.replaceWith(b.cloneNode(true)); b=$('#ai-fab'); b.addEventListener('click', open, {capture:true}); b.addEventListener('pointerup', open, {capture:true}); }

  /* ====== Panel with Tabs (Chat/Learn/Tutorials/Play) ====== */
  function ensurePanel(){
    const existing = $('#ai-agent');
    if (existing){ const hidden = existing.style.display==='none'; existing.style.display = hidden ? 'block' : 'none'; if(!hidden) stopSpeak(); return; }
    const lang=getLang();
    const root=document.createElement('div'); root.id='ai-agent'; root.style.cssText="position:fixed;right:18px;bottom:18px;z-index:2147483647;font-family:inherit;color:#e5e7eb";

    const [tabChat, tabLearn, tabTour, tabPlay] = UI.tabs[lang];

    root.innerHTML=`
      <div style="width:min(460px,94vw);max-height:min(80vh,720px);background:rgba(8,12,22,.94);border:1px solid rgba(255,255,255,.08);border-radius:12px;box-shadow:0 12px 36px rgba(2,8,23,.55);display:flex;flex-direction:column;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;gap:10px;border-bottom:1px solid rgba(255,255,255,.08)">
          <div style="min-width:0">
            <div id="ai-t" style="font-weight:800;line-height:1">${UI.title[lang]}</div>
            <div id="ai-st" style="font-size:11px;opacity:.8;line-height:1.2">${UI.subtitle[lang]}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:nowrap;align-items:center;white-space:nowrap">
            <button id="ai-read" class="abtn abtn--xs">${UI.read[lang]}</button>
            <button id="ai-stop" class="abtn abtn--xs">${UI.stop[lang]}</button>
            <button id="ai-x" class="abtn abtn--icon" aria-label="Close">×</button>
          </div>
        </div>

        <div style="display:flex;gap:4px;padding:8px 8px 0 8px">
          <button class="ai-tab t--active" data-aitab="chat">${tabChat}</button>
          <button class="ai-tab" data-aitab="learn">${tabLearn}</button>
          <button class="ai-tab" data-aitab="tuts">${tabTour}</button>
          <button class="ai-tab" data-aitab="play">${tabPlay}</button>
          <div style="flex:1"></div>
          <button id="ai-tour" class="abtn abtn--xs">${UI.tour[lang]}</button>
        </div>

        <!-- CHAT -->
        <div class="ai-pane" data-aipane="chat" style="display:block;padding:8px">
          <div id="ai-cta" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            <button id="ai-explain" class="abtn">${UI.quick[lang][0]}</button>
            <button id="ai-price"   class="abtn">${UI.quick[lang][1]}</button>
            <button id="ai-rebal"   class="abtn">${UI.quick[lang][2]}</button>
            <button id="ai-quiz"    class="abtn">${UI.quick[lang][3]}</button>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:8px">
            <input id="ai-input" placeholder="${UI.ph[lang]}" style="flex:1;padding:9px 10px;border-radius:10px;border:1px solid #334155;background:#0b1324;color:#e5e7eb;font-size:13px" />
            <button id="ai-send" class="abtn abtn--sm">${UI.send[lang]}</button>
          </div>
          <div id="ai-log" style="border:1px dashed rgba(255,255,255,.12);border-radius:10px;padding:10px;font-size:13px;min-height:96px;max-height:42vh;overflow:auto;white-space:pre-wrap"></div>
          <div id="ai-toast" style="position:absolute;right:26px;bottom:88px;pointer-events:none"></div>
        </div>

        <!-- LEARN -->
        <div class="ai-pane" data-aipane="learn" style="display:none;padding:8px">
          <div style="font-size:12px;opacity:.8;margin:2px 0 8px">${UI.learnHead[lang]}</div>
          <div id="ai-learn" style="display:grid;grid-template-columns:1fr;gap:8px;max-height:44vh;overflow:auto"></div>
        </div>

        <!-- TUTORIALS -->
        <div class="ai-pane" data-aipane="tuts" style="display:none;padding:8px">
          <div style="font-size:12px;opacity:.8;margin:2px 0 8px">${UI.tutHead[lang]}</div>
          <div id="ai-tuts" style="display:grid;grid-template-columns:1fr;gap:8px">
            <button class="abtn abtn--w" data-tour="onboarding">Onboarding</button>
            <button class="abtn abtn--w" data-tour="topbar">Top Bar → Mini Jars → KPIs</button>
            <button class="abtn abtn--w" data-tour="markets">Stocks & FX</button>
            <button class="abtn abtn--w" data-tour="basket">Basket → Buy flow</button>
            <button class="abtn abtn--w" data-tour="portfolio">Portfolio & P/L</button>
          </div>
        </div>

        <!-- PLAY -->
        <div class="ai-pane" data-aipane="play" style="display:none;padding:8px">
          <div style="font-size:12px;opacity:.8;margin:2px 0 8px">${UI.playHead[lang]}</div>
          <div id="ai-quiz-wrap" style="border:1px solid #334155;border-radius:10px;padding:10px;background:#0b1324;margin-bottom:10px">
            <div id="ai-quiz-q" style="font-weight:700;margin-bottom:8px"></div>
            <div id="ai-quiz-a" style="display:grid;gap:6px"></div>
            <div id="ai-quiz-meta" style="font-size:12px;opacity:.8;margin-top:6px"></div>
            <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
              <button id="ai-quiz-start" class="abtn abtn--xs">Start quiz</button>
              <div id="ai-quiz-score" style="font-size:12px;opacity:.9"></div>
            </div>
          </div>
          <div id="ai-missions" style="display:grid;gap:8px"></div>
        </div>
      </div>`;

    // styles
    root.querySelectorAll('.abtn').forEach(b=>{ b.style.cssText += ';color:#e5e7eb;border-radius:10px;padding:8px 10px;border:1px solid #334155;background:#0b1324;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;height:32px' });
    root.querySelectorAll('.abtn--xs').forEach(b=>{ b.style.padding='6px 8px'; b.style.fontSize='12px'; b.style.height='28px'; });
    root.querySelectorAll('.abtn--sm').forEach(b=>{ b.style.height='34px'; });
    root.querySelectorAll('.abtn--w').forEach(b=>{ b.style.width='100%'; b.style.justifyContent='flex-start'; });
    const xBtn = root.querySelector('#ai-x'); xBtn.style.background='#111827'; xBtn.style.width='28px'; xBtn.style.height='28px'; xBtn.style.padding='0'; xBtn.style.fontSize='18px';
    root.querySelectorAll('.ai-tab').forEach(t=>{ t.style.cssText="flex:0 0 auto;border:none;padding:6px 10px;border-radius:8px;background:#111827;color:#e5e7eb;cursor:pointer;font-size:12px" });
    (root.querySelector('.ai-tab.t--active')||{}).style.background = '#1f2937';

    document.body.appendChild(root);

    // wire
    $('#ai-x').onclick   = ()=> root.remove();
 $('#ai-explain').onclick = ()=> showLearn(['charts_ranges','chart_patterns']);
$('#ai-price').onclick   = ()=> showLearn(['watchlist']);
    $('#ai-rebal').onclick   = ()=> writeLog(rebalanceTip());
    $('#ai-quiz').onclick    = ()=> { startQuiz(); switchTab('play'); };
    $('#ai-send').onclick    = ()=> { const v=$('#ai-input').value.trim(); if(v) runCmd(v); };
    $('#ai-input').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); $('#ai-send').click(); }});
    $('#ai-read').onclick    = ()=> { const t=$('#ai-log')?.textContent||''; if(t) speak(t); };
    $('#ai-stop').onclick    = ()=> stopSpeak();
    $('#ai-tour').onclick    = ()=> startTour('onboarding');

    // tab switching (no-conflict selectors)
    root.querySelectorAll('.ai-tab').forEach(btn=>{
      btn.addEventListener('click', ()=> switchTab(btn.dataset.aitab));
    });

    // content
    fillLearn();
    renderQuiz();
    renderMissions();

    writeHelp();
    window.mfkOpenAIAgent = ensurePanel; // console emergency
  }

  function switchTab(tab){
    const root = $('#ai-agent'); if(!root) return;
    root.querySelectorAll('.ai-tab').forEach(b=> b.classList.remove('t--active'));
    const btn = root.querySelector(`.ai-tab[data-aitab="${tab}"]`);
    if(btn){ btn.classList.add('t--active'); root.querySelectorAll('.ai-tab').forEach(b=> b.style.background='#111827'); btn.style.background='#1f2937'; }
    root.querySelectorAll('.ai-pane').forEach(p => p.style.display = (p.dataset.aipane===tab?'block':'none'));
  }

  function refreshPanelLang(){
    const lang=getLang();
    $('#ai-t') && ($('#ai-t').textContent = UI.title[lang]);
    $('#ai-st') && ($('#ai-st').textContent = UI.subtitle[lang]);
    const [tabChat, tabLearn, tabTour, tabPlay] = UI.tabs[lang];
    const tabs = $$('.ai-tab');
    if (tabs[0]) tabs[0].textContent = tabChat;
    if (tabs[1]) tabs[1].textContent = tabLearn;
    if (tabs[2]) tabs[2].textContent = tabTour;
    if (tabs[3]) tabs[3].textContent = tabPlay;
    $('#ai-explain') && ($('#ai-explain').textContent = UI.quick[lang][0]);
    $('#ai-price')   && ($('#ai-price').textContent   = UI.quick[lang][1]);
    $('#ai-rebal')   && ($('#ai-rebal').textContent   = UI.quick[lang][2]);
    $('#ai-quiz')    && ($('#ai-quiz').textContent    = UI.quick[lang][3]);
    $('#ai-send')    && ($('#ai-send').textContent    = UI.send[lang]);
    $('#ai-read')    && ($('#ai-read').textContent    = UI.read[lang]);
    $('#ai-stop')    && ($('#ai-stop').textContent    = UI.stop[lang]);
    $('#ai-tour')    && ($('#ai-tour').textContent    = UI.tour[lang]);
    $('#ai-input')   && ($('#ai-input').placeholder   = UI.ph[lang]);
    writeHelp();
    fillLearn();
    renderQuiz();
    renderMissions();
  }

  /* ===== Chat help ===== */
  function buildHelp(){ const lang=getLang(); const exs=(FAQ[lang]||[]).map(x=>'• '+x).join('\n'); return (lang==='pl'?`Przykładowe pytania:\n\n${exs}`:`Example questions:\n\n${exs}`); }
  function writeLog(t){ const el=$('#ai-log'); if(el){ el.dataset.help = (t===buildHelp()?'1':''); el.textContent=String(t||''); } }
  const writeHelp = ()=> writeLog(buildHelp());
  function writeToast(type){ const host = $('#ai-toast'); if(!host) return; host.innerHTML=''; const el=document.createElement('div'); el.style.cssText='background:#0b1324;border:1px solid #334155;color:#e5e7eb;border-radius:10px;padding:8px 10px;box-shadow:0 10px 28px rgba(2,8,23,.45)'; const L=getLang(); el.textContent = type==='good'?UI.good[L]:type==='bad'?UI.bad[L]: (L==='pl'?'Start!':'Go!'); host.appendChild(el); setTimeout(()=>{ el.remove(); }, 1200); }
function showLearn(keys){
  const L = getLang();
  const parts = (keys||[]).map(k=>{
    const c = LEARN[k]; if(!c) return '';
    const title = c.title?.[L] ?? c.title?.en ?? '';
    const body  = c.body?.[L]  ?? c.body?.en  ?? '';
    return `• ${title}\n${body}`;
  }).filter(Boolean);

  if(parts.length) writeLog(parts.join('\n\n'));

  // przełącz na zakładkę Learn
  switchTab('learn');

  // delikatny scroll do pierwszej wskazanej karty
  setTimeout(()=>{
    const wrap = document.querySelector('#ai-learn');
    if(!wrap) return;
    const firstKey = keys?.[0];
    const targetTitle = (LEARN[firstKey]?.title?.[L] ?? '').toLowerCase();
    const cards = [...wrap.querySelectorAll('.learn-card > div:first-child')];
    const hit = cards.find(d => d.textContent.trim().toLowerCase().includes(targetTitle));
    hit?.closest('.learn-card')?.scrollIntoView({behavior:'smooth', block:'start'});
  }, 60);
}

  /* ===== Learn cards ===== */
  function cardHTML(title, body){ return `<div class="learn-card" style="border:1px solid #334155;border-radius:10px;padding:10px;background:#0b1324"><div style="font-weight:700;margin-bottom:6px">${title}</div><div style="font-size:13px;white-space:pre-wrap;opacity:.95">${body}</div></div>`; }
  function fillLearn(){ const lang=getLang(); const wrap = $('#ai-learn'); if(!wrap) return; wrap.innerHTML = [ LEARN.jars_intro, LEARN.savings, LEARN.earnings, LEARN.gifts, LEARN.invest, LEARN.trading_intro, LEARN.market_stock, LEARN.market_fx, LEARN.accounting, LEARN.pl_meaning, LEARN.safety, LEARN.howto_stock ].map(card => cardHTML(card.title[lang], card.body[lang])).join(''); }

  /* ========== PLAY rendering ========== */
  function renderQuiz(){ const L=getLang(); const qEl=$('#ai-quiz-q'), aEl=$('#ai-quiz-a'), mEl=$('#ai-quiz-meta'), sEl=$('#ai-quiz-score'); if(!qEl||!aEl||!mEl||!sEl) return; $('#ai-quiz-start')?.addEventListener('click', startQuiz, {once:true}); sEl.textContent = (L==='pl'?`Wynik: ${quizScore}`:`Score: ${quizScore}`); if(!quizRun){ qEl.textContent = (L==='pl'? 'Kliknij Start quiz' : 'Press Start quiz'); aEl.innerHTML=''; mEl.textContent=''; return; } const q = QUIZ_BANK[quizIdx]; if(!q){ qEl.textContent='—'; aEl.innerHTML=''; mEl.textContent=''; return; } qEl.textContent = q.q[L]; aEl.innerHTML=''; q.a.forEach((opt, i)=>{ const b=document.createElement('button'); b.className='abtn'; b.textContent=opt[L]; b.style.marginRight='6px'; b.addEventListener('click', ()=> answerQuiz(i)); aEl.appendChild(b); }); mEl.textContent = `${quizIdx+1}/${QUIZ_BANK.length}`; }
  function renderMissions(){ const L=getLang(); const box=$('#ai-missions'); if(!box) return; box.innerHTML=''; const list = MISSIONS[L] || []; list.forEach(m=>{ const card=document.createElement('div'); card.style.cssText='border:1px solid #334155;border-radius:10px;padding:10px;background:#0b1324;display:flex;gap:10px;align-items:flex-start'; const check=document.createElement('input'); check.type='checkbox'; check.style.marginTop='3px'; check.checked = !!load('__ai_m_'+m.id, false); check.addEventListener('change', ()=> save('__ai_m_'+m.id, check.checked)); const content=document.createElement('div'); const h=document.createElement('div'); h.style.fontWeight='700'; h.textContent=m.title; const p=document.createElement('div'); p.style.fontSize='13px'; p.style.opacity='0.95'; p.textContent=m.text; content.appendChild(h); content.appendChild(p); card.appendChild(check); card.appendChild(content); box.appendChild(card); }); }

  /* ========== Tours (no-conflict) ========== */
  function findByText(text){ const q = text.toLowerCase(); const nodes = $$('button, a, span, div, h1, h2, h3'); return nodes.find(el => el.textContent?.trim().toLowerCase().includes(q)) || null; }
  const firstExisting = (arr)=> { for(const s of arr||[]){ const el=$(s); if(el) return el; } return null; };
  function highlight(el){ if(!el) return; el._ai_css_backup = el.style.outline; el.style.outline = '2px solid #60a5fa'; setTimeout(()=>{ el.style.outline = el._ai_css_backup || ''; }, 1200); }
  function placeBubble(bubble, ref){ ref.scrollIntoView({behavior:'instant', block:'center', inline:'center'}); const r = ref.getBoundingClientRect(); const B = {w:Math.min(340, window.innerWidth-20), h:bubble.offsetHeight||160}; let left = r.left + window.scrollX; let top  = r.top + window.scrollY + r.height + 10; if (top + B.h > window.scrollY + window.innerHeight) top = r.top + window.scrollY - B.h - 10; if (left + (B.w+20) > window.scrollX + window.innerWidth) left = window.scrollX + window.innerWidth - (B.w+20); bubble.style.left = Math.max(10,left) + 'px'; bubble.style.top  = Math.max(10,top)  + 'px'; bubble.style.maxWidth = B.w+'px'; }

  const STEPSETS = {
    onboarding(L, role){ const S=(pl,en)=> (L==='pl'?pl:en); const arr = [ ...(role==='parent' ? [{textMatch:'+ add child',  pl:'Dodaj konto dziecka i przypisz PIN.', en:'Add a child account and assign a PIN.'}] : []), { textMatch:'stocks', pl:'Wejście do rynku akcji.', en:'Enter the Stocks market.' }, { textMatch:'currencies', pl:'Rynek walut (FX).', en:'Currencies (FX) market.' }, { textMatch:'profits', pl:'Panel zysków/strat.', en:'Realized profits panel.' }, ...(role==='parent' ? [{ textMatch:'parent', pl:'Panel rodzica i ustawienia.', en:'Parent panel & settings.' }] : []), { sels:['#availableCash','#miniCash'], pl:'Available Cash — suma trzech słoików.', en:'Available Cash — sum of three jars.' }, { sels:['#saveAmt'],  pl:'Słoik Oszczędności – cele długoterminowe.', en:'Savings jar – longer-term goals.' }, { sels:['#spendAmt'], pl:'Słoik Zarobków – wynagrodzenia.', en:'Earnings jar – earned money.' }, { sels:['#giveAmt'],  pl:'Słoik Prezentów – otrzymane pieniądze.', en:'Gifts jar – money you received.' }, { sels:['#netWorth'], pl:'Net Worth – słoiki + portfele.', en:'Net Worth – jars + portfolios.' }, { textMatch:'quick actions', pl:'Szybkie Akcje: kieszonkowe i przeniesienia.', en:'Quick Actions: allowance and moves.' }, { sels:['#watchlist','.watchlist'], pl:'Watchlist – mini-wykresy.', en:'Watchlist – mini charts.' }, { sels:['#stockMarket','.stock-market'], pl:'Stock Market – dodaj do koszyka.', en:'Stock Market – add to basket.' }, { sels:['#fxMarket','.fx-market'], pl:'Currency Market – pary walutowe.', en:'Currency Market – currency pairs.' }, { sels:['[data-basket-list="stocks"]','#basketStocks'], pl:'Koszyk – zatwierdź Buy.', en:'Basket – execute Buy.' }, { sels:['#portfolioBody','.stock-portfolio'], pl:'Portfolio – śr.koszt, wartość, P/L.', en:'Portfolio – avg cost, value, P/L.' }, { sels:['.data-mode','#liveModeLabel','#liveStatus'], pl:'Tryb danych: Demo vs Live.', en:'Data mode: Demo vs Live.' }, { sels:['#ai-fab'], pl:'Otwieraj Agenta klikając „AI”.', en:'Open Agent using “AI” button.' } ]; return arr.map(st=> ({...st, pl:S(st.pl, st.en), en:S(st.pl, st.en)})); },
    topbar(){ return [ { textMatch:'en', pl:'Przełącz język aplikacji.', en:'Switch app language.' }, { textMatch:'stocks', pl:'Wejście do “Stocks”.', en:'Enter “Stocks”.' } ]; },
    markets(){ return [ { sels:['#stockMarket','.stock-market'], pl:'Rynek akcji i szczegóły.', en:'Stocks market and details.' }, { sels:['#fxMarket','.fx-market'], pl:'Rynek walut.', en:'FX market.' } ]},
    basket(){ return [ { sels:['[data-basket-list="stocks"]','#basketStocks'], pl:'Koszyk: podsumowanie.', en:'Basket: summary.' } ]},
    portfolio(){ return [ { sels:['#portfolioBody','.stock-portfolio'], pl:'Portfel: wartość i P/L.', en:'Portfolio: value & P/L.' } ]}
  };

  function startTour(kind='onboarding'){
    const L=getLang(), role=getRole();
    const set = kind==='topbar' ? STEPSETS.topbar(L,role) : kind==='markets' ? STEPSETS.markets(L,role) : kind==='basket' ? STEPSETS.basket(L,role) : kind==='portfolio' ? STEPSETS.portfolio(L,role) : STEPSETS.onboarding(L,role);
    const overlay=document.createElement('div'); overlay.id='ai-tour'; overlay.style.cssText="position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.28);pointer-events:none";
    const bubble=document.createElement('div'); bubble.style.cssText="position:absolute;max-width:340px;background:#0b1324;border:1px solid #334155;color:#e5e7eb;padding:12px;border-radius:12px;box-shadow:0 12px 36px rgba(2,8,23,.55);pointer-events:auto";
    const meta=document.createElement('div'); meta.style.cssText="font-size:12px;opacity:.7;margin-bottom:6px";
    const next=document.createElement('button'); next.style.cssText="margin-top:8px;background:#111827;border:1px solid #334155;color:#e5e7eb;border-radius:8px;padding:6px 10px;cursor:pointer"; next.textContent = (L==='pl'?'Dalej':'Next');
    const back=document.createElement('button'); back.style.cssText="margin:8px 0 0 8px;background:#1f2937;border:1px solid #334155;color:#e5e7eb;border-radius:8px;padding:6px 10px;cursor:pointer"; back.textContent=(L==='pl'?'Wstecz':'Back');
    const close=document.createElement('button'); close.style.cssText="margin:8px 0 0 8px;background:#1f2937;border:1px solid #334155;color:#e5e7eb;border-radius:8px;padding:6px 10px;cursor:pointer"; close.textContent=(L==='pl'?'Zamknij':'Close');
    let i = load('__ai_tour_idx__', 0); const steps = set;
    function anchorFor(st){ let el = st.sels ? firstExisting(st.sels) : null; if (!el && st.textMatch) el = findByText(st.textMatch); return el || $('#ai-fab') || document.body; }
    function showStep(){ const st=steps[i]; if(!st){ overlay.remove(); return; } const ref=anchorFor(st); highlight(ref); bubble.innerHTML=''; meta.textContent=(L==='pl'?`Krok ${i+1}/${steps.length}`:`Step ${i+1}/${steps.length}`); const text = (L==='pl'?st.pl:st.en) || ''; bubble.appendChild(meta); bubble.appendChild(document.createTextNode(text)); bubble.appendChild(document.createElement('br')); bubble.appendChild(next); bubble.appendChild(back); bubble.appendChild(close); if(!overlay.isConnected) document.body.appendChild(overlay); if(!bubble.isConnected) overlay.appendChild(bubble); placeBubble(bubble, ref); save('__ai_tour_idx__', i); }
    next.onclick=()=>{ if(i<steps.length-1){ i++; showStep(); } else { overlay.remove(); save('__ai_tour_idx__', 0); } };
    back.onclick=()=>{ if(i>0){ i--; showStep(); } };
    close.onclick=()=>{ overlay.remove(); };
    showStep();
  }

  /* ========== Commands (no-conflict) ========== */
  async function runCmd(raw){
    const q = String(raw||'').trim(); if(!q){ writeHelp(); return; }
    let m = q.match(/^lang\s+(pl|en)$/i); if(m){ setLang(m[1]); writeHelp(); return; }
    if (/^(czytaj|read)$/i.test(q)) { const t=$('#ai-log')?.textContent||''; if(t) speak(t); return; }
    if (/^(stop|pause|przestań|przestan)$/i.test(q)) { stopSpeak(); return; }
    if (/^(start quiz|quiz start|quiz)$/i.test(q)) { startQuiz(); switchTab('play'); return; }
    const low = q.toLowerCase();
    for (const [key, val] of Object.entries(GLOSSARY)){
      if (low.includes(key) || low.includes(key.replace(/\s/g,''))) { writeLog(val[getLang()]); return; }
    }
    m = q.match(/\b(?:price|kurs)\s+([A-Z]{2,5}(?:\/[A-Z]{3})?)\b/i); if(m){ await checkPrice(m[1].toUpperCase()); return; }
    m = q.match(/\b(?:buy|kup)\s+([A-Z]{1,5})\s+(\d+(?:\.\d+)?)\b/i); if(m){ const detail={type:'stock',symbol:m[1].toUpperCase(),qty:parseFloat(m[2])}; document.dispatchEvent(new CustomEvent('mfk:buy',{detail})); writeLog(getLang()==='pl' ? `Wysłałam żądanie kupna: ${detail.symbol} x ${detail.qty}.` : `Sent buy request: ${detail.symbol} x ${detail.qty}.`); return; }
    m = q.match(/\b(?:show chart|pokaż wykres|pokaz wykres)\s+([A-Z]{2,5}(?:\/[A-Z]{3})?)\s+(?:for\s+|z\s+)?(day|week|month|dnia|tygodnia|miesiąca|miesiaca)\b/i); if(m){ const sym=m[1].toUpperCase(); const pr=(m[2]||'').toLowerCase(); const range = /day|dnia/.test(pr)?'1D':/week|tygodnia/.test(pr)?'1W':'1M'; document.dispatchEvent(new CustomEvent('mfk:showChart',{detail:{symbol:sym,range}})); writeLog(getLang()==='pl'?`Poprosiłam o wykres ${sym} (${range}).`:`Requested chart for ${sym} (${range}).`); return; }
    if (/^(ile|how much)\b/i.test(q)){ const key = resolveConcept(q); if(key && KB[key].ids?.length){ const v = readValue(KB[key].ids); if(v){ writeLog(v); return; } } }
    if (/^(co to|czym jest|co to jest|what is|explain)\b/i.test(q)){ const key = resolveConcept(q); if(key){ const def = KB[key].desc[getLang()]; const v = readValue(KB[key].ids); writeLog(v ? `${def}\n\n${getLang()==='pl'?'Aktualna wartość:':'Current value:'} ${v}` : def); return; } if(low.includes('p/l')||low.includes('pl ')) { writeLog(LEARN.pl_meaning.body[getLang()]); return; } if(low.includes('trading')) { writeLog(LEARN.trading_intro.body[getLang()]); return; } if(low.includes('stock')||low.includes('akcj')) { writeLog(LEARN.market_stock.body[getLang()]); return; } if(low.includes('fx')||low.includes('walut')||low.includes('currency')) { writeLog(LEARN.market_fx.body[getLang()]); return; } }
    if (/^(tutorial|start tutorial|tutorial start|pomoc start)$/i.test(q)) { startTour('onboarding'); return; }
    if (/^tutorial (topbar|markets|basket|portfolio)$/i.test(q)) { const k=q.split(' ')[1]; startTour(k); return; }
    if (/safety|bezpieczen|bezpieczeństwo/.test(low)) { writeLog(LEARN.safety.body[getLang()]); return; }
    if (/krok.*kup|step.*buy/.test(low)) { writeLog(LEARN.howto_stock.body[getLang()]); return; }
    writeHelp();
  }


  
  /* ========== Shortcuts & init ========== */
document.addEventListener('keydown', (e) => {
  if (!(e.altKey && e.shiftKey)) return;
  if (e.code === 'KeyA') { e.preventDefault(); ensurePanel(); }
  if (e.code === 'KeyR') { e.preventDefault(); const t = $('#ai-log')?.textContent || ''; if (t) speak(t); }
  if (e.code === 'KeyS') { e.preventDefault(); stopSpeak(); }
}, true);

document.addEventListener('pointerup', (e) => {
  const t = e.target;
  if (t && (t.id === 'ai-fab' || t.closest?.('#ai-fab'))) {
    e.preventDefault();
    ensurePanel();
  }
}, true);

onReady(() => {
  removeOldRobots();
  ensureFab();
  $('#langSelect')?.addEventListener('change', refreshPanelLang);
});
/* ---------- LEARN: extend content + hard override renderer ---------- */
(() => {
  // 1) DODATKOWE KARTY (kid-friendly) — dopisujemy tylko brakujące klucze:
  const EXTRA = {
    allowance:{ title:{pl:"Kieszonkowe (Allowance)",en:"Allowance"},
      body:{pl:"Rodzic jednym kliknięciem dodaje kieszonkowe. Ustalcie zasadę: trochę do Oszczędności, trochę do Inwestycji.",
            en:"A parent can add allowance with one click. Rule: some to Savings, some to Investments."}},
    pocket_rules:{ title:{pl:"Proste zasady kieszonkowego",en:"Pocket money rules"},
      body:{pl:"1) Najpierw odkładam. 2) Potem planuję. 3) Na końcu wydaję z głową.",
            en:"1) Save first. 2) Plan next. 3) Spend wisely."}},
    needs_wants:{ title:{pl:"Potrzeby vs Zachcianki",en:"Needs vs Wants"},
      body:{pl:"Potrzeba = ważne (plecak). Zachcianka = fajne (kolejna gra). Najpierw potrzeby.",
            en:"Need = important (school bag). Want = nice (another game). Needs first."}},
    goals:{ title:{pl:"Cele – małe kroki",en:"Goals – small steps"},
      body:{pl:"Zapisz cel, kwotę i datę. Każda wpłata to krok bliżej.",
            en:"Write your goal, amount and date. Every deposit is a step closer."}},
    goal_smart:{ title:{pl:"Cel SMART",en:"SMART goal"},
      body:{pl:"S: konkretny • M: mierzalny • A: osiągalny • R: ważny • T: do kiedy.",
            en:"S: specific • M: measurable • A: achievable • R: relevant • T: time-bound."}},
    vision_board:{ title:{pl:"Tablica marzeń",en:"Dream board"},
      body:{pl:"Narysuj/wklej obrazki celu. Widzisz — łatwiej oszczędzać.",
            en:"Draw/paste pictures of your goal. Seeing it helps saving."}},
    budget:{ title:{pl:"Budżet = plan na pieniądze",en:"Budget = plan for money"},
      body:{pl:"Budżet mówi „ile na co”. Decyzje są łatwiejsze, niespodzianki mniejsze.",
            en:"Budget says “how much for what”. Easier choices, fewer surprises."}},
    split_rule:{ title:{pl:"Podział na 4 słoiki",en:"4-jars split"},
      body:{pl:"Np. 40% Oszczędności • 30% Inwestycje • 20% Wydatki • 10% Prezenty.",
            en:"E.g. 40% Savings • 30% Investments • 20% Spend • 10% Gifts."}},
    habit_loop:{ title:{pl:"Nawyk odkładania",en:"Saving habit"},
      body:{pl:"Sygnał → wpłata → nagroda (odznaka/pucha). Powtarzaj co tydzień.",
            en:"Cue → deposit → reward (badge/praise). Repeat weekly."}},
    jar_refill:{ title:{pl:"Doładowania słoików",en:"Refilling jars"},
      body:{pl:"Przykład 20 zł: 10zł Oszczędności, 6zł Inwestycje, 3zł Wydatki, 1zł Prezenty.",
            en:"Example $10: $5 Savings, $3 Investments, $2 Spend, $1 Gifts."}},
    charts_ranges:{ title:{pl:"Wykresy i zakresy (1D/1W/1M…)",en:"Charts & ranges (1D/1W/1M…)"},
      body:{pl:"Krótki zakres = detale. Długi = trend. Zmieniaj zakres, by widzieć całość.",
            en:"Short = detail. Long = trend. Switch ranges to see the big picture."}},
    chart_patterns:{ title:{pl:"Wzrosty, spadki, zygzaki",en:"Ups, downs & zig-zags"},
      body:{pl:"Góra = wzrost, dół = spadek, zygzaki = zmienność. Dlatego mamy plan.",
            en:"Up = rise, down = drop, zig-zags = volatility. That’s why we plan."}},
    stock_vs_etf:{ title:{pl:"Akcja vs ETF (prosto)",en:"Stock vs ETF (simple)"},
      body:{pl:"Akcja = jedna firma. ETF = koszyk firm → łatwiejsza dywersyfikacja.",
            en:"Stock = one company. ETF = basket of companies → easier diversification."}},
    dividend_intro:{ title:{pl:"Dywidenda (prosto)",en:"Dividend (simple)"},
      body:{pl:"Czasem firma dzieli się zyskiem. Nie każda.",
            en:"Sometimes a company shares profit. Not all do."}},
    fx_examples:{ title:{pl:"Siła walut – przykłady",en:"Currency strength – examples"},
      body:{pl:"EUR/PLN 4.00→4.20 ⇒ PLN słabszy. 4.20→4.00 ⇒ PLN silniejszy.",
            en:"EUR/PLN 4.00→4.20 ⇒ PLN weaker. 4.20→4.00 ⇒ PLN stronger."}},
    fees_note:{ title:{pl:"Opłaty i podatki (świat realny)",en:"Fees & taxes (real world)"},
      body:{pl:"W nauce brak prawdziwych opłat. W realu mogą występować.",
            en:"No real fees in learning mode. In real life they may apply."}},
    watchlist:{ title:{pl:"Watchlist = lista ciekawych",en:"Watchlist = interesting list"},
      body:{pl:"Dodaj spółki lub pary FX. Kliknij kartę, by zobaczyć szczegóły i duży wykres.",
            en:"Add stocks or FX pairs. Click a card for details and a big chart."}},
    basket:{ title:{pl:"Koszyk (Basket)",en:"Basket"},
      body:{pl:"Planuj w koszyku, kupuj później — jak lista zakupów.",
            en:"Plan in basket, buy later — like a shopping list."}},
    portfolio:{ title:{pl:"Portfel i średni koszt",en:"Portfolio & average cost"},
      body:{pl:"Portfel = co masz. Śr.koszt = ile średnio zapłaciłeś za 1 szt.",
            en:"Portfolio = what you own. Avg cost = average you paid per unit."}},
    online_safety:{ title:{pl:"Bezpieczny internet",en:"Online safety"},
      body:{pl:"Nie klikaj dziwnych linków. Nie podawaj danych. Zapytaj rodzica.",
            en:"Don’t click weird links. Don’t share data. Ask a parent."}},
    scam_check:{ title:{pl:"Test „czy to ściema?”",en:"“Is it a scam?” test"},
      body:{pl:"Pewny zysk? Pośpiech? Tajemnica? — STOP i pytaj dorosłego.",
            en:"Guaranteed profit? Rush? Secrecy? — STOP and ask an adult."}},
    howto_fx:{ title:{pl:"Krok po kroku: kup walutę",en:"Step by step: buy a currency"},
      body:{pl:"1) Currencies → wybierz parę • 2) Add to basket • 3) Sprawdź Investment Jar • 4) Buy.",
            en:"1) Currencies → choose a pair • 2) Add to basket • 3) Check Investment Jar • 4) Buy."}},
    money_mindset:{ title:{pl:"Nastawienie do pieniędzy",en:"Money mindset"},
      body:{pl:"Pieniądze to narzędzie do celów. Szacunek, plan, cierpliwość.",
            en:"Money is a tool for goals. Respect, plan, patience."}},
    reflection_journal:{ title:{pl:"Dziennik 2 min",en:"2-minute journal"},
      body:{pl:"Zapisz 1 rzecz, której się nauczyłeś, i 1 decyzję, z której jesteś dumny.",
            en:"Write 1 thing you learned and 1 decision you’re proud of."}},
    gratitude_share:{ title:{pl:"Wdzięczność i dzielenie",en:"Gratitude & sharing"},
      body:{pl:"10% do słoika „Prezenty” to dobry start.",
            en:"10% to the “Gifts” jar is a great start."}},
    inflation_simple:{ title:{pl:"Inflacja (prosto)",en:"Inflation (simple)"},
      body:{pl:"Gdy ceny rosną, ta sama kwota kupuje mniej. Planuj mądrze.",
            en:"When prices rise, the same money buys less. Plan wisely."}},
    compound_magic:{ title:{pl:"Magia procentu składanego",en:"Magic of compounding"},
      body:{pl:"Małe kwoty + czas = śnieżna kula dobra.",
            en:"Small amounts + time = a good snowball."}}
  };

  // Dołącz tylko te, których nie masz:
  Object.keys(EXTRA).forEach(k => { if (!LEARN[k]) LEARN[k] = EXTRA[k]; });

  // 2) KOLEJNOŚĆ WYŚWIETLANIA (i fallback na resztę kluczy):
  const ORDER = [
    'jars_intro','savings','earnings','gifts','invest','allowance','pocket_rules',
    'needs_wants','goals','goal_smart','vision_board','budget','split_rule','habit_loop','jar_refill',
    'trading_intro','market_stock','stock_vs_etf','dividend_intro','market_fx','fx_examples',
    'charts_ranges','chart_patterns','accounting','pl_meaning','fees_note',
    'watchlist','basket','portfolio','safety','online_safety','scam_check',
    'howto_stock','howto_fx',
    'money_mindset','reflection_journal','gratitude_share','inflation_simple','compound_magic'
  ];

  // 3) NOWY RENDERER — NADPISANIE LOKALNEGO SYMBOLU `fillLearn`
  function fillLearnV2(){
    const L = getLang();
    const wrap = document.querySelector('#ai-learn');
    if (!wrap) return;
    const keys = [...ORDER, ...Object.keys(LEARN).filter(k => !ORDER.includes(k))];
    wrap.innerHTML = keys.map(k => {
      const c = LEARN[k]; if (!c) return '';
      const title = c.title?.[L] ?? c.title?.en ?? '';
      const body  = c.body?.[L]  ?? c.body?.en  ?? '';
      return cardHTML(title, body);
    }).join('');
  }

  // <- TO JEST KLUCZOWE:
  fillLearn = fillLearnV2;          // nadpisujemy wewnętrzny symbol używany przez panel
  window.fillLearn = fillLearnV2;   // i dla pewności eksport

  // Jeżeli panel już otwarty, odśwież karty teraz:
  try { fillLearnV2(); } catch {}
})();


})(); // ← zamknięcie IIFE agenta

/* --- SORT jest obsługiwany wyłącznie w index.html ---
   (usunięto: globalny click-handler sortu, mobile ensureSort, tap→click shim)
*/
