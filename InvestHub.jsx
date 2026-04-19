import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";

// ============================================================
// SUPABASE CONFIG — substitua com suas credenciais
// ============================================================
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

// ============================================================
// SUPABASE CLIENT (sem biblioteca externa)
// ============================================================
const supabase = {
  _headers: {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  },
  _token: null,
  setToken(token) { this._token = token; this._headers.Authorization = `Bearer ${token}`; },
  clearToken() { this._token = null; this._headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`; },

  async from(table) {
    const base = `${SUPABASE_URL}/rest/v1/${table}`;
    const h = { ...this._headers };
    return {
      select: async (cols = "*", opts = {}) => {
        let url = `${base}?select=${cols}`;
        if (opts.eq) Object.entries(opts.eq).forEach(([k, v]) => { url += `&${k}=eq.${v}`; });
        if (opts.order) url += `&order=${opts.order}`;
        const r = await fetch(url, { headers: { ...h, Prefer: "return=representation" } });
        return r.json();
      },
      insert: async (data) => {
        const r = await fetch(base, { method: "POST", headers: { ...h, Prefer: "return=representation" }, body: JSON.stringify(data) });
        return r.json();
      },
      update: async (data, match) => {
        let url = `${base}?`;
        Object.entries(match).forEach(([k, v]) => { url += `${k}=eq.${v}&`; });
        const r = await fetch(url, { method: "PATCH", headers: { ...h, Prefer: "return=representation" }, body: JSON.stringify(data) });
        return r.json();
      },
      upsert: async (data) => {
        const r = await fetch(base, { method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(data) });
        return r.json();
      },
      delete: async (match) => {
        let url = `${base}?`;
        Object.entries(match).forEach(([k, v]) => { url += `${k}=eq.${v}&`; });
        const r = await fetch(url, { method: "DELETE", headers: h });
        return r.ok;
      },
    };
  },

  auth: {
    async signInWithGoogle() {
      const redirectTo = window.location.origin + window.location.pathname;
      window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
    },
    async getSession() {
      const hash = window.location.hash;
      if (hash.includes("access_token")) {
        const params = new URLSearchParams(hash.slice(1));
        const token = params.get("access_token");
        const refresh = params.get("refresh_token");
        if (token) {
          localStorage.setItem("inv_token", token);
          localStorage.setItem("inv_refresh", refresh || "");
          window.history.replaceState({}, document.title, window.location.pathname);
          return { token, user: await this._getUser(token) };
        }
      }
      const stored = localStorage.getItem("inv_token");
      if (stored) return { token: stored, user: await this._getUser(stored) };
      return null;
    },
    async _getUser(token) {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
      });
      if (!r.ok) { localStorage.removeItem("inv_token"); return null; }
      return r.json();
    },
    signOut() {
      localStorage.removeItem("inv_token");
      localStorage.removeItem("inv_refresh");
      window.location.reload();
    }
  }
};

// ============================================================
// PRICE APIs
// ============================================================
const PriceAPI = {
  cache: {},
  async getBR(ticker) {
    if (this.cache[ticker] && Date.now() - this.cache[ticker].ts < 900000) return this.cache[ticker].data;
    try {
      const r = await fetch(`https://brapi.dev/api/quote/${ticker}?fundamental=true`);
      const d = await r.json();
      if (d.results?.[0]) {
        const q = d.results[0];
        const data = {
          price: q.regularMarketPrice,
          change_pct: q.regularMarketChangePercent,
          pl: q.priceEarnings,
          pvp: q.priceToBook,
          dy: q.dividendYield,
          ma200: q.twoHundredDayAverage,
        };
        this.cache[ticker] = { data, ts: Date.now() };
        return data;
      }
    } catch {}
    return null;
  },
  async getCrypto(id) {
    if (this.cache[id] && Date.now() - this.cache[id].ts < 300000) return this.cache[id].data;
    try {
      const map = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana" };
      const coinId = map[id] || id.toLowerCase();
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd,brl&include_24hr_change=true`);
      const d = await r.json();
      if (d[coinId]) {
        const data = { price: d[coinId].brl, price_usd: d[coinId].usd, change_pct: d[coinId].brl_24h_change };
        this.cache[id] = { data, ts: Date.now() };
        return data;
      }
    } catch {}
    return null;
  },
};

// ============================================================
// APP CONTEXT
// ============================================================
const AppCtx = createContext({});
const useApp = () => useContext(AppCtx);

// ============================================================
// MOCK DATA (para demonstração sem Supabase configurado)
// ============================================================
const MOCK_PORTFOLIO = [
  { id: "1", ticker: "ITSA4", name: "Itaúsa", asset_class: "stock_br", sector: "Financeiro", quantity: 120, avg_price: 9.82, avg_price_net: 8.95, total_dividends_received: 104.4, total_dividends_used: 60, is_c20a: true, c20a_target_min: 500, c20a_target_max: 1000, estimated_monthly_dividend_per_share: 0.07, currency: "BRL" },
  { id: "2", ticker: "MXRF11", name: "Maxi Renda", asset_class: "fii", sector: "Papéis", quantity: 340, avg_price: 9.91, avg_price_net: 9.45, total_dividends_received: 287.2, total_dividends_used: 155, is_c20a: true, c20a_target_min: 500, c20a_target_max: 1000, estimated_monthly_dividend_per_share: 0.08, currency: "BRL" },
  { id: "3", ticker: "WEGE3", name: "WEG", asset_class: "stock_br", sector: "Industrial", quantity: 50, avg_price: 38.5, avg_price_net: 37.2, total_dividends_received: 95, total_dividends_used: 60, is_c20a: false, c20a_target_min: 500, c20a_target_max: 1000, estimated_monthly_dividend_per_share: 0.12, currency: "BRL" },
  { id: "4", ticker: "BTC", name: "Bitcoin", asset_class: "crypto", sector: null, quantity: 0.05, avg_price: 285000, avg_price_net: 285000, total_dividends_received: 0, total_dividends_used: 0, is_c20a: false, c20a_target_min: 500, c20a_target_max: 1000, estimated_monthly_dividend_per_share: 0, currency: "BRL" },
  { id: "5", ticker: "HGLG11", name: "CSHG Logística", asset_class: "fii", sector: "Logística", quantity: 60, avg_price: 165.2, avg_price_net: 159.8, total_dividends_received: 540, total_dividends_used: 330, is_c20a: true, c20a_target_min: 500, c20a_target_max: 1000, estimated_monthly_dividend_per_share: 1.4, currency: "BRL" },
  { id: "6", ticker: "TESOURO-IPCA-2035", name: "Tesouro IPCA+ 2035", asset_class: "fixed_income", sector: "Governo", quantity: 2.5, avg_price: 1000, avg_price_net: 1000, total_dividends_received: 180, total_dividends_used: 0, is_c20a: false, c20a_target_min: 500, c20a_target_max: 1000, estimated_monthly_dividend_per_share: 6, currency: "BRL" },
];

const MOCK_DIVIDENDS = [
  { id: "d1", ticker: "MXRF11", total_amount: 27.2, payment_date: "2026-04-15", available_balance: 12.0 },
  { id: "d2", ticker: "ITSA4", total_amount: 8.4, payment_date: "2026-03-28", available_balance: 8.4 },
  { id: "d3", ticker: "HGLG11", total_amount: 84.0, payment_date: "2026-04-12", available_balance: 34.0 },
];

const MOCK_PRICES = {
  ITSA4: { price: 10.22, change_pct: 0.98, pl: 9.2, pvp: 1.45, dy: 5.8, ma200: 9.85 },
  MXRF11: { price: 9.87, change_pct: -0.13, pl: null, pvp: 0.98, dy: 9.7, ma200: 9.92 },
  WEGE3: { price: 41.2, change_pct: 1.42, pl: 32.1, pvp: 8.4, dy: 1.2, ma200: 38.1 },
  BTC: { price: 320000, change_pct: 2.1, pl: null, pvp: null, dy: null, ma200: 290000 },
  HGLG11: { price: 168.5, change_pct: 0.3, pl: null, pvp: 1.02, dy: 10.1, ma200: 162.0 },
  "TESOURO-IPCA-2035": { price: 1045, change_pct: 0.05, pl: null, pvp: null, dy: null, ma200: null },
};

// ============================================================
// HELPERS
// ============================================================
const fmt = {
  brl: (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0),
  pct: (v) => `${v >= 0 ? "+" : ""}${Number(v || 0).toFixed(2)}%`,
  num: (v, d = 2) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }),
};

const classLabel = { stock_br: "Ação BR", stock_us: "Ação EUA", fii: "FII", fixed_income: "Renda Fixa", crypto: "Cripto", etf_br: "ETF BR", etf_us: "ETF EUA", other: "Outro" };
const classColor = { stock_br: "#4ade80", stock_us: "#60a5fa", fii: "#f59e0b", fixed_income: "#a78bfa", crypto: "#fb923c", etf_br: "#34d399", etf_us: "#93c5fd", other: "#94a3b8" };

function getMagicNumber(price, dividendPerShare) {
  if (!dividendPerShare || dividendPerShare <= 0) return null;
  return Math.ceil(price / dividendPerShare);
}

function getAttractiveBadge(ticker, prices) {
  const p = prices[ticker];
  if (!p) return null;
  let score = 0;
  const reasons = [];
  if (p.pl && p.pl < 12) { score++; reasons.push(`P/L ${fmt.num(p.pl, 1)}x`); }
  if (p.pvp && p.pvp < 1.2) { score++; reasons.push(`P/VP ${fmt.num(p.pvp, 2)}x`); }
  if (p.dy && p.dy > 6) { score++; reasons.push(`DY ${fmt.num(p.dy, 1)}%`); }
  if (p.ma200 && p.price < p.ma200) { score++; reasons.push("Abaixo MM200"); }
  if (score >= 2) return { level: score >= 3 ? "strong" : "mild", reasons };
  return null;
}

// ============================================================
// THEME CSS
// ============================================================
const getThemeVars = (theme) => theme === "dark" ? `
  --bg: #0a0e1a;
  --bg2: #111827;
  --bg3: #1e2433;
  --bg4: #252d3d;
  --border: #2a3347;
  --text: #e2e8f0;
  --text2: #94a3b8;
  --text3: #64748b;
  --accent: #3b82f6;
  --accent2: #6366f1;
  --green: #22c55e;
  --red: #ef4444;
  --amber: #f59e0b;
  --card-shadow: 0 4px 24px rgba(0,0,0,0.4);
` : `
  --bg: #f0f4f8;
  --bg2: #ffffff;
  --bg3: #f8fafc;
  --bg4: #e2e8f0;
  --border: #cbd5e1;
  --text: #0f172a;
  --text2: #475569;
  --text3: #94a3b8;
  --accent: #2563eb;
  --accent2: #4f46e5;
  --green: #16a34a;
  --red: #dc2626;
  --amber: #d97706;
  --card-shadow: 0 4px 24px rgba(0,0,0,0.08);
`;

// ============================================================
// COMPONENTS
// ============================================================

// --- Badge ---
function Badge({ children, color = "accent", size = "sm" }) {
  const colors = {
    accent: "background:rgba(59,130,246,0.15);color:var(--accent)",
    green: "background:rgba(34,197,94,0.15);color:var(--green)",
    red: "background:rgba(239,68,68,0.15);color:var(--red)",
    amber: "background:rgba(245,158,11,0.15);color:var(--amber)",
    purple: "background:rgba(99,102,241,0.15);color:var(--accent2)",
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: size === "sm" ? "2px 8px" : "4px 12px", borderRadius: 999, fontSize: size === "sm" ? 11 : 13, fontWeight: 600, letterSpacing: "0.02em", ...Object.fromEntries(colors[color].split(";").map(s => { const [k, v] = s.split(":"); return [k.replace(/-([a-z])/g, g => g[1].toUpperCase()), v]; })) }}>
      {children}
    </span>
  );
}

// --- Card ---
function Card({ children, style = {}, className = "" }) {
  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, boxShadow: "var(--card-shadow)", ...style }}>
      {children}
    </div>
  );
}

// --- Stat ---
function Stat({ label, value, sub, color, badge }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color: color || "var(--text)", lineHeight: 1.1 }}>{value}</span>
      {sub && <span style={{ fontSize: 12, color: "var(--text2)" }}>{sub}</span>}
      {badge}
    </div>
  );
}

// --- Mini Donut ---
function MiniDonut({ data, size = 120 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  let offset = 0;
  const r = 40, cx = 60, cy = 60, stroke = 16;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {data.map((d, i) => {
        const pct = d.value / total;
        const dash = circ * pct;
        const gap = circ - dash;
        const rotation = offset * 360 - 90;
        offset += pct;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${gap}`} strokeDashoffset={0}
            transform={`rotate(${rotation} ${cx} ${cy})`} opacity={0.85} />
        );
      })}
      <circle cx={cx} cy={cy} r={r - stroke / 2 - 2} fill="var(--bg2)" />
    </svg>
  );
}

// --- Attractive Badge ---
function AttractiveBadge({ ticker, prices }) {
  const b = getAttractiveBadge(ticker, prices);
  if (!b) return null;
  return (
    <span title={b.reasons.join(" · ")} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: b.level === "strong" ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)", color: b.level === "strong" ? "var(--green)" : "var(--amber)", cursor: "help", border: `1px solid ${b.level === "strong" ? "rgba(34,197,94,0.4)" : "rgba(245,158,11,0.4)"}` }}>
      ✦ {b.level === "strong" ? "ATRAENTE" : "ATENÇÃO"}
    </span>
  );
}

// ============================================================
// PAGES
// ============================================================

// --- LOGIN PAGE ---
function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", flexDirection: "column", gap: 32 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>◈</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.03em" }}>InvestHub</h1>
        <p style={{ color: "var(--text2)", marginTop: 8, fontSize: 15 }}>Sua carteira, do seu jeito</p>
      </div>
      <Card style={{ width: 340, textAlign: "center" }}>
        <p style={{ color: "var(--text2)", marginBottom: 20, fontSize: 14 }}>Entre com sua conta Google para acessar sua carteira</p>
        <button onClick={() => supabase.auth.signInWithGoogle()} style={{ width: "100%", padding: "12px 20px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--text)", fontWeight: 600, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Entrar com Google
        </button>
        <p style={{ color: "var(--text3)", fontSize: 11, marginTop: 16 }}>Demo mode: clique no botão acima ou use os dados de exemplo já carregados abaixo</p>
        <button onClick={() => window.__demoMode = true || window.location.reload()} style={{ marginTop: 8, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--accent)", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
          Ver demo sem login →
        </button>
      </Card>
    </div>
  );
}

// --- DASHBOARD ---
function Dashboard({ portfolio, dividends, prices, profile }) {
  const totalPatrimony = portfolio.reduce((s, a) => {
    const p = prices[a.ticker];
    return s + (p ? p.price * a.quantity : a.avg_price * a.quantity);
  }, 0);

  const totalCost = portfolio.reduce((s, a) => s + a.avg_price_net * a.quantity, 0);
  const totalReturn = totalPatrimony - totalCost;
  const returnPct = totalCost ? (totalReturn / totalCost) * 100 : 0;

  const byClass = {};
  portfolio.forEach(a => {
    const p = prices[a.ticker];
    const val = (p ? p.price : a.avg_price) * a.quantity;
    byClass[a.asset_class] = (byClass[a.asset_class] || 0) + val;
  });

  const donutData = Object.entries(byClass).map(([k, v]) => ({ label: classLabel[k], value: v, color: classColor[k] }));

  // balanceamento por idade
  const age = profile?.age || 40;
  const rfTarget = profile?.target_rf_pct || age;
  const fiiTarget = profile?.target_fii_pct || (100 - age) / 2;
  const rvTarget = profile?.target_rv_pct || (100 - age) / 2;

  const totalByClass = (cls) => Object.entries(byClass).filter(([k]) => k === cls).reduce((s, [, v]) => s + v, 0);
  const rfPct = (((byClass.fixed_income || 0)) / totalPatrimony) * 100;
  const fiiPct = ((byClass.fii || 0) / totalPatrimony) * 100;
  const rvPct = (((byClass.stock_br || 0) + (byClass.stock_us || 0) + (byClass.crypto || 0)) / totalPatrimony) * 100;

  const totalDivAvailable = dividends.reduce((s, d) => s + (d.available_balance || 0), 0);
  const monthlyDivEstimate = portfolio.reduce((s, a) => {
    const p = prices[a.ticker];
    return s + (a.estimated_monthly_dividend_per_share || 0) * a.quantity;
  }, 0);

  const BalBar = ({ label, current, target, color }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text2)" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: Math.abs(current - target) > 5 ? "var(--amber)" : "var(--green)" }}>
          {fmt.num(current, 1)}% / meta {fmt.num(target, 0)}%
        </span>
      </div>
      <div style={{ height: 6, background: "var(--bg4)", borderRadius: 3, position: "relative" }}>
        <div style={{ height: "100%", width: `${Math.min(current, 100)}%`, background: color, borderRadius: 3, transition: "width 0.5s" }} />
        <div style={{ position: "absolute", top: -2, left: `${Math.min(target, 100)}%`, width: 2, height: 10, background: "var(--text3)", borderRadius: 1 }} />
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
        <Card>
          <Stat label="Patrimônio Total" value={fmt.brl(totalPatrimony)} sub={`Custo: ${fmt.brl(totalCost)}`} />
        </Card>
        <Card>
          <Stat label="Retorno Total" value={fmt.brl(totalReturn)} sub={fmt.pct(returnPct)} color={totalReturn >= 0 ? "var(--green)" : "var(--red)"} />
        </Card>
        <Card>
          <Stat label="Dividendos/mês (est.)" value={fmt.brl(monthlyDivEstimate)} sub="Baseado no ano corrente" />
        </Card>
        <Card>
          <Stat label="Saldo de Proventos" value={fmt.brl(totalDivAvailable)} sub="Disponível para reinvestir" color="var(--amber)" />
        </Card>
      </div>

      {/* Allocation + Balance */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <h3 style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Alocação por Classe</h3>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <MiniDonut data={donutData} />
            <div style={{ flex: 1 }}>
              {donutData.map(d => (
                <div key={d.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                    <span style={{ fontSize: 12, color: "var(--text2)" }}>{d.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{fmt.num((d.value / totalPatrimony) * 100, 1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Balanceamento por Idade</h3>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--text3)" }}>Perfil sugerido para {age} anos: RF {fmt.num(rfTarget, 0)}% / FII {fmt.num(fiiTarget, 0)}% / RV {fmt.num(rvTarget, 0)}%</p>
          <BalBar label="Renda Fixa" current={rfPct} target={rfTarget} color="var(--accent2)" />
          <BalBar label="FIIs" current={fiiPct} target={fiiTarget} color="var(--amber)" />
          <BalBar label="Renda Variável" current={rvPct} target={rvTarget} color="var(--green)" />
          {Math.abs(rfPct - rfTarget) > 5 && (
            <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", fontSize: 12, color: "var(--amber)" }}>
              ⚠ Carteira desbalanceada — considere realocar em Renda Fixa
            </div>
          )}
        </Card>
      </div>

      {/* Recent dividends */}
      <Card>
        <h3 style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Últimos Proventos Recebidos</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {dividends.slice(0, 6).map(d => (
            <div key={d.id} style={{ padding: "12px 14px", background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>{d.ticker}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--green)" }}>{fmt.brl(d.total_amount)}</div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{new Date(d.payment_date).toLocaleDateString("pt-BR")}</div>
              {d.available_balance > 0 && <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 4 }}>Saldo: {fmt.brl(d.available_balance)}</div>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// --- PORTFOLIO PAGE ---
function PortfolioPage({ portfolio, prices, dividends }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const divBalances = {};
  dividends.forEach(d => { divBalances[d.ticker] = (divBalances[d.ticker] || 0) + (d.available_balance || 0); });

  const filtered = portfolio.filter(a =>
    (filter === "all" || a.asset_class === filter) &&
    (a.ticker.toLowerCase().includes(search.toLowerCase()) || a.name.toLowerCase().includes(search.toLowerCase()))
  );

  const classes = [...new Set(portfolio.map(a => a.asset_class))];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ativo..." style={{ flex: 1, minWidth: 180, padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--text)", fontSize: 14 }} />
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--text)", fontSize: 14 }}>
          <option value="all">Todas as classes</option>
          {classes.map(c => <option key={c} value={c}>{classLabel[c]}</option>)}
        </select>
        <button style={{ padding: "9px 18px", borderRadius: 10, background: "var(--accent)", color: "white", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>+ Adicionar</button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg3)" }}>
              {["Ativo", "Classe", "Qtd", "PM", "PMP", "Cotação", "Result.", "Div. Acum.", "Saldo Prov.", "Nº Mágico", "Badge", "C20A"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "var(--text3)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a, i) => {
              const p = prices[a.ticker];
              const price = p?.price || a.avg_price;
              const result = (price - a.avg_price) * a.quantity;
              const resultPct = ((price - a.avg_price) / a.avg_price) * 100;
              const magic = getMagicNumber(price, a.estimated_monthly_dividend_per_share);
              const saldo = divBalances[a.ticker] || 0;
              return (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg3)" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontWeight: 700, color: "var(--text)" }}>{a.ticker}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{a.name}</div>
                  </td>
                  <td style={{ padding: "10px 12px" }}><Badge color={a.asset_class === "fii" ? "amber" : a.asset_class === "crypto" ? "accent" : "green"}>{classLabel[a.asset_class]}</Badge></td>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text)" }}>{fmt.num(a.quantity, 0)}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text2)" }}>{fmt.brl(a.avg_price)}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ color: "var(--green)", fontWeight: 600 }}>{fmt.brl(a.avg_price_net)}</span>
                    <div style={{ fontSize: 10, color: "var(--text3)" }}>do bolso</div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontWeight: 700, color: "var(--text)" }}>{fmt.brl(price)}</div>
                    {p?.change_pct !== undefined && <div style={{ fontSize: 11, color: p.change_pct >= 0 ? "var(--green)" : "var(--red)" }}>{fmt.pct(p.change_pct)}</div>}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontWeight: 700, color: result >= 0 ? "var(--green)" : "var(--red)" }}>{fmt.brl(result)}</div>
                    <div style={{ fontSize: 11, color: result >= 0 ? "var(--green)" : "var(--red)" }}>{fmt.pct(resultPct)}</div>
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--text2)" }}>{fmt.brl(a.total_dividends_received)}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ color: saldo > 0 ? "var(--amber)" : "var(--text3)", fontWeight: saldo > 0 ? 700 : 400 }}>{fmt.brl(saldo)}</span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {magic ? <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{fmt.num(magic, 0)} cotas</span> : <span style={{ color: "var(--text3)" }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 12px" }}><AttractiveBadge ticker={a.ticker} prices={prices} /></td>
                  <td style={{ padding: "10px 12px" }}>
                    {a.is_c20a ? <span style={{ fontSize: 16 }} title="Na carteira C20A">⭐</span> : <span style={{ color: "var(--text3)", fontSize: 14 }}>○</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- C20A PAGE ---
function C20APage({ portfolio, prices }) {
  const c20a = portfolio.filter(a => a.is_c20a);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.1))", border: "1px solid rgba(99,102,241,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Carteira C20A ⭐</h2>
            <p style={{ margin: "6px 0 0", color: "var(--text2)", fontSize: 14 }}>Seus {c20a.length}/20 ativos para aposentadoria — meta: R$500–R$1.000/mês por ativo</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--accent)" }}>{c20a.length}<span style={{ fontSize: 16, color: "var(--text3)" }}>/20</span></div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>ativos selecionados</div>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {c20a.map(a => {
          const p = prices[a.ticker];
          const price = p?.price || a.avg_price;
          const monthlyDiv = a.estimated_monthly_dividend_per_share * a.quantity;
          const midTarget = (a.c20a_target_min + a.c20a_target_max) / 2;
          const targetQty = a.estimated_monthly_dividend_per_share > 0 ? Math.ceil(midTarget / a.estimated_monthly_dividend_per_share) : null;
          const progress = targetQty ? Math.min((a.quantity / targetQty) * 100, 100) : 0;
          const isComplete = monthlyDiv >= a.c20a_target_min;

          return (
            <Card key={a.id} style={{ position: "relative", overflow: "hidden" }}>
              {isComplete && <div style={{ position: "absolute", top: 12, right: 12 }}><Badge color="green">✓ Meta atingida</Badge></div>}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: classColor[a.asset_class] + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                  {a.asset_class === "fii" ? "🏢" : a.asset_class === "fixed_income" ? "🏛️" : a.asset_class === "crypto" ? "₿" : "📈"}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>{a.ticker}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>{a.name}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>Tenho</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>{fmt.num(a.quantity, 0)}</div>
                  <div style={{ fontSize: 11, color: "var(--text2)" }}>cotas</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>Meta</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>{targetQty ? fmt.num(targetQty, 0) : "—"}</div>
                  <div style={{ fontSize: 11, color: "var(--text2)" }}>cotas</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>Renda/mês</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: isComplete ? "var(--green)" : "var(--text)" }}>{fmt.brl(monthlyDiv)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>Alvo</div>
                  <div style={{ fontSize: 13, color: "var(--text2)" }}>{fmt.brl(a.c20a_target_min)} – {fmt.brl(a.c20a_target_max)}</div>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text3)" }}>Progresso para meta</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isComplete ? "var(--green)" : "var(--accent)" }}>{fmt.num(progress, 0)}%</span>
                </div>
                <div style={{ height: 6, background: "var(--bg4)", borderRadius: 3 }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: isComplete ? "var(--green)" : "var(--accent)", borderRadius: 3, transition: "width 0.5s" }} />
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <AttractiveBadge ticker={a.ticker} prices={prices} />
                {a.estimated_monthly_dividend_per_share > 0 && (
                  <Badge color="purple" size="sm">Nº Mágico: {fmt.num(getMagicNumber(price, a.estimated_monthly_dividend_per_share), 0)}</Badge>
                )}
              </div>
            </Card>
          );
        })}

        {/* Slots vazios */}
        {Array.from({ length: 20 - c20a.length }).map((_, i) => (
          <div key={`empty-${i}`} style={{ border: "2px dashed var(--border)", borderRadius: 16, padding: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", minHeight: 180, color: "var(--text3)", fontSize: 13, fontWeight: 600 }}>
            + Adicionar ativo
          </div>
        ))}
      </div>
    </div>
  );
}

// --- WATCHLIST PAGE ---
function WatchlistPage({ prices }) {
  const [items, setItems] = useState([
    { id: "w1", ticker: "BBAS3", name: "Banco do Brasil", asset_class: "stock_br", notes: "Acompanhando para entrada" },
    { id: "w2", ticker: "XPML11", name: "XP Malls", asset_class: "fii", notes: "Aguardando P/VP < 0.95" },
    { id: "w3", ticker: "ETH", name: "Ethereum", asset_class: "crypto", notes: "" },
  ]);
  const [search, setSearch] = useState("");

  const mockPricesExtra = {
    ...prices,
    BBAS3: { price: 28.4, change_pct: 1.2, pl: 4.8, pvp: 0.82, dy: 8.9, ma200: 26.1 },
    XPML11: { price: 94.5, change_pct: -0.3, pl: null, pvp: 0.96, dy: 8.2, ma200: 91.0 },
    ETH: { price: 18500, change_pct: 3.4, pl: null, pvp: null, dy: null, ma200: 15000 },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Adicionar ativo para acompanhar..." style={{ flex: 1, padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--text)", fontSize: 14 }} />
        <button style={{ padding: "9px 18px", borderRadius: 10, background: "var(--accent)", color: "white", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>+ Adicionar</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {items.map(item => {
          const p = mockPricesExtra[item.ticker];
          const badge = getAttractiveBadge(item.ticker, mockPricesExtra);
          return (
            <Card key={item.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text)" }}>{item.ticker}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>{item.name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{p ? fmt.brl(p.price) : "—"}</div>
                  {p?.change_pct !== undefined && <div style={{ fontSize: 12, color: p.change_pct >= 0 ? "var(--green)" : "var(--red)" }}>{fmt.pct(p.change_pct)}</div>}
                </div>
              </div>

              {p && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {p.pl && <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "6px 10px" }}><div style={{ fontSize: 10, color: "var(--text3)" }}>P/L</div><div style={{ fontWeight: 700, fontSize: 14, color: p.pl < 12 ? "var(--green)" : "var(--text)" }}>{fmt.num(p.pl, 1)}x</div></div>}
                  {p.pvp && <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "6px 10px" }}><div style={{ fontSize: 10, color: "var(--text3)" }}>P/VP</div><div style={{ fontWeight: 700, fontSize: 14, color: p.pvp < 1.2 ? "var(--green)" : "var(--text)" }}>{fmt.num(p.pvp, 2)}x</div></div>}
                  {p.dy && <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "6px 10px" }}><div style={{ fontSize: 10, color: "var(--text3)" }}>DY 12m</div><div style={{ fontWeight: 700, fontSize: 14, color: p.dy > 6 ? "var(--green)" : "var(--text)" }}>{fmt.num(p.dy, 1)}%</div></div>}
                  {p.ma200 && <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "6px 10px" }}><div style={{ fontSize: 10, color: "var(--text3)" }}>MM200</div><div style={{ fontWeight: 700, fontSize: 14, color: p.price < p.ma200 ? "var(--green)" : "var(--red)" }}>{fmt.brl(p.ma200)}</div></div>}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <AttractiveBadge ticker={item.ticker} prices={mockPricesExtra} />
                <button style={{ padding: "5px 12px", borderRadius: 8, background: "var(--accent)", color: "white", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Comprar</button>
              </div>

              {item.notes && <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text3)", borderTop: "1px solid var(--border)", paddingTop: 10 }}>{item.notes}</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// --- DIVIDENDS PAGE ---
function DividendsPage({ dividends, portfolio }) {
  const [tab, setTab] = useState("list");
  const byYear = {};
  dividends.forEach(d => {
    const yr = new Date(d.payment_date).getFullYear();
    byYear[yr] = (byYear[yr] || 0) + d.total_amount;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 16 }}>
        <Card style={{ flex: 1 }}><Stat label="Total 2026" value={fmt.brl(dividends.reduce((s, d) => s + (new Date(d.payment_date).getFullYear() === 2026 ? d.total_amount : 0), 0))} sub="Proventos recebidos" color="var(--green)" /></Card>
        <Card style={{ flex: 1 }}><Stat label="Saldo Disponível" value={fmt.brl(dividends.reduce((s, d) => s + (d.available_balance || 0), 0))} sub="Para reinvestir" color="var(--amber)" /></Card>
        <Card style={{ flex: 1 }}><Stat label="Média Mensal 2026" value={fmt.brl(dividends.filter(d => new Date(d.payment_date).getFullYear() === 2026).reduce((s, d) => s + d.total_amount, 0) / 4)} sub="Jan–Abr 2026" /></Card>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        {["list", "add"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: tab === t ? "var(--accent)" : "var(--bg3)", color: tab === t ? "white" : "var(--text2)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            {t === "list" ? "Histórico" : "+ Lançar Provento"}
          </button>
        ))}
      </div>

      {tab === "list" && (
        <Card>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Ativo", "Valor Total", "Por Cota", "Cotas", "Data Pgto", "Saldo Disp."].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "var(--text3)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dividends.map((d, i) => (
                <tr key={d.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg3)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text)" }}>{d.ticker}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "var(--green)" }}>{fmt.brl(d.total_amount)}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text2)" }}>{fmt.brl(d.total_amount / (portfolio.find(a => a.ticker === d.ticker)?.quantity || 1))}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text2)" }}>{fmt.num(portfolio.find(a => a.ticker === d.ticker)?.quantity || 0, 0)}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text2)" }}>{new Date(d.payment_date).toLocaleDateString("pt-BR")}</td>
                  <td style={{ padding: "10px 12px" }}><span style={{ color: (d.available_balance || 0) > 0 ? "var(--amber)" : "var(--text3)", fontWeight: 600 }}>{fmt.brl(d.available_balance || 0)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "add" && (
        <Card>
          <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Lançar Provento Recebido</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[["Ativo", "text", "Ex: MXRF11"], ["Valor por Cota (R$)", "number", "0,00"], ["Data de Pagamento", "date", ""], ["Cotas na data", "number", "0"]].map(([label, type, ph]) => (
              <div key={label}>
                <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 6, fontWeight: 600 }}>{label}</label>
                <input type={type} placeholder={ph} style={{ width: "100%", padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--text)", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
          <button style={{ marginTop: 20, padding: "10px 24px", borderRadius: 10, background: "var(--green)", color: "white", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Salvar Provento</button>
        </Card>
      )}
    </div>
  );
}

// --- SETTINGS PAGE ---
function SettingsPage({ profile, setProfile }) {
  return (
    <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700 }}>Aparência</h3>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tema</label>
          <div style={{ display: "flex", gap: 10 }}>
            {["dark", "light"].map(t => (
              <button key={t} onClick={() => setProfile(p => ({ ...p, theme: t }))} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `2px solid ${profile.theme === t ? "var(--accent)" : "var(--border)"}`, background: t === "dark" ? "#0a0e1a" : "#f0f4f8", color: t === "dark" ? "#e2e8f0" : "#0f172a", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                {t === "dark" ? "🌙 Escuro" : "☀️ Claro"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Tamanho da Fonte</label>
          <div style={{ display: "flex", gap: 10 }}>
            {[["sm", "A", 13], ["md", "A", 15], ["lg", "A", 18]].map(([k, l, s]) => (
              <button key={k} onClick={() => setProfile(p => ({ ...p, font_size: k }))} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `2px solid ${profile.font_size === k ? "var(--accent)" : "var(--border)"}`, background: "var(--bg3)", color: "var(--text)", fontWeight: profile.font_size === k ? 800 : 400, cursor: "pointer", fontSize: s }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700 }}>Perfil de Investidor</h3>
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 6, fontWeight: 600 }}>Sua Idade</label>
            <input type="number" value={profile.age || ""} onChange={e => setProfile(p => ({ ...p, age: parseInt(e.target.value) }))} placeholder="Ex: 35" style={{ width: "100%", padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--text)", fontSize: 14, boxSizing: "border-box" }} />
            <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>Usada para calcular o balanceamento ideal por idade</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[["Meta RF %", "target_rf_pct"], ["Meta FII %", "target_fii_pct"], ["Meta RV %", "target_rv_pct"]].map(([l, k]) => (
              <div key={k}>
                <label style={{ fontSize: 12, color: "var(--text3)", display: "block", marginBottom: 6, fontWeight: 600 }}>{l}</label>
                <input type="number" value={profile[k] || ""} onChange={e => setProfile(p => ({ ...p, [k]: parseFloat(e.target.value) }))} style={{ width: "100%", padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--text)", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
        </div>
        <button style={{ marginTop: 16, padding: "10px 24px", borderRadius: 10, background: "var(--accent)", color: "white", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Salvar Configurações</button>
      </Card>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ theme: "dark", font_size: "md", age: 35, target_rf_pct: 35, target_fii_pct: 32, target_rv_pct: 33 });
  const [portfolio] = useState(MOCK_PORTFOLIO);
  const [dividends] = useState(MOCK_DIVIDENDS);
  const [prices] = useState(MOCK_PRICES);

  useEffect(() => {
    supabase.auth.getSession().then(session => {
      if (session?.user) { setUser(session.user); supabase.setToken(session.token); }
      setLoading(false);
    });
  }, []);

  const fontSizes = { sm: 13, md: 15, lg: 17 };
  const themeVars = getThemeVars(profile.theme);

  const navItems = [
    { id: "dashboard", icon: "⬡", label: "Dashboard" },
    { id: "portfolio", icon: "◈", label: "Carteira" },
    { id: "c20a", icon: "⭐", label: "C20A" },
    { id: "watchlist", icon: "◎", label: "Watchlist" },
    { id: "dividends", icon: "◇", label: "Proventos" },
    { id: "settings", icon: "⚙", label: "Config." },
  ];

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0e1a", color: "#e2e8f0", fontSize: 20 }}>
      Carregando...
    </div>
  );

  const isDemo = !user;

  return (
    <div style={{ "--font-size-base": `${fontSizes[profile.font_size]}px`, fontSize: "var(--font-size-base)" }}>
      <style>{`:root { ${themeVars} } * { box-sizing: border-box; margin: 0; padding: 0; } body { background: var(--bg); color: var(--text); font-family: 'DM Sans', 'IBM Plex Sans', system-ui, sans-serif; } input, select, button { font-family: inherit; } ::-webkit-scrollbar { width: 6px; height: 6px; } ::-webkit-scrollbar-track { background: var(--bg2); } ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }`}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />

      {!user && !isDemo ? <LoginPage /> : (
        <div style={{ display: "flex", minHeight: "100vh" }}>
          {/* Sidebar */}
          <nav style={{ width: 220, background: "var(--bg2)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100 }}>
            <div style={{ padding: "24px 20px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24 }}>◈</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>InvestHub</span>
              </div>
              {isDemo && <div style={{ marginTop: 8, padding: "4px 8px", borderRadius: 6, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", fontSize: 11, color: "var(--amber)", fontWeight: 600 }}>MODO DEMO</div>}
            </div>

            <div style={{ flex: 1, padding: "8px 10px" }}>
              {navItems.map(n => (
                <button key={n.id} onClick={() => setPage(n.id)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "none", background: page === n.id ? "rgba(59,130,246,0.15)" : "transparent", color: page === n.id ? "var(--accent)" : "var(--text2)", display: "flex", alignItems: "center", gap: 10, fontWeight: page === n.id ? 700 : 400, fontSize: 14, cursor: "pointer", marginBottom: 2, transition: "all 0.15s", textAlign: "left" }}>
                  <span style={{ fontSize: 16 }}>{n.icon}</span> {n.label}
                </button>
              ))}
            </div>

            <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)" }}>
              {user ? (
                <>
                  <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, marginBottom: 2 }}>{user.user_metadata?.full_name || user.email}</div>
                  <button onClick={() => supabase.auth.signOut()} style={{ fontSize: 12, color: "var(--text3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Sair</button>
                </>
              ) : (
                <button onClick={() => supabase.auth.signInWithGoogle()} style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>→ Fazer login real</button>
              )}
            </div>
          </nav>

          {/* Main */}
          <main style={{ marginLeft: 220, flex: 1, padding: 28, minHeight: "100vh", background: "var(--bg)" }}>
            <div style={{ maxWidth: 1200 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 20, letterSpacing: "-0.02em" }}>
                {navItems.find(n => n.id === page)?.label}
              </h1>
              {page === "dashboard" && <Dashboard portfolio={portfolio} dividends={dividends} prices={prices} profile={profile} />}
              {page === "portfolio" && <PortfolioPage portfolio={portfolio} prices={prices} dividends={dividends} />}
              {page === "c20a" && <C20APage portfolio={portfolio} prices={prices} />}
              {page === "watchlist" && <WatchlistPage prices={prices} />}
              {page === "dividends" && <DividendsPage dividends={dividends} portfolio={portfolio} />}
              {page === "settings" && <SettingsPage profile={profile} setProfile={setProfile} />}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
