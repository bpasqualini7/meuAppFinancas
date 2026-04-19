-- ============================================================
-- SCHEMA COMPLETO — Plataforma de Investimentos Pessoal
-- Executar no SQL Editor do Supabase
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (espelha auth.users, um registro por usuário)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  age INTEGER,                        -- usado no cálculo de balanceamento por idade
  target_rf_pct NUMERIC DEFAULT 40,   -- % alvo renda fixa (padrão = idade)
  target_fii_pct NUMERIC DEFAULT 30,  -- % alvo FIIs
  target_rv_pct NUMERIC DEFAULT 30,   -- % alvo renda variável ações
  theme TEXT DEFAULT 'dark',          -- 'light' | 'dark'
  font_size TEXT DEFAULT 'md',        -- 'sm' | 'md' | 'lg'
  dashboard_layout JSONB DEFAULT '[]',-- layout salvo do drag-and-drop
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);

-- trigger: cria profile automaticamente ao fazer login pela 1ª vez
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ASSETS (catálogo de ativos — compartilhado entre usuários)
-- ============================================================
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker TEXT UNIQUE NOT NULL,        -- ex: ITSA4, MXRF11, BTC, AAPL
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL,          -- 'stock_br' | 'stock_us' | 'fii' | 'fixed_income' | 'crypto' | 'etf_br' | 'etf_us' | 'other'
  sector TEXT,                        -- ex: 'Financeiro', 'Energia', 'Shoppings'
  currency TEXT DEFAULT 'BRL',        -- 'BRL' | 'USD'
  dividend_frequency TEXT,            -- 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'irregular'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- seed com ativos populares (expandir conforme uso)
INSERT INTO assets (ticker, name, asset_class, sector, currency, dividend_frequency) VALUES
  ('ITSA4','Itaúsa','stock_br','Financeiro','BRL','quarterly'),
  ('MXRF11','Maxi Renda','fii','Papéis','BRL','monthly'),
  ('ITUB4','Itaú Unibanco','stock_br','Financeiro','BRL','quarterly'),
  ('BBAS3','Banco do Brasil','stock_br','Financeiro','BRL','semiannual'),
  ('PETR4','Petrobras','stock_br','Petróleo','BRL','irregular'),
  ('WEGE3','WEG','stock_br','Industrial','BRL','quarterly'),
  ('HGLG11','CSHG Logística','fii','Logística','BRL','monthly'),
  ('XPML11','XP Malls','fii','Shoppings','BRL','monthly'),
  ('AAPL','Apple Inc','stock_us','Tecnologia','USD','quarterly'),
  ('BTC','Bitcoin','crypto',NULL,'USD',NULL),
  ('ETH','Ethereum','crypto',NULL,'USD',NULL),
  ('TESOURO-IPCA-2035','Tesouro IPCA+ 2035','fixed_income','Governo','BRL','semiannual');

-- ============================================================
-- PORTFOLIO_ASSETS (ativos na carteira do usuário)
-- ============================================================
CREATE TABLE portfolio_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id),
  quantity NUMERIC NOT NULL DEFAULT 0,
  avg_price NUMERIC NOT NULL DEFAULT 0,          -- PM (preço médio de compra)
  avg_price_net NUMERIC NOT NULL DEFAULT 0,      -- PMP (preço médio do bolso)
  total_dividends_received NUMERIC DEFAULT 0,    -- total recebido em proventos
  total_dividends_used NUMERIC DEFAULT 0,        -- total usado em compras
  is_c20a BOOLEAN DEFAULT FALSE,                 -- pertence à C20A?
  c20a_target_min NUMERIC DEFAULT 500,           -- meta mínima mensal C20A (R$)
  c20a_target_max NUMERIC DEFAULT 1000,          -- meta máxima mensal C20A (R$)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, asset_id)
);

ALTER TABLE portfolio_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_own" ON portfolio_assets FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- OPERATIONS (lançamentos de compra/venda)
-- ============================================================
CREATE TABLE operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id),
  op_type TEXT NOT NULL,              -- 'buy' | 'sell'
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_value NUMERIC NOT NULL,       -- quantity * unit_price
  fees NUMERIC DEFAULT 0,             -- corretagem / taxas
  dividends_used NUMERIC DEFAULT 0,   -- proventos usados nessa compra (reduz PMP)
  dividends_breakdown JSONB DEFAULT '[]', -- [{asset_id, amount}] rastreabilidade
  out_of_pocket NUMERIC,              -- total_value - dividends_used (calculado)
  broker TEXT,                        -- 'inter' | 'itau' | 'manual' | etc
  op_date DATE NOT NULL,
  notes TEXT,
  source TEXT DEFAULT 'manual',       -- 'manual' | 'pdf_import' | 'statement_import'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops_own" ON operations FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- DIVIDENDS (proventos recebidos)
-- ============================================================
CREATE TABLE dividends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id),
  amount_per_share NUMERIC NOT NULL,
  quantity_held NUMERIC NOT NULL,     -- cotas no momento do recebimento
  total_amount NUMERIC NOT NULL,      -- amount_per_share * quantity_held
  payment_date DATE NOT NULL,
  record_date DATE,
  available_balance NUMERIC,          -- saldo ainda disponível para uso (calculado)
  source TEXT DEFAULT 'manual',       -- 'manual' | 'statement_import'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dividends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "div_own" ON dividends FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- DIVIDEND_USES (rastreabilidade de uso de proventos em compras)
-- ============================================================
CREATE TABLE dividend_uses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dividend_id UUID NOT NULL REFERENCES dividends(id),
  operation_id UUID NOT NULL REFERENCES operations(id),
  amount_used NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dividend_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "du_own" ON dividend_uses FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- WATCHLIST (ativos acompanhados sem necessariamente ter na carteira)
-- ============================================================
CREATE TABLE watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id),
  notes TEXT,
  alert_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, asset_id)
);

ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wl_own" ON watchlist FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- ATTRACTIVENESS_CRITERIA (critérios do badge de atratividade por ativo)
-- ============================================================
CREATE TABLE attractiveness_criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id),
  pl_max NUMERIC,                     -- P/L máximo considerado atraente
  pvp_max NUMERIC,                    -- P/VP máximo
  dy_min NUMERIC,                     -- DY mínimo (%)
  below_ma200 BOOLEAN DEFAULT TRUE,   -- preço abaixo da MM200?
  analyst_rating_min TEXT,            -- 'buy' | 'outperform'
  custom_note TEXT,
  UNIQUE(user_id, asset_id)
);

ALTER TABLE attractiveness_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ac_own" ON attractiveness_criteria FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- PRICE_CACHE (cache de cotações para não bater a API toda hora)
-- ============================================================
CREATE TABLE price_cache (
  ticker TEXT PRIMARY KEY,
  price NUMERIC,
  currency TEXT DEFAULT 'BRL',
  change_pct NUMERIC,
  pl NUMERIC,
  pvp NUMERIC,
  dy_12m NUMERIC,
  ma200 NUMERIC,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- acesso público de leitura (cotações são compartilhadas)
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pc_read" ON price_cache FOR SELECT USING (TRUE);
CREATE POLICY "pc_write" ON price_cache FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- VIEW: dividend_balances (saldo disponível de proventos por ativo)
-- ============================================================
CREATE OR REPLACE VIEW dividend_balances AS
SELECT
  d.user_id,
  d.asset_id,
  a.ticker,
  SUM(d.total_amount) AS total_received,
  COALESCE(SUM(du.amount_used), 0) AS total_used,
  SUM(d.total_amount) - COALESCE(SUM(du.amount_used), 0) AS available_balance
FROM dividends d
JOIN assets a ON a.id = d.asset_id
LEFT JOIN dividend_uses du ON du.dividend_id = d.id
GROUP BY d.user_id, d.asset_id, a.ticker;

-- ============================================================
-- VIEW: portfolio_summary (resumo da carteira com PMP calculado)
-- ============================================================
CREATE OR REPLACE VIEW portfolio_summary AS
SELECT
  pa.user_id,
  pa.asset_id,
  a.ticker,
  a.name,
  a.asset_class,
  a.sector,
  a.currency,
  a.dividend_frequency,
  pa.quantity,
  pa.avg_price,
  pa.avg_price_net,
  pa.total_dividends_received,
  pa.total_dividends_used,
  pa.is_c20a,
  pa.c20a_target_min,
  pa.c20a_target_max,
  -- dividendo mensal estimado (ano corrente / 12)
  COALESCE(
    (SELECT SUM(d.total_amount) / pa.quantity / 12
     FROM dividends d
     WHERE d.asset_id = pa.asset_id
       AND d.user_id = pa.user_id
       AND EXTRACT(YEAR FROM d.payment_date) = EXTRACT(YEAR FROM NOW())),
    0
  ) AS estimated_monthly_dividend_per_share,
  pa.notes,
  pa.updated_at
FROM portfolio_assets pa
JOIN assets a ON a.id = pa.asset_id;
