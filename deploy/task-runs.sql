CREATE TABLE IF NOT EXISTS public.task_runs (
  model text NOT NULL,
  at text NOT NULL,
  round text,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (at, model)
);
GRANT ALL ON public.task_runs TO service_role;
ALTER TABLE public.task_runs ENABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';
