-- NAWAT schema for local Supabase
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
GRANT EXECUTE ON FUNCTION public.relay_claim(int) TO service_role;CREATE TABLE public.app_roles (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE public.app_pages (
  path text PRIMARY KEY,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort int NOT NULL DEFAULT 0
);
CREATE TABLE public.app_role_permissions (
  role_key text NOT NULL REFERENCES public.app_roles(key) ON DELETE CASCADE,
  page_path text NOT NULL REFERENCES public.app_pages(path) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role_key, page_path)
);
CREATE TABLE public.app_store (
  key text PRIMARY KEY,
  value jsonb,
  device text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.api_keys (
  id text PRIMARY KEY,
  name text NOT NULL,
  key_prefix text NOT NULL,
  provider text NOT NULL DEFAULT 'groupe-hn',
  enabled boolean NOT NULL DEFAULT true,
  monthly_limit bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  model text NOT NULL,
  key_id text,
  prompt_tokens int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  ms int NOT NULL DEFAULT 0
);
CREATE INDEX usage_events_at_idx ON public.usage_events(at DESC);

GRANT ALL ON public.app_roles, public.app_pages, public.app_role_permissions, public.app_store, public.api_keys, public.usage_events TO service_role;
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_roles (key, name, description) VALUES
 ('admin','مدير','تحكم كامل في كل الصفحات'),
 ('developer','مطوّر','عرض وتعديل دون حذف'),
 ('viewer','مشاهد','قراءة فقط');

INSERT INTO public.app_pages (path, name, sort) VALUES
 ('/','نظرة عامة',1),('/workspace','مساحة العمل',2),('/chat','المحادثات',3),('/atelier','الورشة',4),
 ('/resultats','النتائج',5),('/agents','الوكلاء',6),('/tools','الأدوات',7),('/spy','المراقبة',8),
 ('/models','النماذج',9),('/providers','المزوّدون',10),('/api-keys','مفاتيح API',11),('/tasks','المهام',12),
 ('/plan','خطة الأسبوع',13),('/architecture','البنية',14),('/settings','الإعدادات',15),('/ports','المنافذ',16),
 ('/packs','الحزم',17),('/metrics','السرعة',18),('/database','قواعد البيانات',19),('/mobile','نسخة الهاتف',20);

INSERT INTO public.app_role_permissions (role_key, page_path, can_view, can_edit, can_delete)
SELECT r.key, p.path, true, r.key IN ('admin','developer'), r.key = 'admin'
FROM public.app_roles r CROSS JOIN public.app_pages p;