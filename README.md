# InvestHub 💼

Plataforma pessoal de acompanhamento de investimentos.

## Stack
- **Frontend**: React + Vite
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Deploy**: Vercel
- **Cotações**: brapi.dev (BR) + CoinGecko (cripto)
- **Macro**: API Banco Central do Brasil

## Funcionalidades
- ✅ Login com Google (OAuth)
- ✅ Carteira multi-classe (Ações BR/EUA, FIIs, Renda Fixa, Cripto)
- ✅ PM e PMP (Preço Médio do Bolso — desconta proventos usados)
- ✅ Número Mágico por ativo
- ✅ Carteira C20A (aposentadoria — meta de R$500–R$1.000/mês por ativo)
- ✅ Saldo de proventos com rastreabilidade
- ✅ Badge de atratividade (P/L, P/VP, DY, MM200)
- ✅ Watchlist separada da carteira
- ✅ Dashboard com balanceamento por idade
- ✅ Cenário econômico (Selic, IPCA, Dólar, notícias)
- ✅ Guia/Wiki embutido
- ✅ Tema light/dark + tamanho de fonte

## Setup local

```bash
# 1. Clone
git clone https://github.com/bpasqualini7/meuAppFinancas.git
cd meuAppFinancas

# 2. Instale dependências
npm install

# 3. Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais Supabase

# 4. Rode
npm run dev
```

## Deploy (Vercel)

No painel da Vercel, adicione as variáveis de ambiente:
```
VITE_SUPABASE_URL=https://eepabmvopnczvadfnsvg.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

## Banco de dados

Execute `supabase_schema.sql` no SQL Editor do Supabase antes de usar.

## Roadmap
- [ ] Drag-and-drop no dashboard
- [ ] Parser PDF nota de corretagem (Inter + Itaú)
- [ ] Importação extrato de dividendos
- [ ] Balanceamento por setor
- [ ] Acesso multi-usuário (Bianca)
