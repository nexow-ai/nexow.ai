-- ============================================
-- Migration: Add portfolio + risk config + LLM provider to agents
-- ============================================

-- Add new columns
ALTER TABLE agents
    ADD COLUMN IF NOT EXISTS instruments JSONB DEFAULT '[{"instrument": "EUR_USD", "allocation_pct": 100, "timeframe": "M5"}]',
    ADD COLUMN IF NOT EXISTS llm_provider TEXT DEFAULT 'openai',
    ADD COLUMN IF NOT EXISTS llm_model TEXT DEFAULT 'gpt-4o-mini',
    ADD COLUMN IF NOT EXISTS risk_config JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS evaluation_schedule TEXT DEFAULT 'every_tick';

-- Migrate existing instrument/timeframe data into instruments JSONB
UPDATE agents
SET instruments = jsonb_build_array(
    jsonb_build_object(
        'instrument', instrument,
        'allocation_pct', 100,
        'timeframe', timeframe
    )
)
WHERE instruments IS NULL OR instruments = '[{"instrument": "EUR_USD", "allocation_pct": 100, "timeframe": "M5"}]'::jsonb;

-- Index for querying by instrument within the JSONB array
CREATE INDEX IF NOT EXISTS idx_agents_instruments ON agents USING gin(instruments);
