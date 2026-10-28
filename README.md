# Nexow

**The Agentic Social Trading Platform**

Build discretionary or systematic trading agents in plain English. Trade FX, indices, commodities, stocks, and crypto — 24/5 — then compete on The Arena and earn when others copy your agents.

## Features

- **No-code agent factory** — describe a strategy; AI turns it into an executable agent
- **Dual-brain engine** — systematic rules for speed; discretionary agents with LLM reasoning, news, and web search
- **The Arena** — leaderboard ranked by ROI, win rate, and drawdown
- **Blind social / copy trading** — copiers follow results; strategy IP stays with the creator
- **Risk guardrails** — drawdown limits, trailing stops, daily loss caps, kill switch
- **Backtesting** — validate strategies before going live
- **Paper & live trading** via OANDA

## Architecture

```
nexow.ai/
├── frontend/          # Next.js app (UI, auth, Stripe, Supabase client)
├── engine/            # Python trading worker + FastAPI backtest API
├── supabase/          # Database migrations
├── infra/             # AWS ECS task definition & setup scripts
├── docker-compose.yml
└── dev.sh             # Local all-in-one startup
```

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 16, React 19, Tailwind CSS 4, Framer Motion, Three.js |
| Auth & DB | Supabase (Auth + Postgres) |
| Billing | Stripe |
| Engine | Python 3.11+, FastAPI, Pydantic AI, LangGraph, pandas/ta |
| Broker | OANDA (practice & live) |
| Deploy | AWS Amplify (frontend), ECS (engine) |

The engine runs two concurrent processes: a **worker loop** that evaluates live agents on each tick, and a **FastAPI** server (default `:8100`) for backtests.

## Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io)
- Python 3.11+ and [uv](https://docs.astral.sh/uv/)
- A Supabase project
- OANDA practice (or live) API credentials
- At least one LLM API key (OpenAI, Anthropic, Google, or DeepSeek)
- Stripe keys (for billing flows)

## Quick start

```bash
cp .env.example .env
# Fill in Supabase, OANDA, LLM, and Stripe values

./dev.sh
```

This installs dependencies, starts the frontend at [http://localhost:3000](http://localhost:3000), and the engine with hot-reload.

### Manual (separate terminals)

```bash
# Frontend
cd frontend && pnpm install && pnpm dev

# Engine
cd engine && uv sync --all-extras
uv run --all-extras -- watchfiles "python -m nexow.main" nexow/
```

### Docker

```bash
docker compose up --build
```

## Environment

Copy `.env.example` → `.env`. Key groups:

| Group | Purpose |
| --- | --- |
| `SUPABASE_*` / `NEXT_PUBLIC_SUPABASE_*` | Auth, DB, realtime |
| `OANDA_*` | Broker execution & market data |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / … | Agent reasoning |
| `ENGINE_API_URL` | Frontend → engine (backtests) |
| `TAVILY_API_KEY` / `NEWSAPI_KEY` | External research for discretionary agents |
| `STRIPE_*` / `NEXT_PUBLIC_STRIPE_*` | Subscriptions |

Apply SQL migrations under `supabase/migrations/` to your Supabase project before first run.

## Project map

**Frontend** (`frontend/src/`)

- `app/(auth)` — login / signup
- `app/(dashboard)` — agents, leaderboard, copy trading, billing, pricing
- `app/api` — candles, instruments, backtest proxy, Stripe webhooks
- `components/` — landing, agents, trading charts, backtest UI

**Engine** (`engine/nexow/`)

- `worker/` — tick loop & trade executor
- `agents/` — systematic, discretionary, portfolio agents
- `ai/` — LLM factory, tools, reasoning
- `rules/` — strategy schema & interpreter
- `broker/` — OANDA client
- `risk/` — guardrails
- `backtest/` — historical simulation
- `copy/` — copy-trading manager
- `api.py` — FastAPI HTTP surface

## License

Private / proprietary — all rights reserved.
