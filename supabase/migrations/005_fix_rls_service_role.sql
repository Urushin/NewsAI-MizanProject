-- ═══════════════════════════════════════════════════════════
-- NewsAI — Migration 005: Fix RLS for Backend Service Role
-- Run this in Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════

-- The service_role key SHOULD bypass RLS automatically.
-- However, some Supabase setups require explicit policies.
-- This migration adds permissive policies for the service_role
-- and also enables the profiles INSERT policy for new signups.

DO $$
BEGIN

-- ── 1. PROFILES: Allow INSERT for new signups ──
-- The auth.uid() matches the new user's ID during signup
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ── 2. PROFILES: Allow service_role full access ──
DROP POLICY IF EXISTS "Service role full access on profiles" ON public.profiles;
CREATE POLICY "Service role full access on profiles"
  ON public.profiles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 3. JOB_QUEUE: Enable RLS and add policies ──
ALTER TABLE IF EXISTS public.job_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on job_queue" ON public.job_queue;
CREATE POLICY "Service role full access on job_queue"
  ON public.job_queue FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can read their own jobs
DROP POLICY IF EXISTS "Users read own jobs" ON public.job_queue;
CREATE POLICY "Users read own jobs"
  ON public.job_queue FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own jobs
DROP POLICY IF EXISTS "Users insert own jobs" ON public.job_queue;
CREATE POLICY "Users insert own jobs"
  ON public.job_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── 4. DAILY_BRIEFS: Allow service_role to upsert ──
DROP POLICY IF EXISTS "Service role full access on daily_briefs" ON public.daily_briefs;
CREATE POLICY "Service role full access on daily_briefs"
  ON public.daily_briefs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Also allow UPDATE for briefs (upsert needs this)
DROP POLICY IF EXISTS "Users update own briefs" ON public.daily_briefs;
CREATE POLICY "Users update own briefs"
  ON public.daily_briefs FOR UPDATE
  USING (auth.uid() = user_id);

-- ── 5. GENERATION_STATUS: Allow service_role ──
DROP POLICY IF EXISTS "Service role full access on generation_status" ON public.generation_status;
CREATE POLICY "Service role full access on generation_status"
  ON public.generation_status FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 6. PROCESSED_ARTICLES: Allow service_role ──
DROP POLICY IF EXISTS "Service role full access on processed_articles" ON public.processed_articles;
CREATE POLICY "Service role full access on processed_articles"
  ON public.processed_articles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 7. URL_CACHE: Allow service_role ──
DROP POLICY IF EXISTS "Service role full access on url_cache" ON public.url_cache;
CREATE POLICY "Service role full access on url_cache"
  ON public.url_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 8. FEEDBACKS: Allow service_role ──
DROP POLICY IF EXISTS "Service role full access on feedbacks" ON public.feedbacks;
CREATE POLICY "Service role full access on feedbacks"
  ON public.feedbacks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 9. ARTICLE_EMBEDDINGS: Allow service_role ──
ALTER TABLE IF EXISTS public.article_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on article_embeddings" ON public.article_embeddings;
CREATE POLICY "Service role full access on article_embeddings"
  ON public.article_embeddings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 10. MANIFESTO_EMBEDDINGS: Allow service_role ──
ALTER TABLE IF EXISTS public.manifesto_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on manifesto_embeddings" ON public.manifesto_embeddings;
CREATE POLICY "Service role full access on manifesto_embeddings"
  ON public.manifesto_embeddings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

END $$;

-- ═══════════════════════════════════════════════════════════
-- ✅ Done. All tables now have service_role bypass policies.
-- ═══════════════════════════════════════════════════════════
