-- ============================================
-- Migration: Signal-Based Agent Redesign
-- ============================================
-- Agents are pure signal providers (entry/exit).
-- Accounting is return-% based, not dollar-based.
-- Risk and position sizing removed from agents
-- (will be a separate portfolio layer in the future).
-- ============================================

-- ============================================
-- 1. Trades table — switch to return-% accounting
-- ============================================

-- Drop columns that belong to the old dollar-based model
ALTER TABLE trades
    DROP COLUMN IF EXISTS quantity,
    DROP COLUMN IF EXISTS pnl,
    DROP COLUMN IF EXISTS oanda_trade_id,
    DROP COLUMN IF EXISTS is_copy,
    DROP COLUMN IF EXISTS master_trade_id;

-- Add return-% accounting and percentage-based SL/TP
ALTER TABLE trades
    ADD COLUMN IF NOT EXISTS return_pct NUMERIC(10,4),
    ADD COLUMN IF NOT EXISTS stop_loss_pct NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS take_profit_pct NUMERIC(5,2);

-- ============================================
-- 2. Agents table — remove risk management
-- ============================================

-- Drop the public view first (it depends on columns being removed)
DROP VIEW IF EXISTS agents_public;

ALTER TABLE agents
    DROP COLUMN IF EXISTS max_drawdown_pct,
    DROP COLUMN IF EXISTS risk_per_trade_pct,
    DROP COLUMN IF EXISTS risk_config;

CREATE VIEW agents_public AS
SELECT
    id, creator_id, name, description, type, instrument, instruments, timeframe,
    status, llm_provider, llm_model, evaluation_schedule, created_at, updated_at
FROM agents;

-- ============================================
-- 3. Agent performance — return-% based
-- ============================================

ALTER TABLE agent_performance
    DROP COLUMN IF EXISTS total_pnl,
    DROP COLUMN IF EXISTS roi_pct;

ALTER TABLE agent_performance
    ADD COLUMN IF NOT EXISTS total_return_pct NUMERIC(10,4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS avg_return_pct NUMERIC(10,4) NOT NULL DEFAULT 0.0000;
