-- Agent logs table for real-time console output.
-- The Python engine writes evaluation logs, trade decisions, errors here.
-- The frontend subscribes via Supabase Realtime.

CREATE TABLE IF NOT EXISTS public.agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_logs_agent_id ON public.agent_logs(agent_id);
CREATE INDEX idx_agent_logs_created_at ON public.agent_logs(created_at DESC);

ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs for their agents"
  ON public.agent_logs FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM public.agents WHERE creator_id = auth.uid()
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_logs;
