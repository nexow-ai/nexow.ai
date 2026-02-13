-- ============================================================================
-- Subscription plans & AI credits
-- ============================================================================

-- Subscription tier enum
CREATE TYPE subscription_tier AS ENUM ('free', 'starter', 'pro', 'elite');

-- Subscription status
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing', 'incomplete');

-- ============================================================================
-- Subscriptions table — one active subscription per user
-- ============================================================================
CREATE TABLE subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    tier            subscription_tier NOT NULL DEFAULT 'free',
    status          subscription_status NOT NULL DEFAULT 'active',

    -- Stripe references
    stripe_customer_id      TEXT UNIQUE,
    stripe_subscription_id  TEXT UNIQUE,
    stripe_price_id         TEXT,

    -- Billing period
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    cancel_at_period_end    BOOLEAN NOT NULL DEFAULT false,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- ============================================================================
-- AI Credits — tracked per billing period
-- ============================================================================
CREATE TABLE ai_credits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Current period credits
    credits_limit   INTEGER NOT NULL DEFAULT 100,
    credits_used    INTEGER NOT NULL DEFAULT 0,
    
    -- Period tracking (resets each billing cycle)
    period_start    TIMESTAMPTZ NOT NULL DEFAULT now(),
    period_end      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_user_credits UNIQUE (user_id)
);

-- ============================================================================
-- Credit usage log — detailed log of every credit deduction
-- ============================================================================
CREATE TABLE credit_usage_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
    
    action          TEXT NOT NULL,          -- 'agent_generation', 'discretionary_evaluation', etc.
    credits_used    INTEGER NOT NULL,
    description     TEXT,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_ai_credits_user_id ON ai_credits(user_id);
CREATE INDEX idx_credit_usage_user ON credit_usage_log(user_id);
CREATE INDEX idx_credit_usage_agent ON credit_usage_log(agent_id);
CREATE INDEX idx_credit_usage_created ON credit_usage_log(created_at);

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_usage_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
CREATE POLICY "Users can view own subscription"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Users can read their own credits
CREATE POLICY "Users can view own credits"
    ON ai_credits FOR SELECT
    USING (auth.uid() = user_id);

-- Users can view their own usage log
CREATE POLICY "Users can view own usage log"
    ON credit_usage_log FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can manage all (used by webhooks/API)
-- (Supabase service_role bypasses RLS by default)

-- ============================================================================
-- Auto-create subscription + credits for new users
-- ============================================================================
CREATE OR REPLACE FUNCTION create_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO subscriptions (user_id, tier, status)
    VALUES (NEW.id, 'free', 'active');
    
    INSERT INTO ai_credits (user_id, credits_limit, credits_used)
    VALUES (NEW.id, 100, 0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_subscription
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_user_subscription();

-- ============================================================================
-- Function to consume credits (called from API)
-- ============================================================================
CREATE OR REPLACE FUNCTION consume_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_action TEXT,
    p_agent_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_remaining INTEGER;
BEGIN
    -- Check remaining credits
    SELECT (credits_limit - credits_used) INTO v_remaining
    FROM ai_credits
    WHERE user_id = p_user_id;
    
    IF v_remaining IS NULL OR v_remaining < p_amount THEN
        RETURN FALSE;
    END IF;
    
    -- Deduct credits
    UPDATE ai_credits
    SET credits_used = credits_used + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;
    
    -- Log usage
    INSERT INTO credit_usage_log (user_id, agent_id, action, credits_used, description)
    VALUES (p_user_id, p_agent_id, p_action, p_amount, p_description);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function to reset credits (called on billing cycle renewal)
-- ============================================================================
CREATE OR REPLACE FUNCTION reset_user_credits(
    p_user_id UUID,
    p_new_limit INTEGER,
    p_period_start TIMESTAMPTZ,
    p_period_end TIMESTAMPTZ
)
RETURNS VOID AS $$
BEGIN
    UPDATE ai_credits
    SET credits_limit = p_new_limit,
        credits_used = 0,
        period_start = p_period_start,
        period_end = p_period_end,
        updated_at = now()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
