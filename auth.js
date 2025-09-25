(function(){
/* ==========================================================================
 * Money Flow Kids — Local Auth (Register/Login per user)
 * Front-only, Live Server friendly, hashed secrets via Web Crypto.
 * ========================================================================== */

// globalny klucz auth – jeśli już istnieje, nie nadpisujemy
window.AUTH_KEY = window.AUTH_KEY || 'mfk-auth-v1';

const USERS_KEY   = "mfk_users_v1";
const SESSION_KEY = "mfk_session_v1";
// const AUTH_KEY  = "kidmoney_auth_v1"; // ← USUNIĘTE, używamy window.AUTH_KEY
const DB_PREFIX   = "mfk_db_v1:";
const LEGACY_DB   = "kidmoney_multi_fx_live_i18n_v1";

const $      = s => document.querySelector(s);
const nowIso = () => new Date().toISOString();
const toHex  = buf => Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
const fromUtf8 = str => new TextEncoder().encode(str);
const uuid = () => ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>
  (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
);

async function hashSecret(secret, saltHex){
  const data = fromUtf8(saltHex + ":" + String(secret));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

function getUsers(){
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || { byId:{}, byEmail:{} }; }
  catch { return { byId:{}, byEmail:{} }; }
}
function setUsers(db){ localStorage.setItem(USERS_KEY, JSON.stringify(db)); }

function getSession(){
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; }
  catch { return null; }
}
function setSession(s){ localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); }

function userDbKey(userId){ return `${DB_PREFIX}${userId}`; }

function getCurrentUser(){
  const s = getSession();
  if(!s || !s.userId) return null;
  const db = getUsers();
  return db.byId[s.userId] || null;
}

function requireParentRole(){
  const u = getCurrentUser();
  if(!u || u.role !== "parent") throw new Error("Parent role required");
  return true;
}

async function registerUser({ email, name, secret, role }){
  const emailNorm = String(email||"").trim().toLowerCase();
  if(!emailNorm || !secret) throw new Error("Email and PIN/Password required");
  if(role !== "parent" && role !== "child") throw new Error("Role must be parent or child");

  const users = getUsers();
  if(users.byEmail[emailNorm]) throw new Error("User already exists");

  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashSecret(secret, salt);
  const id   = uuid();

  const u = { id, email: emailNorm, name: name||"", role, salt, hash, createdAt: nowIso() };
  users.byId[id] = u;
  users.byEmail[emailNorm] = id;
  setUsers(users);

  const token = uuid();
  setSession({ token, userId: id, issuedAt: nowIso() });
  localStorage.setItem(window.AUTH_KEY, JSON.stringify({ role, userId: id }));
  migrateLegacyDbIfNeeded(id);
  return u;
}

async function loginUser({ email, secret }){
  const emailNorm = String(email||"").trim().toLowerCase();
  const users = getUsers();
  const id = users.byEmail[emailNorm];
  if(!id) throw new Error("User not found");

  const u = users.byId[id];
  const hash = await hashSecret(secret, u.salt);
  if(hash !== u.hash) throw new Error("Invalid credentials");

  const token = uuid();
  setSession({ token, userId: u.id, issuedAt: nowIso() });
  localStorage.setItem(window.AUTH_KEY, JSON.stringify({ role: u.role, userId: u.id }));
  migrateLegacyDbIfNeeded(u.id);
  return u;
}

function logoutUser(){
  clearSession();
  localStorage.removeItem(window.AUTH_KEY);
}

function migrateLegacyDbIfNeeded(userId){
  try{
    const legacy = localStorage.getItem(LEGACY_DB);
    if(!legacy) return;
    const key = userDbKey(userId);
    if(!localStorage.getItem(key)){
      localStorage.setItem(key, legacy);
    }
  }catch(e){}
}

// === Weryfikacja tajemnicy bieżącego użytkownika (np. PIN rodzica) ===
async function verifyParentSecret(secret){
  const u = getCurrentUser();
  if(!u) throw new Error("Not logged in");
  if(u.role !== "parent") throw new Error("Parent role required");
  const h = await hashSecret(secret, u.salt);
  return h === u.hash;
}

// --- UI modal ---
function ensureAuthUI(){
  if($("#authModal")) return;

  const root = document.createElement("div");
  root.innerHTML = `
  <div id="authModal" class="auth-modal hidden">
    <div class="auth-card">
      <div class="auth-tabs">
        <button class="auth-tab is-active" data-tab="login">Login</button>
        <button class="auth-tab" data-tab="register">Register</button>
        <button class="auth-close" id="authClose">×</button>
      </div>

      <div class="auth-panel" data-panel="login">
        <form id="loginForm" autocomplete="on">
          <label>Email
            <input type="email" id="loginEmail" required placeholder="you@example.com" />
          </label>
          <label>PIN / Password
            <input type="password" id="loginSecret" required inputmode="numeric" />
          </label>
          <div class="auth-actions">
            <button type="submit" class="btn-primary">Log in</button>
          </div>
        </form>
      </div>

      <div class="auth-panel hidden" data-panel="register">
        <form id="registerForm" autocomplete="on">
          <label>Name
            <input type="text" id="regName" placeholder="Your name" />
          </label>
          <label>Email
            <input type="email" id="regEmail" required placeholder="you@example.com" />
          </label>
          <label>Choose role
            <select id="regRole">
              <option value="parent">Parent</option>
              <option value="child">Child</option>
            </select>
          </label>
          <label>PIN / Password
            <input type="password" id="regSecret" required inputmode="numeric" minlength="4" />
          </label>
          <div class="auth-actions">
            <button type="submit" class="btn-primary">Create account</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
  document.body.appendChild(root.firstElementChild);

  // Przełączanie zakładek
  document.querySelectorAll(".auth-tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".auth-tab").forEach(b=>b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".auth-panel").forEach(p=>p.classList.add("hidden"));
      document.querySelector(`.auth-panel[data-panel="${tab}"]`)?.classList.remove("hidden");
    });
  });

  // Zamknij modal krzyżykiem
  $("#authClose")?.addEventListener("click", ()=> $("#authModal").classList.add("hidden"));

  // === ADAPTER ID-ków przycisków (Twoje #loginBtn/#logoutBtn vs domyślne #btnLogin/#btnLogout)
  const loginEl  = document.querySelector("#btnLogin")  || document.querySelector("#loginBtn");
  const logoutEl = document.querySelector("#btnLogout") || document.querySelector("#logoutBtn");

  // Otwieranie nowego modala
  loginEl?.addEventListener("click", ()=> {
    $("#authModal")?.classList.remove("hidden");
  });

  // Wylogowanie przez nowy moduł + odświeżenie UI
  logoutEl?.addEventListener("click", ()=>{
    logoutUser();
    (document.querySelector("#btnLogin")  || document.querySelector("#loginBtn"))?.classList.remove("hidden");
    (document.querySelector("#btnLogout") || document.querySelector("#logoutBtn"))?.classList.add("hidden");
    if(window.MFK_APP?.onLoggedOut) window.MFK_APP.onLoggedOut();
  });

  // SUBMITY FORMULARZY
  $("#loginForm")?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    try{
      const email  = $("#loginEmail").value;
      const secret = $("#loginSecret").value;
      const u = await loginUser({ email, secret });
      $("#authModal").classList.add("hidden");
      (document.querySelector("#btnLogin")  || document.querySelector("#loginBtn"))?.classList.add("hidden");
      (document.querySelector("#btnLogout") || document.querySelector("#logoutBtn"))?.classList.remove("hidden");
      if(window.MFK_APP?.onLoggedIn) window.MFK_APP.onLoggedIn(u);
    }catch(err){ alert(err.message || "Login failed"); }
  });

  $("#registerForm")?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    try{
      const name   = $("#regName").value;
      const email  = $("#regEmail").value;
      const role   = $("#regRole").value;
      const secret = $("#regSecret").value;
      const u = await registerUser({ name, email, role, secret });
      $("#authModal").classList.add("hidden");
      (document.querySelector("#btnLogin")  || document.querySelector("#loginBtn"))?.classList.add("hidden");
      (document.querySelector("#btnLogout") || document.querySelector("#logoutBtn"))?.classList.remove("hidden");
      if(window.MFK_APP?.onLoggedIn) window.MFK_APP.onLoggedIn(u);
    }catch(err){ alert(err.message || "Register failed"); }
  });

  // Sync przycisków na starcie
  const user = getCurrentUser();
  if(user){
    (document.querySelector("#btnLogin")  || document.querySelector("#loginBtn"))?.classList.add("hidden");
    (document.querySelector("#btnLogout") || document.querySelector("#logoutBtn"))?.classList.remove("hidden");
  }else{
    (document.querySelector("#btnLogin")  || document.querySelector("#loginBtn"))?.classList.remove("hidden");
    (document.querySelector("#btnLogout") || document.querySelector("#logoutBtn"))?.classList.add("hidden");
  }
}

// ===== KOŃCOWY EXPORT API (tylko raz) =====
window.MFK_AUTH = {
  ensureAuthUI,
  getCurrentUser,
  registerUser,
  loginUser,
  logoutUser,
  requireParentRole,
  userDbKey,
  migrateLegacyDbIfNeeded,
  verifyParentSecret
};

})();
