CREATE TABLE public.relay_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  done_at timestamptz
);
CREATE INDEX relay_jobs_pending_idx ON public.relay_jobs (status, created_at);
GRANT ALL ON public.relay_jobs TO service_role;
ALTER TABLE public.relay_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.relay_agent (
  id int PRIMARY KEY DEFAULT 1,
  last_seen timestamptz NOT NULL DEFAULT now(),
  info jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT ALL ON public.relay_agent TO service_role;
ALTER TABLE public.relay_agent ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.relay_claim(_limit int)
RETURNS SETOF public.relay_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.relay_jobs j SET status = 'working', claimed_at = now()
  WHERE j.id IN (
    SELECT id FROM public.relay_jobs
    WHERE status = 'pending' OR (status = 'working' AND claimed_at < now() - interval '10 minutes')
    ORDER BY created_at LIMIT _limit FOR UPDATE SKIP LOCKED
  )
  RETURNING j.*;
$$;
REVOKE ALL ON FUNCTION public.relay_claim(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.relay_claim(int) TO service_role;