// ==== Same-origin sandbox guard (allowlist for needed APIs) ====
(function lockNetwork() {
  const of = window.fetch;
  const ALLOW_ORIGINS = new Set([
    location.origin,
    'https://api.exchangerate.host',
    'https://query1.finance.yahoo.com',
    'https://query2.finance.yahoo.com',
    'https://r.jina.ai' // ✅ CORS/GDPR-safe fallback proxy
  ]);
  window.fetch = async function(resource, init) {
    const urlStr = resource instanceof Request ? resource.url : String(resource);
    const u = new URL(urlStr, location.href);
    if (!ALLOW_ORIGINS.has(u.origin)) {
      throw new Error('External fetch blocked: ' + u.origin);
    }
    return of.apply(this, arguments);
  };
})();

// ====== UTIL ======
const DB_KEY = "kidmoney_multi_fx_live_i18n_v1";
const AUTH_KEY = "kidmoney_auth_v1"; // { role: 'guest'|'parent'|'child', childId?: string }
const LANG_KEY = "pf_lang";

// Legacy formatter – zostaje dla zgodności
const PLN = v =>
  new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(v)) + " USD";

// DODANE: prawidłowy formatter USD (używamy w nowych miejscach)
const USD = v =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(v || 0)) + " USD";

// FX-format (4 miejsca, bez sufiksu)
const FX = v =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
    .format(Number(v));

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const nowISO = () => { const d = new Date(); return d.toISOString().slice(0, 10) + "T" + d.toTimeString().slice(0, 8); };

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

// ====== I18N ======
const tData = {
  pl: {
    sim: "Symulacja (offline)", live: "Live (backend)", apiNot: "API: brak połączenia", apiConn: "API: łączenie…",
    fxOk: "FX ok", fxFail: "FX błąd", stOk: "Akcje ok", stFail: "Akcje błąd",
    addedPocket: "Dodano kieszonkowe 10 USD", moved55: "Przeniesiono 5 USD Earnings → Oszczędności",
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
    addedPocket: "Added allowance 10 USD", moved55: "Moved 5 USD Earnings → Savings",
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
      <option value="es">ES</option>
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
  dailyLimit: 50, liveMode: false, trends: { stocks: {}, fx: {} }
};

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
  Object.values(parsed.children || {}).forEach(ch => ensureExpandedStocks(ch));
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
  const target = 30;
  for (const item of STOCK_UNIVERSE) {
    if (ch.stocks.length >= target) break;
    if (!have.has(item.t)) {
      ch.stocks.push({ t: item.t, n: item.n, p: item.p });
      have.add(item.t);
    }
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
      text: "Here you’ll explore how pocket money, savings, and challenges build money skills. You’ll learn the role of jars, how to trade, try stocks and currencies, and grow step by step. Each choice brings you closer to leading your financial story. This journey is safe, exciting, and designed for you to explore, test ideas, and grow with confidence!",
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
  cash:  document.getElementById('miniCash'),   // ⬅ upewnij się, że w HTML masz <div id="miniCash">
  save:  document.getElementById('miniSave'),
  spend: document.getElementById('miniSpend'),
  give:  document.getElementById('miniGive'),
  invest:document.getElementById('miniInvest')
};

function computeAvailableCashFromJars(jars){
  return Number(jars?.save || 0) + Number(jars?.spend || 0) + Number(jars?.give || 0);
}

function renderMiniJars(){
  const ch = activeChild?.();
  if (!ch) {
    // wyczyść pasek gdy brak dziecka
    Object.values(miniEls).forEach(el => { if (el) el.textContent = '0.00 USD'; });
    return;
  }
  const j = ch.jars || { save:0, spend:0, give:0, invest:0 };
  const cash = computeAvailableCashFromJars(j);

  if (miniEls.cash)  miniEls.cash.textContent  = USD(cash);
  if (miniEls.save)  miniEls.save.textContent  = USD(j.save);
  if (miniEls.spend) miniEls.spend.textContent = USD(j.spend);
  if (miniEls.give)  miniEls.give.textContent  = USD(j.give);
  if (miniEls.invest)miniEls.invest.textContent= USD(j.invest);
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
      return { ...s, p: Number(np.toFixed(2)) };
    });
  });
  save(app);
  if (!__qtyTyping) {
    renderStocks(stockSearch?.value || "");
    renderPortfolioStocks();
    renderJars();
    renderProfits();
  }
}, 2000);

let __qtyTyping = false;
document.addEventListener('focusin',  e => {
  if (e.target && (e.target.matches('input[data-fxsell-q]') || e.target.matches('input[data-sell-q]'))) {
    __qtyTyping = true;
  }
});
document.addEventListener('focusout', e => {
  if (e.target && (e.target.matches('input[data-fxsell-q]') || e.target.matches('input[data-sell-q]'))) {
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

// cena BASE/USD niezależnie od QUOTE pary
function rateUsdFromPair(pair) {
  const [A] = pair.split("/");
  const a = baseFx?.[A];
  const usd = baseFx?.USD;
  if (!Number.isFinite(a) || !Number.isFinite(usd) || usd <= 0) return null;
  return a / usd;
}

function fxValueUsd(pair, qty) {
  const rUsd = rateUsdFromPair(pair);
  if (!Number.isFinite(rUsd)) return 0;
  return rUsd * (Number(qty) || 0);
}


// ====== GLOBAL TRENDS ======
const gtPrevFx = {};
const gtPrevStocks = {};
let currentTrendsMode = 'stocks';

function renderGlobalTrends(mode) {
  currentTrendsMode = mode;
  const wrap = document.getElementById('globalTrendsList');
  const sub = document.getElementById('globalTrendsSub');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (mode === 'fx') {
  if (sub) sub.textContent = 'World currency trends';
  const bases = ISO.filter(c => c !== "USD").slice(0, 8);
  bases.forEach(base => {
    const pair = `${base}/USD`;
    const rateNow = Number(fxRate(pair) || 0);
    const prev = gtPrevFx[pair];
    const dir = (typeof prev === 'number') ? (rateNow > prev ? 1 : rateNow < prev ? -1 : 0) : 0;
    const chgPct = (typeof prev === 'number' && prev !== 0) ? ((rateNow - prev) / prev) * 100 : 0;
    gtPrevFx[pair] = rateNow;

    const el = document.createElement('div');
    el.className = 'trend-item';
    const baseName = CURRENCY_NAMES[base] || base;
    el.innerHTML = `
      <div class="trend-head">
        <span>
          <div style="font-weight:700">${base}</div>
          <div class="muted" style="font-size:12px">${baseName}</div>
        </span>
        <span>
          ${FX(rateNow)} ${arrowHtml(dir)}
          <div class="muted" style="font-size:11px">vs USD</div>
        </span>
      </div>
      <div class="trend-sub">${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}%</div>`;
    wrap.appendChild(el);
  });
} else {
  // (reszta bez zmian)

    if (sub) sub.textContent = 'World stock trends';
    const ch = activeChild?.();
    (ch?.stocks || []).slice(0, 6).forEach(s => {
      const prev = gtPrevStocks[s.t];
      const dir = (typeof prev === 'number') ? (s.p > prev ? 1 : s.p < prev ? -1 : 0) : 0;
      const chgPct = (typeof prev === 'number' && prev !== 0) ? ((s.p - prev) / prev) * 100 : 0;
      gtPrevStocks[s.t] = s.p;

      const el = document.createElement('div');
      el.className = 'trend-item';
      el.innerHTML = `
        <div class="trend-head">
          <span>
            <div style="font-weight:700">${s.t}</div>
            <div class="muted" style="font-size:12px">${s.n || ''}</div>
          </span>
          <span>${PLN(s.p)} ${arrowHtml(dir)}</span>
        </div>
        <div class="trend-sub">${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(2)}%</div>`;
      wrap.appendChild(el);
    });
  }
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
    return sum + (p.s || 0) * s.p;
  }, 0);
}
function unrealizedStocks(ch) {
  return Object.entries(ch.portfolio).reduce((sum, [t, p]) => {
    const s = ch.stocks.find(x => x.t === t) || { p: p.b };
    return sum + ((s.p - p.b) * (p.s || 0));
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
  const ref = Number((window.app && app.dailyLimit) || 50);
  const pct = Math.min(90, (value / ref) * 90);
  const withFloor = value > 0 ? Math.max(5, pct) : 0;
  card.style.setProperty('--fill', withFloor.toFixed(2) + '%');
}

// >>> NEW: Available Cash (Savings + Earnings + Donations)
function renderAvailableCash() {
  const ch = activeChild();
  if (!ch || !availableCashEl) return;
  const cash = Number(ch.jars?.save || 0) + Number(ch.jars?.spend || 0) + Number(ch.jars?.give || 0);
availableCashEl.textContent = USD(cash);
}

function renderJars() {
  const ch = activeChild(); if (!ch) return;
  saveAmt && (saveAmt.textContent = PLN(ch.jars.save));
  spendAmt && (spendAmt.textContent = PLN(ch.jars.spend));
  giveAmt && (giveAmt.textContent = PLN(ch.jars.give));
  investAmt && (investAmt.textContent = PLN(ch.jars.invest));
  const net = ch.jars.save + ch.jars.spend + ch.jars.give + portfolioValueStocks(ch) + portfolioValueFx(ch);
  netWorthEl && (netWorthEl.textContent = PLN(net));
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
          <div style="font-weight:700">${PLN(s.p)} ${arrowHtml(dir)}</div>
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
    let vInit = Number(prevVals[t] ?? 1);
    if (!isFinite(vInit) || vInit < 1) vInit = 1;
    if (vInit > qMax) vInit = qMax;

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
               value="${vInit}" class="input" style="width:90px"
               data-sell-q="${t}" placeholder="max ${qMax}">
        <button class="btn" data-sell-row="${t}">${TT().sell || 'Sell'}</button>
        <button class="btn" data-sell-max="${t}">Max</button>
      </td>`;
    portfolioBody.appendChild(tr);
  });

  const has = Object.keys(ch.portfolio).length > 0;
  portfolioEmpty && (portfolioEmpty.style.display = has ? 'none' : 'block');
  tableWrapStocks && (tableWrapStocks.style.display = has ? 'block' : 'none');

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

  // Wpisano parę A/B
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

  // Wpisano kod/nazwę waluty – zawsze pokazuj .../USD
  if (raw) {
    const f = raw.toUpperCase();
    const isUsdQuery = f === "USD" || (CURRENCY_NAMES.USD || "US Dollar").toUpperCase().includes(f);
    let bases = [];
    if (isUsdQuery) {
      bases = ISO.filter(c => c !== "USD");
    } else {
      bases = ISO.filter(code => {
        const name = (CURRENCY_NAMES[code] || code).toUpperCase();
        return code.includes(f) || name.includes(f);
      }).filter(c => c !== "USD");
      if (bases.length === 0) {
        updateFxMoreBtn(0, false);
        save(app);
        return;
      }
    }
    const pairs = bases.map(b => `${b}/USD`);
    const uniq = [...new Set(pairs)];
    uniq.slice(0, 500).forEach(p => { const el = toBtn(p); if (el) fxList.appendChild(el); });
    updateFxMoreBtn(uniq.length, false);
    save(app);
    return;
  }

  // Widok domyślny: wszystkie .../USD
  const allBaseVsUsd = ISO.filter(b => b !== "USD").map(b => `${b}/USD`);
  const uniq = [...new Set(allBaseVsUsd)];
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
    let vInit = Number(prevVals[pair] ?? 1);
    if (!isFinite(vInit) || vInit < 1) vInit = 1;
    if (vInit > qMax) vInit = qMax;

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
               value="${vInit}" class="input" style="width:90px"
               data-fxsell-q="${pair}" placeholder="max ${qMax}">
        <button class="btn" data-fxsell-row="${pair}">${TT().sell || 'Sell'}</button>
        <button class="btn" data-fxmax="${pair}">Max</button>
      </td>`;
    fxBody.appendChild(tr);
  });

  const has = Object.keys(ch.fxPortfolio).length > 0;
  fxEmpty && (fxEmpty.style.display = has ? 'none' : 'block');
  tableWrapFx && (tableWrapFx.style.display = has ? 'block' : 'none');

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
  if (!tradeBox || !ch || !selectedStock) { tradeBox && (tradeBox.style.display = "none"); return; }
  const s = ch.stocks.find(x => x.t === selectedStock);
  const qty = Math.max(1, parseInt(qtyInput.value || "1", 10));
  lastStockUiPrice = s.p;
  if (tradeTitle) tradeTitle.textContent = `Trade ${s.t}`;
  if (costEl) costEl.textContent = PLN(qty * s.p);
  tradeBox.style.display = "block";
}
function buyStock() {
  const ch = activeChild(); if (!ch || !selectedStock) return;
  const s = ch.stocks.find(x => x.t === selectedStock);
  const qty = Math.max(1, parseInt(qtyInput.value || "1", 10));
  const price = (lastStockUiPrice ?? s.p);
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
  const ch = activeChild(); if (!ch) return;
  let pos = ch.portfolio[t] || { s: 0, b: (activeChild().stocks.find(x => x.t === t) || { p: 0 }).p };
  const s = ch.stocks.find(x => x.t === t) || { p: pos.b || 0 };
  let realized = 0;
  const proceeds = s.p * qty;

  const longClose = Math.min(qty, Math.max(0, pos.s));
  const basisOut = longClose * pos.b;
  ch.jars.spend += proceeds;
  ch.jars.invest = Math.max(0, (ch.jars.invest || 0) - basisOut);

  if (pos.s > 0) {
    const close = Math.min(qty, pos.s);
    realized += (s.p - pos.b) * close;
    ch.tradeLedgerStocks.unshift({ ts: nowISO(), t, qty: close, price: s.p, basis: pos.b, pnl: (s.p - pos.b) * close });
    pos.s -= close;
    const remaining = qty - close;
    if (remaining > 0) {
      if (pos.s === 0) { pos.b = s.p; pos.s = -remaining; }
      else { pos.b = s.p; pos.s = -remaining; }
    }
  } else {
    const oldAbs = Math.abs(pos.s);
    const totalAbs = oldAbs + qty;
    pos.b = totalAbs ? (((oldAbs * pos.b) + (qty * s.p)) / totalAbs) : s.p;
    pos.s -= qty;
  }

  ch.realizedStocks += realized;
  if (pos.s === 0) delete ch.portfolio[t];
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
  const ch = activeChild(); if (!ch) return;
  let pos = ch.fxPortfolio[pair] || { q: 0, b: rateUsdFromPair(pair) };
  const rUsd = rateUsdFromPair(pair);
  let realized = 0;
  const proceeds = rUsd * qty;

  const longClose = Math.min(qty, Math.max(0, pos.q));
  const basisOut = longClose * pos.b;
  ch.jars.spend += proceeds;
  ch.jars.invest = Math.max(0, (ch.jars.invest || 0) - basisOut);

  if (pos.q > 0) {
    const close = Math.min(qty, pos.q);
    realized += (rUsd - pos.b) * close;
    ch.tradeLedgerFx.unshift({ ts: nowISO(), pair, qty: close, price: rUsd, basis: pos.b, pnl: (rUsd - pos.b) * close });
    pos.q -= close;
    const remaining = qty - close;
    if (remaining > 0) {
      if (pos.q === 0) { pos.b = rUsd; pos.q = -remaining; }
      else { pos.b = rUsd; pos.q = -remaining; }
    }
  } else {
    const oldAbs = Math.abs(pos.q);
    const totalAbs = oldAbs + qty;
    pos.b = totalAbs ? (((oldAbs * pos.b) + (qty * rUsd)) / totalAbs) : rUsd;
    pos.q -= qty;
  }

  ch.realizedFx += realized;
  if (pos.q === 0) delete ch.fxPortfolio[pair];
  else ch.fxPortfolio[pair] = { q: Number(pos.q), b: Number(pos.b.toFixed(5)) };

  save(app);
  toast(TT().sold ? TT().sold(qty, pair, PLN(realized)) : `Sold ${qty} ${pair} (P/L: ${PLN(realized)})`);
  renderJars();
  renderPortfolioFx();
  renderProfits();
}


// ====== LEDGER / TABS / PARENT GUARD / QUICK ACTIONS / EVENTS ======
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
document.querySelectorAll('.tab').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');

    const t = b.dataset.tab;
    ["invest","fx","profits","parent"].forEach(id=>{
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
  toast(TT().addedPocket || "Added allowance 10 USD");
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

document.getElementById('buyBtn')?.addEventListener('click', buyStock);
document.getElementById('cancelTrade')?.addEventListener('click', () => {
  selectedStock = null; updateTradeBox(); renderStocks(stockSearch?.value || "");
});
document.getElementById('qty')?.addEventListener('input', updateTradeBox);

document.getElementById('fxBuyBtn')?.addEventListener('click', buyFx);
document.getElementById('fxCancelTrade')?.addEventListener('click', () => {
  selectedFxPair = null; updateFxTradeBox(); renderFxList($("#fxSearch")?.value || "");
});
document.getElementById('fxQty')?.addEventListener('input', updateFxTradeBox);

document.getElementById('fxSearch')?.addEventListener('input', (e) => renderFxList(e.target.value));
document.getElementById('fxAddAllMajors')?.addEventListener('click', () => {
  const ch = activeChild(); if (!ch) return;
  const majors = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD"];
  majors.forEach(A => { if (A !== "USD") ch.fxPairsEnabled.push(`${A}/USD`); });
  ch.fxPairsEnabled = [...new Set(ch.fxPairsEnabled)];
  save(app);
  renderFxList(document.getElementById('fxSearch')?.value || "");
});


document.querySelectorAll('[data-add]').forEach(btn => {
  btn.addEventListener('click', () => {
    const ch = activeChild(); if (!ch) return;
    const k = btn.getAttribute('data-add');

    // znajdź input obok tego przycisku
    const input = btn.parentElement.querySelector('.jar-input');
    let inc = Number(input?.value || 0);

    if (!inc || inc <= 0) {
      // fallback – jeśli nic nie wpisano, użyj domyślnej wartości
      inc = (k === 'give' ? 2 : 5);
    }

    ch.jars[k] += inc;
    save(app);
    renderJars();

    if (input) input.value = ''; // wyczyść po użyciu
  });
});


document.getElementById('topupForm')?.addEventListener('submit', e => {
  e.preventDefault();
  if (!requireParent()) return;
  const amt = Number(document.getElementById("topupAmount").value);
  const note = document.getElementById("topupNote").value;
  const pin = document.getElementById("parentPin").value;
  try { verifyPin(app, pin); } catch (err) { return alert(err.message); }
  if (!amt || amt <= 0) return alert("Enter amount > 0");
  const ch = activeChild(); if (!ch) return;
  ch.jars.save += amt;
  addLedger("in", amt, note || "Parent top-up");
  save(app);
  toast(TT().topupDone ? TT().topupDone(PLN(amt)) : `Topped up Savings by ${PLN(amt)}`);
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

document.getElementById('filterType')?.addEventListener('change', () => renderLedger());

childSel?.addEventListener('change', () => {
  app.activeChildId = childSel.value;
  save(app);
  renderAll();
});

// Add Child
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

// ====== LIVE MODE (BEGIN)
let liveFetchLock = false;
let liveFxTimer = null;
let liveStTimer = null;

function setLiveTimers(on) {
  clearInterval(liveFxTimer);
  clearInterval(liveStTimer);
  liveFxTimer = liveStTimer = null;

  if (on) {
    // ⏱️ natychmiastowy pierwszy tick po włączeniu Live
    refreshStocksFromApi();
    refreshFxFromApi();

    // potem cyklicznie
    liveStTimer = setInterval(() => refreshStocksFromApi(), 15000);
    liveFxTimer = setInterval(() => refreshFxFromApi(),     30000);
  }
}
// ==== OFFLINE FX SIMULATION (dodaj) ====
function simulateFxOfflineTick() {
  if (app.liveMode) return;               // tylko offline
  const next = { ...baseFx, PLN: 1 };     // PLN zawsze 1
  ISO.forEach(code => {
    if (code === "PLN") return;
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

// --- Self-test łączności (statusy w #liveStatus + logi w konsoli)
// --- Self-test łączności (proxy-first, direct tylko informacyjnie) ---
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
  const fxUrl   = "https://api.exchangerate.host/latest?base=USD&places=6";

  // proxy + fx → najważniejsze
  const [proxy, fx] = await Promise.all([
    ping(proxyUrl, "Proxy"),
    ping(fxUrl, "FXhost")
  ]);

  // direct Yahoo tylko diagnostycznie, żeby nie psuło UI
  let d1 = { ok:false, code:"-", ms:0 }, d2 = { ok:false, code:"-", ms:0 };
  try { d1 = await ping("https://query1.finance.yahoo.com/v7/finance/quote?symbols="+encodeURIComponent(q), "Yahoo#1"); } catch {}
  try { d2 = await ping("https://query2.finance.yahoo.com/v7/finance/quote?symbols="+encodeURIComponent(q), "Yahoo#2"); } catch {}

  const ok = (proxy.ok && fx.ok);
  const line = `${proxy.ok ? "✅" : "❌"} Proxy(${proxy.code}) • ${fx.ok ? "✅" : "❌"} FXhost(${fx.code}) • direct: ${d1.code}/${d2.code}`;
  if (s) s.textContent = "API self-test: " + line;

  window.__lastSelfTest = { proxy, fx, d1, d2, ok };
  console.log("[LIVE SELF-TEST]", window.__lastSelfTest);
  return window.__lastSelfTest;
}


// --- Jednorazowy refresh (FX + akcje) z self-testem + sufiks direct/proxy
async function forceLiveRefresh() {
  if (liveFetchLock) return false;
  liveFetchLock = true;

  const s = document.getElementById('liveStatus');
  if (s) s.textContent = TT().apiConn;

  try {
    let st = null, okNet = false;
    try { st = await liveSelfTest(); okNet = !!st.ok; } catch { okNet = false; }

    if (!okNet) {
      if (s) s.textContent = "API: trying via proxy…";
      console.warn("[forceLiveRefresh] self-test failed; trying fetchers anyway.");
    }

    const [fxRes, stRes] = await Promise.allSettled([
      refreshFxFromApi(),
      refreshStocksFromApi()
    ]);
    const fxOk = ((fxRes.status === 'fulfilled') && fxRes.value) === true;
    const stOk = ((stRes.status === 'fulfilled') && stRes.value) === true;

    // sufiks: direct / proxy / offline
    // sufiks: direct / proxy / offline
let route = 'offline';
if (st) {
  const directOk = (st.d1?.ok || st.d2?.ok); // ✅ poprawione nazwy
  const proxyOk  = !!st.proxy?.ok;
  route = directOk ? 'direct' : (proxyOk ? 'proxy' : 'offline');
}
if (s) s.textContent =
  `API: ${fxOk ? TT().fxOk : TT().fxFail} • ${stOk ? TT().stOk : TT().stFail} (via ${route})`;


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
    BRKB: 'BRK-B',    // Berkshire Hathaway B
    // dodawaj tutaj kolejne mapowania, gdyby coś nie wracało z Yahoo
  };
  return map[sym] || sym;
}

// ====== LIVE DATA FETCHERS (BEGIN)

// --- wspólny helper do Yahoo z chunkowaniem + fallback r.jina.ai + lepsze logi ---
// --- YAHOO (proxy-first) + odporne parsowanie ---
async function yahooQuote(symbolsArr) {
  var CHUNK = 10;
  var chunks = [];
  for (var i = 0; i < symbolsArr.length; i += CHUNK) chunks.push(symbolsArr.slice(i, i + CHUNK));

  function pickPrice(q) {
    var cand = [ q?.regularMarketPrice, q?.postMarketPrice, q?.preMarketPrice, q?.bid, q?.ask ];
    for (var i = 0; i < cand.length; i++) { var v = cand[i]; if (typeof v === "number" && isFinite(v)) return Number(v); }
    return null;
  }

  async function fetchList(symbolsCsv) {
    var urls = [
      "https://r.jina.ai/http://query1.finance.yahoo.com/v7/finance/quote?symbols=" + encodeURIComponent(symbolsCsv) + "&nocache=" + Date.now(),
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" + encodeURIComponent(symbolsCsv) + "&nocache=" + Date.now(),
      "https://query2.finance.yahoo.com/v7/finance/quote?symbols=" + encodeURIComponent(symbolsCsv) + "&nocache=" + Date.now()
    ];
    for (var k = 0; k < urls.length; k++) {
      var url = urls[k];
      try {
        var r = await fetch(url, { headers: { "Accept": "application/json" } });
        if (!r.ok) throw new Error("HTTP " + r.status);
        // proxy bywa z 'text/plain' – parsuj bezpiecznie
        var j;
        try { j = await r.json(); } catch { j = JSON.parse(await r.text()); }
        var list = (j && j.quoteResponse && j.quoteResponse.result) || [];
        if (Array.isArray(list) && list.length) return list;
        console.warn("[yahooQuote] empty list from", url, j);
      } catch (e) {
        console.warn("[yahooQuote] fail", url, e);
      }
    }
    return [];
  }

  var out = [];
  for (var c = 0; c < chunks.length; c++) {
    var list = await fetchList(chunks[c].join(","));
    if (list && list.length) out.push.apply(out, list);
  }
  out._pickPrice = pickPrice;
  return out;
}

// ===== LIVE DATA FETCHERS (BEGIN)

// ===== LIVE FX FETCHER (robust) =====
// Buduje pełną mapę: baseFx[CODE] = PLN za 1 CODE
// Źródła: 1) exchangerate.host (PRIMARY, base=USD), 2) Yahoo (uzupełnia braki), 3) fallbacki
async function refreshFxFromApi() {
  try {
    const next = { PLN: 1 };

    // 1) exchangerate.host — PRIMARY (base=USD)
    async function fetchFxBaseUsd() {
      const urls = [
        "https://api.exchangerate.host/latest?base=USD&places=6",
        "https://r.jina.ai/http://api.exchangerate.host/latest?base=USD&places=6"
      ];
      for (let k = 0; k < urls.length; k++) {
        try {
          const r = await fetch(urls[k], { headers: { "Accept": "application/json" } });
          if (!r.ok) throw new Error("HTTP " + r.status);
          try { return await r.json(); } catch { return JSON.parse(await r.text()); }
        } catch (e) { console.warn("[FXhost] fail", urls[k], e); }
      }
      return null;
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

    // 3) Gwarancje i fallbacki
    // Jeśli nadal nie mamy USD, spróbuj policzyć z base=PLN (odwrotność)
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

async function refreshStocksFromApi() {
  try {
    const ch = activeChild(); if (!ch) return false;
    const symbolsArr = (ch.stocks || []).map(s => mapToYahoo(s.t));
    if (!symbolsArr.length) return false;

    const list = await yahooQuote(symbolsArr);
    const pickPrice = list._pickPrice || (q => q?.regularMarketPrice ?? null);
    if (!Array.isArray(list) || !list.length) {
      console.warn("Stocks: empty response – keeping previous prices");
      return false; // nie przerywaj – UI pokaże status, ale cykl leci dalej
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
  }
}, 2000);


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
  }
}, 2000);

// Odświeżaj Global Trends
setInterval(() => { renderGlobalTrends(currentTrendsMode); }, app.liveMode ? 15000 : 3000);

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
  const tr = TT();
  if (isParent()) {
    authBadge && (authBadge.textContent = tr.badgeParent || "Parent");
    loginBtn && loginBtn.classList.add('hidden');
    logoutBtn && logoutBtn.classList.remove('hidden');
  } else if (isChild()) {
    const ch = activeChild();
    authBadge && (authBadge.textContent = (tr.badgeChild ? tr.badgeChild(ch?.name) : `Child: ${ch?.name || ""}`));
    loginBtn && loginBtn.classList.add('hidden');
    logoutBtn && logoutBtn.classList.remove('hidden');
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
  appAuth = { role: 'guest' }; saveAuth(appAuth); applyAuthUI(); toast('Logged out');
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

  const lob = document.getElementById("logoutBtn");
  if (lob && !lob._wired) {
    lob.addEventListener("click", () => { appAuth = { role:'guest' }; saveAuth(appAuth); applyAuthUI(); toast('Logged out'); });
    lob._wired = true;
  }
}, 0);
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
