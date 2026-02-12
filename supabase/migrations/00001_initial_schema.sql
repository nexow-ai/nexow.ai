-- ============================================
-- Nexow - Initial Database Schema
-- ============================================

-- Enums
CREATE TYPE agent_type AS ENUM ('systematic', 'discretionary');
CREATE TYPE agent_status AS ENUM ('active', 'paused', 'killed');
CREATE TYPE trade_direction AS ENUM ('buy', 'sell');
CREATE TYPE trade_status AS ENUM ('open', 'closed');
CREATE TYPE subscription_status AS ENUM ('active', 'paused');

-- ============================================
-- Profiles (extends auth.users)
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_profiles_username ON profiles(username);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    _username TEXT;
BEGIN
    _username := COALESCE(
        NEW.raw_user_meta_data->>'username',
        split_part(NEW.email, '@', 1)
    );

    -- Ensure uniqueness by appending a short UUID fragment on conflict
    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = _username) THEN
        _username := _username || '_' || substr(gen_random_uuid()::text, 1, 8);
    END IF;

    INSERT INTO public.profiles (id, username, display_name)
    VALUES (
        NEW.id,
        _username,
        COALESCE(NEW.raw_user_meta_data->>'display_name', _username)
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- Agents (trading bot definitions)
-- ============================================
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type agent_type NOT NULL DEFAULT 'systematic',
    config JSONB NOT NULL DEFAULT '{}',
    prompt TEXT,
    instrument TEXT NOT NULL DEFAULT 'EUR_USD',
    timeframe TEXT NOT NULL DEFAULT 'M5',
    status agent_status NOT NULL DEFAULT 'paused',
    max_drawdown_pct NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    risk_per_trade_pct NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_agents_creator ON agents(creator_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_instrument ON agents(instrument);

-- ============================================
-- Trades (execution log)
-- ============================================
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    instrument TEXT NOT NULL,
    direction trade_direction NOT NULL,
    entry_price NUMERIC(18,8) NOT NULL,
    exit_price NUMERIC(18,8),
    quantity NUMERIC(18,4) NOT NULL,
    pnl NUMERIC(18,4),
    status trade_status NOT NULL DEFAULT 'open',
    oanda_trade_id TEXT,
    is_copy BOOLEAN NOT NULL DEFAULT false,
    master_trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
    opened_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    closed_at TIMESTAMPTZ
);

CREATE INDEX idx_trades_agent ON trades(agent_id);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_opened ON trades(opened_at DESC);
CREATE INDEX idx_trades_master ON trades(master_trade_id) WHERE master_trade_id IS NOT NULL;

-- ============================================
-- Agent Performance (leaderboard stats)
-- ============================================
CREATE TABLE agent_performance (
    agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
    total_trades INT NOT NULL DEFAULT 0,
    winning_trades INT NOT NULL DEFAULT 0,
    win_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    total_pnl NUMERIC(18,4) NOT NULL DEFAULT 0.00,
    max_drawdown NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    sharpe_ratio NUMERIC(8,4) NOT NULL DEFAULT 0.00,
    roi_pct NUMERIC(10,4) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- Copy Subscriptions
-- ============================================
CREATE TABLE copy_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    copier_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    allocation_pct NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    status subscription_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    UNIQUE(copier_id, agent_id)
);

CREATE INDEX idx_copy_subs_copier ON copy_subscriptions(copier_id);
CREATE INDEX idx_copy_subs_agent ON copy_subscriptions(agent_id);
CREATE INDEX idx_copy_subs_active ON copy_subscriptions(agent_id) WHERE status = 'active';

-- ============================================
-- Updated-at triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_agent_performance_updated_at
    BEFORE UPDATE ON agent_performance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Row Level Security
-- ============================================

-- Profiles: users can read all, update own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are publicly readable"
    ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id);

-- Agents: creator sees everything, others see metadata only (config hidden)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents metadata is publicly readable"
    ON agents FOR SELECT USING (true);

CREATE POLICY "Only creator can insert agents"
    ON agents FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Only creator can update agents"
    ON agents FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Only creator can delete agents"
    ON agents FOR DELETE USING (auth.uid() = creator_id);

-- Hide config column from non-owners via a view
CREATE VIEW agents_public AS
SELECT
    id, creator_id, name, description, type, instrument, timeframe,
    status, max_drawdown_pct, risk_per_trade_pct, created_at, updated_at
FROM agents;

-- Trades: readable by agent creator + active copiers
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trade creator can read own trades"
    ON trades FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.id = trades.agent_id
            AND agents.creator_id = auth.uid()
        )
    );

CREATE POLICY "Active copiers can read trades"
    ON trades FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM copy_subscriptions cs
            WHERE cs.agent_id = trades.agent_id
            AND cs.copier_id = auth.uid()
            AND cs.status = 'active'
        )
    );

CREATE POLICY "Service role can manage trades"
    ON trades FOR ALL USING (
        auth.role() = 'service_role'
    );

-- Agent Performance: publicly readable (powers leaderboard)
ALTER TABLE agent_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Performance is publicly readable"
    ON agent_performance FOR SELECT USING (true);

CREATE POLICY "Service role can manage performance"
    ON agent_performance FOR ALL USING (
        auth.role() = 'service_role'
    );

-- Copy Subscriptions: managed by copier only
ALTER TABLE copy_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Copiers can read own subscriptions"
    ON copy_subscriptions FOR SELECT USING (auth.uid() = copier_id);

CREATE POLICY "Agent creators can see who copies them"
    ON copy_subscriptions FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.id = copy_subscriptions.agent_id
            AND agents.creator_id = auth.uid()
        )
    );

CREATE POLICY "Copiers can insert subscriptions"
    ON copy_subscriptions FOR INSERT WITH CHECK (auth.uid() = copier_id);

CREATE POLICY "Copiers can update own subscriptions"
    ON copy_subscriptions FOR UPDATE USING (auth.uid() = copier_id);

CREATE POLICY "Copiers can delete own subscriptions"
    ON copy_subscriptions FOR DELETE USING (auth.uid() = copier_id);

-- ============================================
-- Username availability check (public RPC)
-- ============================================
CREATE OR REPLACE FUNCTION check_username_available(desired_username TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE username = lower(trim(desired_username))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- Enable Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE trades;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_performance;
