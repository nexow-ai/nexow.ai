-- ============================================
-- Migration: Backtesting Module
-- ============================================
-- Adds a backtests table to track historical simulations
-- and a backtest_id FK on trades so backtest trades are
-- stored in the same table but clearly distinguished
-- from live paper-trading trades.
-- ============================================

-- ============================================
-- 1. Backtests table
-- ============================================

CREATE TABLE IF NOT EXISTS public.backtests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  creator_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  config          JSONB NOT NULL DEFAULT '{}',
  instruments     JSONB NOT NULL DEFAULT '[]',
  exit_config     JSONB DEFAULT '{}',
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running', 'completed', 'failed')),
  progress_pct    SMALLINT NOT NULL DEFAULT 0,
  total_trades    INT,
  total_return_pct NUMERIC(10,4),
  win_rate        NUMERIC(5,2),
  max_drawdown    NUMERIC(5,2),
  sharpe_ratio    NUMERIC(8,4),
  profit_factor   NUMERIC(8,4),
  equity_curve    JSONB DEFAULT '[]',
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backtests_agent_id ON public.backtests(agent_id);
CREATE INDEX IF NOT EXISTS idx_backtests_creator_id ON public.backtests(creator_id);
CREATE INDEX IF NOT EXISTS idx_backtests_status ON public.backtests(status);

-- ============================================
-- 2. Add backtest_id to trades
-- ============================================

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS backtest_id UUID REFERENCES public.backtests(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_trades_backtest_id ON public.trades(backtest_id);

-- ============================================
-- 3. RLS policies for backtests
-- ============================================

ALTER TABLE public.backtests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own backtests"
  ON public.backtests FOR SELECT
  USING (creator_id = auth.uid());

CREATE POLICY "Users can insert their own backtests"
  ON public.backtests FOR INSERT
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Users can update their own backtests"
  ON public.backtests FOR UPDATE
  USING (creator_id = auth.uid());

CREATE POLICY "Users can delete their own backtests"
  ON public.backtests FOR DELETE
  USING (creator_id = auth.uid());

CREATE POLICY "Service role has full access to backtests"
  ON public.backtests FOR ALL
  USING (auth.role() = 'service_role');
