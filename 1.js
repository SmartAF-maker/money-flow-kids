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
  basket: { stocks: [], fx: [] }  //⬅️ NEW
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
  stockList.innerHTML = "";
  const f = (filter || "").trim().toUpperCase();
  const isDefaultView = f === "";
  const data = (ch.stocks || []).filter(s => !f || s.t.toUpperCase().includes(f) || (s.n || "").toUpperCase().includes(f));
  const total = data.length;
  const limit = isDefaultView ? (stockExpanded ? 500 : 5) : 500;

  data.slice(0, limit).forEach(s => {
    const cur = priceOfStock(s.t, s.p); // ← czytaj cenę z HUB-a (fallback: s.p)

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
  fxList.innerHTML = "";
  const raw = (filter || "").trim();
  const isDefaultView = raw === "";
  const quote = fxQuote(); // <-- USD lub PLN zależnie od języka

  // generator jednego kafelka FX
  const toBtn = (pair) => {
    const r = fxRate(pair);
    if (!Number.isFinite(r)) return null;

    const dir = fxTrendDir(pair, r);
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
          <div style="font-weight:700">${FX(r)} ${arrowHtml(dir)}</div>
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
    uniq.slice(0, 500).forEach(p => { const el = toBtn(p); if (el) fxList.appendChild(el); });
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

    const pairs = bases.map(b => `${b}/${quote}`);
    const uniq = [...new Set(pairs)];
    uniq.slice(0, 500).forEach(p => { const el = toBtn(p); if (el) fxList.appendChild(el); });
    updateFxMoreBtn(uniq.length, false);
    save(app);
    return;
  }

  // 3) Widok domyślny -> wszystkie A/QUOTE (A != QUOTE)
  const allBaseVsQuote = ISO.filter(b => b !== quote).map(b => `${b}/${quote}`);
  const uniq = [...new Set(allBaseVsQuote)];
  const limit = fxExpanded ? 500 : 5;
  uniq.slice(0, limit).forEach(p => { const el = toBtn(p); if (el) fxList.appendChild(el); });
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

// --- add to basket: FX (para bazowa vs USD)
function addToBasketFx(pair, priceUsd, qty) {
  qty = Math.max(1, parseFloat(qty || "1"));

  // 1) weź liczbę i ZAOKRĄGLIJ do 2 miejsc (centy)
  let px = Number(priceUsd || 0);
  if (!pair || !qty || !(px > 0)) return;
  const px2 = Math.round(px * 100) / 100;   // <- 1.1278 -> 1.13

  if (!app.basket) app.basket = { stocks: [], fx: [] };

  // 2) wyszukaj po kluczu (pair)
  const it = findBasketItem(app.basket.fx, pair);

  if (it) {
    it.qty = Number(it.qty || 0) + qty;
    it.price = px2;                         // <- zapisujemy już 2-miejscową cenę
  } else {
    const [base] = pair.split("/");
    const baseName = (CURRENCY_NAMES[base] || base) + " vs USD";
    app.basket.fx.push({ key: pair, pair, n: baseName, price: px2, qty });
  }

  save(app);
  renderBasketFx();
  toast(`Added to basket: ${qty} × ${pair}`);
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

const total = toCents(items.reduce((s, it) => toCents(s + toCents(Number(it.qty||0) * Number(it.price||0))), 0));

  if (total > ch.jars.save) return toast(TT().needFunds(PLN(total)));

  ch.jars.save   -= total;
  ch.jars.invest += total;

  items.forEach(it => {
    const pair = it.pair || it.key; const qty = Number(it.qty||0); const rUsd = Number(it.price||0);
    if (!pair || qty<=0 || rUsd<=0) return;
    let pos = ch.fxPortfolio[pair] || { q:0, b:rUsd };
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
    // ⏱️ natychmiastowy pierwszy tick po włączeniu Live
    refreshStocksFromApi();
    refreshFxFromApi();

    // ⏲️ potem cyklicznie (wolniej – łagodniej dla limitów)
    liveStTimer = setInterval(() => refreshStocksFromApi(), 45_000); // 45s
liveFxTimer = setInterval(() => refreshFxFromApi(),    70_000);  // 70s
  }
}

// ==== OFFLINE FX SIMULATION (tylko offline) ====
function simulateFxOfflineTick() {
  if (app.liveMode) return;               // tylko offline
  const next = { ...baseFx, PLN: 1 };     // PLN zawsze 1
 ISO.forEach(code => {
  if (code === "PLN" || code === "USD") return; // ⬅️ nie zmieniamy USD/PLN w offline

    const v = Number(next[code]);
    if (!Number.isFinite(v) || v <= 0) return;
    const drift = 1 + (Math.random() - 0.5) * 0.005; // ±0.25%
    const nv = Math.max(0.00001, v * drift);
    next[code] = Number(nv.toFixed(5));
  });
  baseFx = next;

  const fxSearchEl = document.getElementById("fxSearch");
  renderFxList((fxSearchEl && fxSearchEl.value) || "");
  renderPortfolioFx(); renderJars(); renderProfits();
  renderGlobalTrends(currentTrendsMode);
}
setInterval(simulateFxOfflineTick, 3000); // co 3 sekundy

function syncLiveToggleUI() {
  const t = document.getElementById('liveModeToggle');
  const l = document.getElementById('liveModeLabel');
  const s = document.getElementById('liveStatus');
  if (t) t.checked = !!app.liveMode;
  if (l) l.textContent = app.liveMode ? TT().live : TT().sim;
  if (s) s.textContent = app.liveMode ? TT().apiConn : TT().apiNot;
}

// --- Self-test łączności: proxy (Yahoo) + FX host (bez direct, żeby nie było CORS) ---
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

  const proxyUrl = "https://r.jina.ai/http://query1.finance.yahoo.com/v7/finance/quote?symbols=" + encodeURIComponent(q);
  const fxUrl    = "https://api.exchangerate.host/latest?base=USD&places=6";

  const [proxy, fx] = await Promise.all([ ping(proxyUrl, "Proxy"), ping(fxUrl, "FXhost") ]);
  const ok = (proxy.ok && fx.ok);

  if (s) s.textContent = `API self-test: ${proxy.ok ? "✅" : "❌"} Proxy(${proxy.code}) • ${fx.ok ? "✅" : "❌"} FXhost(${fx.code})`;
  window.__lastSelfTest = { proxy, fx, ok, route: proxy.ok ? 'proxy' : 'offline' };
  console.log("[LIVE SELF-TEST]", window.__lastSelfTest);
  return window.__lastSelfTest;
}

// --- Jednorazowy refresh (FX + akcje) z self-testem + sufiks „via …” i „rate-limited” ---
async function forceLiveRefresh() {
  if (liveFetchLock) return false;
  liveFetchLock = true;

  const s = document.getElementById('liveStatus');
  if (s) s.textContent = TT().apiConn;

  try {
    // self-test łączności (proxy + FX host)
    let st = null, okNet = false;
    try {
      st = await liveSelfTest();
      okNet = !!st.ok;
    } catch {
      okNet = false;
    }

    if (!okNet) {
      if (s) s.textContent = "API: trying via proxy…";
      console.warn("[forceLiveRefresh] self-test failed; trying fetchers anyway.");
    }

    // równoległy refresh FX i akcji
    const [fxRes, stRes] = await Promise.allSettled([
      refreshFxFromApi(),
      refreshStocksFromApi()
    ]);

    const fxOk = (fxRes.status === 'fulfilled' && fxRes.value === true);
    const stOk = (stRes.status === 'fulfilled' && stRes.value === true);

    // ustal trasę (route) na podstawie self-testu
   // ustal trasę: direct / proxy / offline
let route = 'offline';
if (st) {
  const directOk = (st.d1?.ok || st.d2?.ok);
  const proxyOk  = !!st.proxy?.ok;
  route = directOk ? 'direct' : (proxyOk ? 'proxy' : 'offline');
}

// NEW: sprawdź cooldown ustawiony po 429
const rateLimited = window.__yahooCooldownUntil && Date.now() < window.__yahooCooldownUntil;
const suffix = rateLimited ? ' • rate-limited – slowing down' : '';

if (s) {
  s.textContent =
    `API: ${fxOk ? TT().fxOk : TT().fxFail} • ${stOk ? TT().stOk : TT().stFail}${suffix} (via ${route})`;
}


    return (fxOk || stOk);
  } finally {
    liveFetchLock = false;
    renderGlobalTrends(currentTrendsMode);
  }
}


// --- Odświeżenie UI + timery
function updateLiveUI(forceFetch = false) {
  const l = document.getElementById('liveModeLabel');
  const s = document.getElementById('liveStatus');
  if (l) l.textContent = app.liveMode ? TT().live : TT().sim;
  if (s) s.textContent = app.liveMode ? TT().apiConn : TT().apiNot;

  renderStocks(document.getElementById('stockSearch')?.value || "");
  renderFxList(document.getElementById('fxSearch')?.value || "");
  renderPortfolioStocks();
  renderPortfolioFx();
  renderJars();
  renderProfits();
  renderGlobalTrends(currentTrendsMode);

  setLiveTimers(app.liveMode);
  if (app.liveMode && forceFetch) forceLiveRefresh();
}

// --- Solidne podpięcie przełącznika (input + label) + watchdog
function wireLiveToggleOnce() {
  const node  = document.getElementById('liveModeToggle');
  const label = document.getElementById('liveModeLabel');

  function applyToggle(nextVal) {
    app.liveMode = !!nextVal;
    save(app);

    if (typeof clearTrendsAll === 'function') clearTrendsAll();
    lastFxUiPrice = null;
    lastStockUiPrice = null;

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

// init + dwustopniowy watchdog (gdy DOM doszedł później)
(function initLive(){
  syncLiveToggleUI();
  wireLiveToggleOnce();
  setTimeout(wireLiveToggleOnce, 0);
  setTimeout(wireLiveToggleOnce, 1000); // ostatnia próba dopięcia

  updateLiveUI(false);
  if (app.liveMode) forceLiveRefresh();
})();

// 🔇 Pauza odświeżania, gdy zakładka niewidoczna (oszczędza limity)
document.addEventListener('visibilitychange', () => {
  if (!app.liveMode) return;
  const s = document.getElementById('liveStatus');
  if (document.hidden) {
    setLiveTimers(false); // stop
    if (s) s.textContent = 'API: paused (tab hidden)';
  } else {
    setLiveTimers(true);  // start
    if (s) s.textContent = TT().apiConn;
    forceLiveRefresh();
  }
});
// ====== LIVE MODE (END)

// ====== Tutorial (skrócone) ======
let TUTORIAL_STEPS = makeSteps();
function refreshTutorialTexts() { TUTORIAL_STEPS = makeSteps(); if (tutorialTitle) tutShowStep(tutorialIndex); }
let tutorialIndex = 0;

function tutShowStep(i) {
  const s = TUTORIAL_STEPS[i]; if (!s) return;
  tutorialIcon && (tutorialIcon.textContent = s.icon || "📘");
  tutorialTitle && (tutorialTitle.textContent = s.title);
  tutorialText && (tutorialText.textContent = s.text);
  tutorialImage && (tutorialImage.src = s.img || "");
  tutorialImage && (tutorialImage.alt = s.caption || s.title);
  tutCaption && (tutCaption.textContent = s.caption || "");
}
function openTutorial(force = false) {
  const done = localStorage.getItem("pf_tutorial_done") === "1";
  if (done && !force) return;
  tutorialIndex = 0;
  tutShowStep(tutorialIndex);
  tutorialModal && tutorialModal.classList.remove("hidden");
}
function closeTutorial() { tutorialModal && tutorialModal.classList.add("hidden"); }

document.getElementById("tutorialBtn")?.addEventListener("click", () => openTutorial(true));
document.getElementById("prevStep")?.addEventListener('click', () => {
  if (tutorialIndex > 0) { tutorialIndex--; tutShowStep(tutorialIndex); }
});
document.getElementById("nextStep")?.addEventListener('click', () => {
  if (tutorialIndex < TUTORIAL_STEPS.length - 1) {
    tutorialIndex++; tutShowStep(tutorialIndex);
  } else {
    localStorage.setItem("pf_tutorial_done", "1");
    if (localStorage.getItem("pf_tutorial_reward_given") !== "1") {
      const ch = activeChild();
      if (ch) {
        ch.jars.save += 10; save(app); renderJars();
        toast("Great! +10 USD for finishing the tutorial 🎉");
      }
      localStorage.setItem("pf_tutorial_reward_given", "1");
    }
    closeTutorial();
  }
});
document.getElementById("closeTutorial")?.addEventListener("click", closeTutorial);
window.addEventListener("load", () => openTutorial(false));
// Mapowanie tickerów do formatu Yahoo (tylko nietypowe przypadki)
function mapToYahoo(sym) {
  const map = {
    BRKB: 'BRK-B',   // było
    BRK_B: 'BRK-B',  // ✅ dopisz to, jeśli używasz BRK_B w STOCK_UNIVERSE
  };
  return map[sym] || sym;
}


// ====== LIVE DATA FETCHERS (BEGIN)

// --- YAHOO (proxy-first) + cooldown + bezpieczny parser ---
async function yahooQuote(symbolsArr) {
 const CHUNK = 3;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function pickPrice(q) {
    const cand = [q?.regularMarketPrice, q?.postMarketPrice, q?.preMarketPrice, q?.bid, q?.ask];
    for (let i = 0; i < cand.length; i++) {
      const v = cand[i];
      if (typeof v === "number" && isFinite(v)) return Number(v);
    }
    return null;
  }

  // cooldown – pomiń zapytania, ale zwróć flagę
  const now = Date.now();
  if (window.__yahooCooldownUntil && now < window.__yahooCooldownUntil) {
    console.warn("[yahooQuote] cooldown in effect, skipping fetch");
    const arr = [];
    arr._pickPrice = pickPrice;
    arr._rateLimited = true;
    return arr;
  }

  async function safeJson(r) {
    let j;
    try { j = await r.json(); }
    catch { j = JSON.parse(await r.text()); }
    if (j && j.data) {
      try { j = (typeof j.data === 'string') ? JSON.parse(j.data) : j.data; } catch {}
    }
    return j;
  }

  async function fetchList(symbolsCsv) {
    const url = "https://r.jina.ai/http://query1.finance.yahoo.com/v7/finance/quote?symbols="
                + encodeURIComponent(symbolsCsv) + "&nocache=" + Date.now();
    try {
      const r = await fetch(url, { headers: { "Accept": "application/json" } });
      if (r.status === 429) {
  const now = Date.now();
  const prev = window.__yahooCooldownSecs || 60;
  const next = Math.min(prev * 2, 300); // 60 -> 120 -> 240 -> 300s
  window.__yahooCooldownSecs = next;
  window.__yahooCooldownUntil = now + next * 1000;
  console.warn(`[yahooQuote] 429 rate-limited – cooldown ${next}s`);
  return { list: [], rateLimited: true };
}

      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await safeJson(r);
      const list = j?.quoteResponse?.result || [];
      return { list, rateLimited: false };
    } catch (e) {
      console.warn("[yahooQuote] fetch fail", e);
      return { list: [], rateLimited: false };
    }
  }

  const chunks = [];
  for (let i = 0; i < symbolsArr.length; i += CHUNK) {
    chunks.push(symbolsArr.slice(i, i + CHUNK));
  }

  const out = [];
  let anyRateLimited = false;

  for (let c = 0; c < chunks.length; c++) {
    const { list, rateLimited } = await fetchList(chunks[c].join(","));
    if (rateLimited) { anyRateLimited = true; break; }
    if (list && list.length) out.push(...list);
    await sleep(1500 + Math.random() * 800); // jitter
  }

  out._pickPrice = pickPrice;
  out._rateLimited = anyRateLimited;
  return out;
}
// ===== LIVE FX FETCHER (robust) =====
// Buduje pełną mapę: baseFx[CODE] = PLN za 1 CODE
// Źródła: 1) exchangerate.host (PRIMARY, base=USD), 2) Yahoo (uzupełnia braki), 3) fallbacki
async function refreshFxFromApi() {
  try {
    const next = { PLN: 1 };

    // 1) exchangerate.host — PRIMARY (base=USD)
  async function fetchFxBaseUsd() {
  const symbols = ISO.join(',');
  const url = `https://api.exchangerate.host/latest?base=USD&places=6&symbols=${encodeURIComponent(symbols)}`;
  try {
    const r = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    try { return await r.json(); } catch { return JSON.parse(await r.text()); }
  } catch (e) {
    console.warn("[FXhost] fail (direct)", e);
    return null;
  }
}

    const fx = await fetchFxBaseUsd();
    const rates = fx?.rates || null;
    const pln_per_usd = Number(rates?.PLN);
    if (Number.isFinite(pln_per_usd) && pln_per_usd > 0) {
      // PLN per 1 USD
      next.USD = +pln_per_usd.toFixed(5);
      // PLN per 1 CODE = (PLN/USD) / (CODE/USD)
      ISO.forEach(code => {
        if (code === "PLN") return;
        const code_per_usd = Number(rates?.[code]);
        if (Number.isFinite(code_per_usd) && code_per_usd > 0) {
          next[code] = +((pln_per_usd / code_per_usd).toFixed(5));
        }
      });
    }

    // 2) Yahoo — SECONDARY, uzupełnia tylko braki (CODEPLN=X)
    const missingForYahoo = ISO.filter(c => c !== "PLN" && !Number.isFinite(next[c]));
    if (missingForYahoo.length) {
      const symbolsArr = missingForYahoo.map(c => `${c}PLN=X`);
      const items = await yahooQuote(symbolsArr);
      const pickPrice = items._pickPrice || (q => q?.regularMarketPrice ?? null);
      for (let i = 0; i < items.length; i++) {
        const q = items[i];
        const sym = String(q?.symbol || "").toUpperCase(); // np. EURPLN=X
        const m = sym.match(/^([A-Z]{3})PLN=X$/);
        const px = Number(pickPrice(q));
        if (m && Number.isFinite(px) && px > 0) {
          next[m[1]] = +px.toFixed(5); // PLN per 1 CODE
        }
      }
    }

    // 3) Fallback: jeśli nadal brak USD, próbuj base=PLN (odwrotność)
    if (!Number.isFinite(next.USD) || next.USD <= 0) {
      try {
        const urls = [
          "https://api.exchangerate.host/latest?base=PLN&places=6&symbols=USD",
          "https://r.jina.ai/http://api.exchangerate.host/latest?base=PLN&places=6&symbols=USD"
        ];
        for (let k = 0; k < urls.length; k++) {
          try {
            const r = await fetch(urls[k], { headers: { "Accept": "application/json" } });
            if (!r.ok) throw new Error("HTTP " + r.status);
            const j = await r.json().catch(async () => JSON.parse(await r.text()));
            const usd_per_pln = Number(j?.rates?.USD); // USD per 1 PLN
            if (Number.isFinite(usd_per_pln) && usd_per_pln > 0) {
              next.USD = +(1 / usd_per_pln).toFixed(5); // PLN per 1 USD
              break;
            }
          } catch (e) { /* continue */ }
        }
      } catch { /* ignore */ }
    }

    // Domknij brakujące waluty poprzednią mapą
    ISO.forEach(code => {
      if (code === "PLN") return;
      if (!Number.isFinite(next[code]) || next[code] <= 0) {
        const prev = baseFx?.[code];
        if (Number.isFinite(prev) && prev > 0) next[code] = prev;
      }
    });

    // Ostateczny bezpiecznik dla USD
    if (!Number.isFinite(next.USD) || next.USD <= 0) {
      next.USD = Number.isFinite(baseFx?.USD) && baseFx.USD > 0 ? baseFx.USD : 4.00;
    }

    // Podmiana mapy + odświeżenie UI
    baseFx = next;
    const fxSearchEl = document.getElementById("fxSearch");
    renderFxList((fxSearchEl && fxSearchEl.value) || "");
    renderPortfolioFx(); renderJars(); renderProfits();
    renderGlobalTrends(currentTrendsMode);

    console.log("[FX MAP READY] USD:", baseFx.USD, baseFx);
    return true;
  } catch (e) {
    console.warn("[refreshFxFromApi] fatal", e);
    return false;
  }
}
// --- STOCKS (miękkie traktowanie cooldownu) ---
async function refreshStocksFromApi() {
  try {
    const ch = activeChild(); if (!ch) return false;
    const symbolsArr = (ch.stocks || []).map(s => mapToYahoo(s.t));
    if (!symbolsArr.length) return false;

    const list = await yahooQuote(symbolsArr);
    const pickPrice = list._pickPrice || (q => q?.regularMarketPrice ?? null);

    // jeśli pusto: sprawdź cooldown i potraktuj jako „ok, tylko zwolnione”
    const onCooldown = !!(window.__yahooCooldownUntil && Date.now() < window.__yahooCooldownUntil);
    const rateLimitedFlag = !!list._rateLimited;

    if (!Array.isArray(list) || !list.length) {
      if (onCooldown || rateLimitedFlag) {
        console.warn("Stocks: rate-limited – keeping previous prices");
        return true; // miękko OK (bez „failed”)
      }
      console.warn("Stocks: empty response – keeping previous prices");
      return false;
    }

    const bySym = Object.create(null);
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (!q || !q.symbol) continue;
      bySym[String(q.symbol).toUpperCase()] = q;
    }

    ch.stocks = ch.stocks.map(s => {
      const ySym = String(mapToYahoo(s.t)).toUpperCase();
      const q = bySym[ySym];
      const px = pickPrice(q);
      return (px != null) ? Object.assign({}, s, { p: Number(px) }) : s;
    });

    save(app);
    const stSearchEl = document.getElementById("stockSearch");
    renderStocks((stSearchEl && stSearchEl.value) || "");
    renderPortfolioStocks(); renderJars(); renderProfits();
    renderGlobalTrends(currentTrendsMode);
    return true;
  } catch (e) {
    console.warn("[refreshStocksFromApi] fatal", e);
    return false;
  }
}


// (Timery uruchamiamy/wyłączamy w LIVE MODE wg app.liveMode)
clearInterval(window.__liveStocksTimer);
clearInterval(window.__liveFxTimer);
window.__liveStocksTimer = null;
window.__liveFxTimer = null;

// ====== LIVE DATA FETCHERS (END)



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
const appTitleEl = document.getElementById('appTitle'); // <div id="appTitle"></div> w HTML

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

  // Używamy wersji nocookie + playsinline (iOS)
  const YT_URL = "https://www.youtube-nocookie.com/embed/eIpCd1wRhYE?rel=0&modestbranding=1&playsinline=1";
  iframe.setAttribute('data-src', YT_URL);

  function openMini() {
    ytMini.classList.remove('hidden');
    if (!iframe.src) iframe.src = iframe.dataset.src; // lazy init
  }

  function closeMini() {
    ytMini.classList.add('hidden');
    // zatrzymaj odtwarzanie przez zresetowanie src
    const tmp = iframe.src;
    iframe.src = '';
    // przywróć oryginalny adres, żeby był gotowy na kolejne otwarcie
    setTimeout(() => { iframe.src = iframe.dataset.src; }, 0);
  }

  function toggleSize() {
    ytMini.classList.toggle('expanded');
  }

  openers.forEach(btn => btn.addEventListener('click', (e) => {
    e.preventDefault();
    openMini();
  }));

  btnClose?.addEventListener('click', closeMini);
  btnSize?.addEventListener('click', toggleSize);

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
window.addEventListener('DOMContentLoaded', () => {
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
/// ===== WATCHLIST (stocks + FX) v2 — perf tuned (DPR cap, TTL cache, lazy draw) =====
(() => {
  const LS_KEY = 'mfk_watchlist_v1';

  // ---------- PERF CONSTANTS ----------
  const DPR = Math.min(2, Math.max(1, window.devicePixelRatio || 1)); // mniejszy koszt rysowania
  const DAYS_SPARK_STOCK = 420;  // ~14 mies. do małych sparków
  const DAYS_SPARK_FX    = 210;  // ~7 mies. do małych sparków
  const SERIES_TTL_MS    = 2 * 60 * 60 * 1000; // 2h cache w localStorage

  // ---------- DOM ----------
  const $panel = document.querySelector('.panel.watchlist');
  const $list  = document.getElementById('wl-list');
  const $form  = document.getElementById('wl-form');
  const $pick  = document.getElementById('wl-pick');

  const $modal = document.getElementById('wl-modal');
  const $title = document.getElementById('wl-modal-title');
  const $mPrice= document.getElementById('wl-price');
  const $mChg  = document.getElementById('wl-chg');
  const $big   = document.getElementById('wl-big');

  // Head tabs in the watchlist panel (All / Stocks / Currencies)
  const $wlTabs = $panel?.querySelector('.wl-tabs') || null;

// picker lists — pełne, uporządkowane
const STOCKS_ALL = [
  // Big Tech / FAANG(+)
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','NFLX','ADBE','CRM','NOW','INTU',
  // Semi & hardware
  'AVGO','QCOM','TXN','MU','AMD','INTC','SMCI','ASML','TSM','IBM',
  // Commerce / travel / sharing
  'SHOP','ABNB','BKNG','UBER','LYFT','ETSY',
  // Cybersecurity / data
  'PANW','CRWD','ZS','OKTA','SNOW','MDB',
  // Industrials / aero
  'GE','BA','CAT','DE','MMM','HON','LMT','NOC','RTX',
  // Consumer
  'NKE','SBUX','MCD','CMG','KO','PEP','PG','COST','WMT','TGT','HD','LOW',
  // Energy / materials
  'XOM','CVX','COP','SLB','BP','SHEL','RIO','BHP',
  // Healthcare
  'JNJ','PFE','MRK','ABBV','TMO','UNH','LLY','GILD',
  // Financials
  'JPM','BAC','WFC','GS','MS','C','V','MA','PYPL','AXP','SQ',
  // Media / telecom
  'DIS','PARA','WBD','T','VZ','CMCSA',
  // Auto & EV
  'F','GM','RIVN','NIO','LI','TM',
  // China / other ADRs (duże spółki)
  'BABA','PDD','BIDU','NTES','SONY','SAP'
];

const FX_ALL = [
  // Majors
  'EUR/USD','GBP/USD','USD/JPY','USD/CHF','AUD/USD','NZD/USD','USD/CAD',
  // Euro crosses
  'EUR/GBP','EUR/JPY','EUR/CHF','EUR/CAD','EUR/AUD','EUR/NZD',
  // GBP crosses
  'GBP/JPY','GBP/CHF','GBP/CAD','GBP/AUD','GBP/NZD',
  // JPY crosses
  'AUD/JPY','NZD/JPY','CAD/JPY','CHF/JPY','GBP/JPY','EUR/JPY',
  // CHF crosses
  'AUD/CHF','NZD/CHF','CAD/CHF',
  // Commodity crosses
  'AUD/NZD','AUD/CAD','NZD/CAD',
  // Nordics & others
  'USD/NOK','USD/SEK','USD/DKK','USD/TRY','USD/ZAR','USD/MXN',
  // Europa Środkowa
  'USD/PLN','EUR/PLN','GBP/PLN','CHF/PLN','JPY/PLN',
  'USD/CZK','EUR/CZK','USD/HUF','EUR/HUF',
  // Dodatkowe często spotykane
  'USD/CNH','USD/HKD','USD/SGD'
];

  // ---------- STATE ----------
  let mode   = 'stock';
  let filter = 'stock';
  let watchlist = loadLS();

  // caches (w pamięci procesu)
  const cacheFX     = new Map();   // key: `${pair}|${days}`
  const cacheStocks = new Map();   // key: `${symbol}|${days}`

  function loadLS(){
    try{
      return JSON.parse(localStorage.getItem(LS_KEY)) ??
        [{type:'stock',symbol:'GE'},{type:'stock',symbol:'AAPL'},{type:'fx',base:'EUR',quote:'USD'}];
    }catch(_){ return []; }
  }
  function saveLS(){ localStorage.setItem(LS_KEY, JSON.stringify(watchlist)); }

  // ---------- UTILS ----------
  const pct = (a,b)=> (b===0?0:((a-b)/b)*100);
  const fmt = x => Number(x ?? 0).toLocaleString(undefined,{maximumFractionDigits:2});
  const emptySeries = () => ({dates:[],closes:[]});

  function stooqCode(sym){
    const s = (sym||'').toLowerCase();
    if (/\./.test(s)) return s;
    if (!/^[a-z.]{1,10}$/.test(s)) return s;
    return s + '.us';
  }
  function stooqFxCode(base, quote){
    // Stooq używa np. eurusd, usdpln
    return `${base}${quote}`.toLowerCase();
  }
  function parsePair(s){
    const t = (s||'').toUpperCase().replace(/\s+/g,'');
    if (t.includes('/')) { const [a,b]=t.split('/'); if (a&&b&&a.length===3&&b.length===3) return {base:a,quote:b}; }
    if (/^[A-Z]{6}$/.test(t)) return {base:t.slice(0,3), quote:t.slice(3,6)};
    return null;
  }

  async function fetchJSON(url, {timeout=9000} = {}){
    const ctrl = new AbortController();
    const to = setTimeout(()=>ctrl.abort(), timeout);
    try{
      const r = await fetch(url, {signal: ctrl.signal});
      if (!r.ok) throw new Error('HTTP '+r.status);
      const ct = r.headers.get('content-type')||'';
      return ct.includes('application/json') ? r.json() : JSON.parse(await r.text());
    } finally { clearTimeout(to); }
  }

  // ---------- localStorage series cache (TTL) ----------
  function getSeriesCache(key){
    try{
      const raw = localStorage.getItem('mfk_series_cache_v1:' + key);
      if (!raw) return null;
      const { t, v } = JSON.parse(raw);
      if (Date.now() - t > SERIES_TTL_MS) return null;
      return v;
    }catch(_){ return null; }
  }
  function setSeriesCache(key, value){
    try{
      localStorage.setItem('mfk_series_cache_v1:' + key, JSON.stringify({ t: Date.now(), v: value }));
    }catch(_){}
  }

  // ---------- FX (host -> host@jina -> frankfurter@jina -> stooq CSV) ----------
  async function fxHistory(base, quote, days=365*5){
    const pairKey = `${base}/${quote}`;
    const memKey  = `${pairKey}|${days}`;
    if (cacheFX.has(memKey)) return cacheFX.get(memKey);

    const lsKey = `FX:${pairKey}:${days}`;
    const fromLS = getSeriesCache(lsKey);
    if (fromLS) { cacheFX.set(memKey, fromLS); return fromLS; }

    const end=new Date(); const start=new Date(end); start.setDate(start.getDate()-days);
    const s=start.toISOString().slice(0,10), e=end.toISOString().slice(0,10);

    const try1 = async () => {
      const j = await fetchJSON(`https://api.exchangerate.host/timeseries?start_date=${s}&end_date=${e}&base=${base}&symbols=${quote}`);
      return j?.rates ? normalizeFX(j.rates, quote) : emptySeries();
    };
    const try2 = async () => {
      const j = await fetchJSON(`https://r.jina.ai/http://api.exchangerate.host/timeseries?start_date=${s}&end_date=${e}&base=${base}&symbols=${quote}`);
      return j?.rates ? normalizeFX(j.rates, quote) : emptySeries();
    };
    const try3 = async () => {
      // przez r.jina.ai, aby nie wymagać dopisywania frankfurter do allowlisty
      const j = await fetchJSON(`https://r.jina.ai/http://api.frankfurter.app/${s}..${e}?from=${base}&to=${quote}`);
      return j?.rates ? normalizeFX(j.rates, quote) : emptySeries();
    };
    const try4 = async () => {
      // Stooq CSV fallback (np. eurusd)
      const code = stooqFxCode(base, quote);
      const txt  = await (await fetch(`https://r.jina.ai/http://stooq.com/q/d/l/?s=${encodeURIComponent(code)}&i=d`)).text();
      const lines = txt.trim().split('\n');
      if (lines.length <= 1) return emptySeries();
      const rows  = lines.slice(1).map(l=>l.split(','));
      const dates = rows.map(r=>r[0]);
      const closes= rows.map(r=> Number(r[4])).filter(Number.isFinite);
      if (closes.length < 2) return emptySeries();
      return { dates: dates.slice(-closes.length), closes };
    };

    let out = emptySeries();
    try{ out = await try1(); }catch(_){}
    if (!out.closes.length){ try{ out = await try2(); }catch(_){} }
    if (!out.closes.length){ try{ out = await try3(); }catch(_){} }
    if (!out.closes.length){ try{ out = await try4(); }catch(_){} }

    cacheFX.set(memKey, out);
    setSeriesCache(lsKey, out);
    return out;
  }

  // kluczowe: rzutuj na Number i filtruj skończone
  function normalizeFX(ratesObj, quote){
    const datesSorted = Object.keys(ratesObj).sort();
    const closes = [];
    const dates  = [];
    for (const d of datesSorted){
      const v = Number(ratesObj[d]?.[quote]);
      if (Number.isFinite(v)) { dates.push(d); closes.push(v); }
    }
    return { dates, closes };
  }

  // ---------- Stocks (Stooq -> Yahoo) ----------
  async function stockHistory(symbol, days=365*5){
    const key = symbol.toUpperCase();
    const memKey = `${key}|${days}`;
    if (cacheStocks.has(memKey)) return cacheStocks.get(memKey);

    const lsKey = `STK:${key}:${days}`;
    const fromLS = getSeriesCache(lsKey);
    if (fromLS) { cacheStocks.set(memKey, fromLS); return fromLS; }

    try{
      const code = stooqCode(symbol);
      const txt  = await (await fetch(`https://r.jina.ai/http://stooq.com/q/d/l/?s=${encodeURIComponent(code)}&i=d`)).text();
      const rows = txt.trim().split('\n').slice(1).map(l=>l.split(','));
      const dates = rows.map(r=>r[0]);
      const closes= rows.map(r=> Number(r[4])).filter(n=>!Number.isNaN(n));
      if (closes.length > 10) {
        const cut = Math.max(0, dates.length - days);
        const out = { dates: dates.slice(cut), closes: closes.slice(cut) };
        cacheStocks.set(memKey, out);
        setSeriesCache(lsKey, out);
        return out;
      }
    }catch(_){}

    try{
      const jy  = await fetchJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d`);
      const res = jy?.chart?.result?.[0];
      const ts  = res?.timestamp || [];
      const cs  = res?.indicators?.quote?.[0]?.close || [];
      const dates = ts.map(t=> new Date(t*1000).toISOString().slice(0,10));
      const values = cs.filter(v=> v!=null);
      const out = { dates: dates.slice(-values.length), closes: values };
      cacheStocks.set(memKey, out);
      setSeriesCache(lsKey, out);
      return out;
    }catch(_){}

    const empty = emptySeries();
    cacheStocks.set(memKey, empty);
    setSeriesCache(lsKey, empty);
    return empty;
  }

  // ---------- LIVE PRICE HUB (wspólne ceny jak w Stock Market) ----------
// Użyj globalnego HUB-a, jeśli ma .get() lub .use(); w innym razie zrób „pusty” fallback.
const PRICE_HUB =
  (typeof window !== 'undefined' && window.PRICE_HUB && (typeof window.PRICE_HUB.get === 'function' || typeof window.PRICE_HUB.use === 'function'))
    ? window.PRICE_HUB
    : { get: () => null, use: (_k, fb=null) => fb };

// Bezpieczny odczyt: preferuj .use(symbol, fallback), a jeśli nie ma – użyj .get()
// ---------- LIVE PRICE (spięcie z resztą aplikacji) ----------
function priceOfStock(sym, fallback){
  const v = (typeof window.getSpot === 'function') ? Number(window.getSpot(sym, null)) : NaN;
  return (Number.isFinite(v) && v > 0) ? v : fallback;
}

function priceOfFx(base, quote, fallback){
  const pair = `${String(base||'').toUpperCase()}/${String(quote||'').toUpperCase()}`;
  const fx = (typeof window.fxRate === 'function') ? Number(window.fxRate(pair)) : NaN;
  return (Number.isFinite(fx) && fx > 0) ? fx : fallback;
}


  // ---------- RYSOWANIE ----------
  function drawSpark(c, values){
    const cssW = c.clientWidth || c.offsetWidth || 220;
    const cssH = c.clientHeight || 38;
    c.width  = Math.max(220, cssW) * DPR;
    c.height = cssH * DPR;
    const ctx = c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);
    if (!values || values.length < 2) return;

    const min=Math.min(...values), max=Math.max(...values);
    const pad = c.height*0.18;
    const step = (c.width)/(values.length-1);
    const yy = v => c.height - ((v-min)/(max-min||1))*(c.height-pad*2) - pad;

    ctx.beginPath(); ctx.moveTo(0,yy(values[0]));
    values.forEach((v,i)=> ctx.lineTo(i*step, yy(v)));
    ctx.lineTo(c.width, c.height); ctx.lineTo(0, c.height); ctx.closePath();

    const up = values.at(-1)>=values[0];
    const grad = ctx.createLinearGradient(0,0,0,c.height);
    if (up) { grad.addColorStop(0,"rgba(0,200,255,0.35)"); grad.addColorStop(1,"rgba(0,200,255,0.08)"); }
    else    { grad.addColorStop(0,"rgba(153,27,27,0.45)");  grad.addColorStop(1,"rgba(244,114,182,0.12)"); }
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath(); ctx.moveTo(0,yy(values[0]));
    values.forEach((v,i)=> ctx.lineTo(i*step, yy(v)));
    ctx.lineWidth=2*DPR; ctx.strokeStyle = up ? "#00ff6a" : "#b91c1c"; ctx.stroke();
  }

  function drawBig(c, values){
    const cssW = c.clientWidth || 720, cssH = 280;
    c.width = cssW * DPR; c.height = cssH * DPR;
    const ctx = c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height);
    if (!values || values.length<2) return;

    const left=48*DPR, right=16*DPR, top=16*DPR, bottom=32*DPR;
    const min=Math.min(...values), max=Math.max(...values);
    const w = c.width - left - right, h = c.height - top - bottom;
    const step = w/(values.length-1);
    const y = v => c.height - bottom - ((v-min)/(max-min||1))*h;

    ctx.strokeStyle='#23304d'; ctx.lineWidth=1*DPR;
    for(let i=0;i<=4;i++){ const yy = top + i*h/4; ctx.beginPath(); ctx.moveTo(left,yy); ctx.lineTo(left+w,yy); ctx.stroke(); }
    ctx.fillStyle='#9ca3af'; ctx.font = `${12*DPR}px system-ui,sans-serif`;
    ctx.fillText(min.toFixed(2), 8*DPR, y(min)+4*DPR);
    ctx.fillText(max.toFixed(2), 8*DPR, y(max)+4*DPR);

    const up = values.at(-1) >= values[0];
    ctx.beginPath(); ctx.moveTo(left, y(values[0]));
    values.forEach((v,i)=> ctx.lineTo(left + i*step, y(v)));
    ctx.lineTo(left + w, c.height - bottom); ctx.lineTo(left, c.height - bottom); ctx.closePath();

    const grad = ctx.createLinearGradient(0, top, 0, c.height - bottom);
    if (up) { grad.addColorStop(0,"rgba(0,200,255,0.35)"); grad.addColorStop(1,"rgba(0,200,255,0.08)"); }
    else    { grad.addColorStop(0,"rgba(153,27,27,0.45)");  grad.addColorStop(1,"rgba(244,114,182,0.12)"); }
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath(); ctx.moveTo(left, y(values[0]));
    values.forEach((v,i)=> ctx.lineTo(left + i*step, y(v)));
    ctx.lineWidth=2*DPR; ctx.strokeStyle = up ? "#00ff6a" : "#b91c1c"; ctx.stroke();
  }

  // ---------- RESAMPLING (D/W/M) ----------
  function resample(dates, values, mode){
    if (!dates?.length || !values?.length) return {dates:[],values:[]};
    if (mode==='D') return {dates:[...dates], values:[...values]};

    const out=[], outD=[], map=new Map();
    for(let i=0;i<dates.length;i++){
      const d=new Date(dates[i]); let key=null;
      if (mode==='W'){
        const dt=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
        const day=dt.getUTCDay()||7; dt.setUTCDate(dt.getUTCDate()+4-day);
        const y=dt.getUTCFullYear(); const ys=new Date(Date.UTC(y,0,1));
        const w=Math.ceil((((dt-ys)/86400000)+1)/7);
        key=`${y}-W${String(w).padStart(2,'0')}`;
      } else if (mode==='M'){
        key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      }
      if (key) map.set(key, {date: dates[i], val: values[i]}); // last in bucket
    }
    [...map.values()].sort((a,b)=> a.date.localeCompare(b.date)).forEach(o=>{ outD.push(o.date); out.push(o.val); });
    return {dates: outD, values: out};
  }

  // ---------- IntersectionObserver do lazy draw ----------
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

  // ---------- KARTY ----------
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
      t.textContent=`${item.base}/${item.quote}`; n.textContent='FX';
      hist=await fxHistory(item.base,item.quote, DAYS_SPARK_FX);
    } else {
      t.textContent=item.symbol.toUpperCase(); n.textContent='Stock';
      hist=await stockHistory(item.symbol, DAYS_SPARK_STOCK);
    }

    const vals = (hist?.closes || []).slice(-120);

    if (vals.length >= 2){
      let last = vals.at(-1);       // domyślnie ostatni close z historii
      const prev = vals.at(-2);     // poprzedni close do liczenia zmiany

      if (item.type === 'stock') {
        // spójnie z Global Trends/Stock Market
        const live = priceOfStock(item.symbol, last);
        if (Number.isFinite(live)) last = live;
      } else {
        // spójnie z Currency Market (fxRate/baseFx)
        const liveFx = priceOfFx(item.base, item.quote, last);
        if (Number.isFinite(liveFx)) last = liveFx;
      }

      p.textContent = fmt(last);
      const ch = last - (prev ?? last);
      const pc = (prev && prev !== 0) ? (ch / prev) * 100 : 0;
      d.textContent = `${ch >= 0 ? '+' : ''}${fmt(ch)} (${pc.toFixed(2)}%)`;
      d.className   = 'wl-diff ' + (ch >= 0 ? 'pos' : 'neg') ;

      // lazy draw – rysuj dopiero gdy karta jest widoczna
      el._wl_values = vals;
      if (io) io.observe(el);
      else requestAnimationFrame(() => drawSpark(spark, vals));
    } else {
      p.textContent='—'; d.textContent='—';
    }

    el.addEventListener('click', ()=> openModal(item));
    removeBtn.addEventListener('click', (e)=>{ 
      e.stopPropagation();
      // usuń TYLKO klikniętą pozycję
      watchlist.splice(idx, 1);
      saveLS(); 
      render();
    });
  }

  function render(){
    if (!$list) return;
    $list.innerHTML='';
    watchlist
      .filter(x => filter==='all' ? true : x.type===filter)
      .forEach((item, idx) => mountCard(item, idx));
  }

  // ---------- MODAL ----------
  function openModal(item){
    if (!$modal) return;
    $modal.setAttribute('aria-hidden','false');
    const ttl = item.type==='fx' ? `${item.base}/${item.quote}` : item.symbol.toUpperCase();
    $title.textContent = ttl;

    // usuń YTD/5Y jeśli są w HTML
    $modal.querySelectorAll('.wl-range button[data-range="YTD"], .wl-range button[data-range="5Y"]').forEach(b=>b.remove());

    const loader = item.type==='fx'
      ? () => fxHistory(item.base,item.quote, 365*5)
      : () => stockHistory(item.symbol, 365*5);

    loader().then(full=>{
      const dates = full?.dates || [];
      const closes= full?.closes || [];
      const ranges = $modal.querySelectorAll('.wl-range button');

      if (dates.length < 2 || closes.length < 2){
        $mPrice.textContent='—'; $mChg.textContent='Brak danych';
        const ctx=$big.getContext('2d'); ctx.clearRect(0,0,$big.width,$big.height);
        ranges.forEach(b=> b.disabled = true);
        return;
      }
      ranges.forEach(b=> b.disabled = false);

      const now = new Date(dates.at(-1));

      function calc(range){
        let d=365; if(range==='1D')d=7; if(range==='5D')d=14; if(range==='1M')d=31;
        if(range==='6M')d=183; if(range==='1Y')d=365;
        const cutoff=new Date(now); cutoff.setDate(cutoff.getDate()-d);
        let idx = dates.findIndex(dt => new Date(dt) >= cutoff); if(idx<0) idx=0;
        const d2=dates.slice(idx), v2=closes.slice(idx);
        if (range==='6M' || range==='1Y') return resample(d2, v2, 'W').values;
        return v2;
      }

      function setRange(btn){
        const rangesArr = Array.from(ranges);
        rangesArr.forEach(b=>b.classList.remove('is-active'));
        btn.classList.add('is-active');
        let vals = calc(btn.dataset.range);
        if (!vals || vals.length < 2) vals = closes.slice(-2);
        if (vals && vals.length>=2){
          let last = vals.at(-1), prev = vals.at(-2);

          // dla akcji pokaż live z HUB-a, dla FX kurs z fxRate – spójnie z pozostałymi panelami
          if (item.type === 'stock') {
            const live = priceOfStock(item.symbol, last);
            if (Number.isFinite(live)) last = live;
          } else {
            const liveFx = priceOfFx(item.base, item.quote, last);
            if (Number.isFinite(liveFx)) last = liveFx;
          }

          $mPrice.textContent = fmt(last);
          const ch = last - (prev ?? last);
          const pc = (prev && prev !== 0) ? (ch / prev) * 100 : 0;
          $mChg.textContent = `${ch>=0?'+':''}${fmt(ch)} (${pc.toFixed(2)}%)`;
          $mChg.style.color = ch>=0?'var(--ok)':'#b91c1c';
          drawBig($big, vals);
        } else {
          $mPrice.textContent='—'; $mChg.textContent='—';
          const ctx=$big.getContext('2d'); ctx.clearRect(0,0,$big.width,$big.height);
        }
      }

      setRange($modal.querySelector('.wl-range button[data-range="1M"]') || ranges[0]);
      Array.from(ranges).forEach(btn => btn.onclick = () => setRange(btn));
    });
  }
  $modal?.querySelector('.wl-close')?.addEventListener('click', ()=> $modal.setAttribute('aria-hidden','true'));
  $modal?.querySelector('.wl-modal__backdrop')?.addEventListener('click', ()=> $modal.setAttribute('aria-hidden','true'));

  // ---------- PICKER (+Add) ----------
  function fillPicker(){
    if (!$pick) return;
    const arr = mode==='fx' ? FX_ALL : STOCKS_ALL;
    $pick.innerHTML = arr.map(v => `<option value="${v}">${v}</option>`).join('');
  }

  function applyMode(next){
    mode = next;
    filter = next;
    fillPicker(); render();
    if ($wlTabs){
      $wlTabs.querySelectorAll('button').forEach(b=> 
        b.classList.toggle('is-active', b.dataset.filter===filter || (filter==='stock' && b.dataset.filter==='stocks'))
      );
    }
  }

  // Topbar – obsłuż dowolny element z data-tab
  document.querySelectorAll('[data-tab]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const t = (btn.getAttribute('data-tab')||'').toLowerCase();
      if (t==='invest' || t==='stocks' || t==='tab-invest') applyMode('stock');
      if (t==='fx'     || t==='currencies' || t==='tab-fx')  applyMode('fx');
    });
  });

  // Watchlist panel tabs
  if ($wlTabs){
    $wlTabs.addEventListener('click', (e)=>{
      const b = e.target.closest('button[data-filter]');
      if (!b) return;
      const f = b.dataset.filter;
      if (f==='all'){ filter='all'; fillPicker(); render(); }
      if (f==='stocks'){ applyMode('stock'); }
      if (f==='fx' || f==='currencies'){ applyMode('fx'); }
    });
  }

  // Add from picker
  $form?.addEventListener('submit', e=>{
    e.preventDefault();
    const val = $pick?.value;
    if (!val) return;
    if (mode==='fx'){
      const p = parsePair(val); if (!p) return;
      watchlist.unshift({type:'fx', base:p.base, quote:p.quote});
    } else {
      watchlist.unshift({type:'stock', symbol: val.toUpperCase()});
    }
    saveLS(); render();
  });

  // ---------- Resize debounce: przerysuj tylko widoczne ----------
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

  // ---------- START ----------
  fillPicker();
  render();
})();
