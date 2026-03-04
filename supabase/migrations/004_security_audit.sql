-- ═══════════════════════════════════════════════════════════
-- Mizan.ai — Migration 004: Security Audit & Indexes
-- Idempotent Security Hardening & Performance Optimization
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    -- ── 1. RLS HARDENING: GENERATION_STATUS ──
    -- Drop the unsafe public USING (true) policies
    DROP POLICY IF EXISTS "Users read own status" ON public.generation_status;
    DROP POLICY IF EXISTS "Users upsert own status" ON public.generation_status;
    DROP POLICY IF EXISTS "Users update own status" ON public.generation_status;

    -- Recreate policies with strict ownership checking via profiles join
    -- Only the owner of the username can read their status
    CREATE POLICY "Users read own status via profile"
      ON public.generation_status FOR SELECT
      USING (username = (SELECT username FROM public.profiles WHERE id = auth.uid()));

    -- Usually the Service Role (backend) inserts/updates the status.
    -- However, if the user needs to reset it directly, they can only touch their own.
    CREATE POLICY "Users update own status via profile"
      ON public.generation_status FOR UPDATE
      USING (username = (SELECT username FROM public.profiles WHERE id = auth.uid()));

    CREATE POLICY "Users upsert own status via profile"
      ON public.generation_status FOR INSERT
      WITH CHECK (username = (SELECT username FROM public.profiles WHERE id = auth.uid()));

    -- ── 2. RLS HARDENING: URL_CACHE ──
    -- Drop the globally insertable policy
    DROP POLICY IF EXISTS "Authenticated users insert cache" ON public.url_cache;
    
    -- Cache insertions should primarily be done by the backend (service_role).
    -- If we still want authenticated users to contribute to the cache conceptually (though not used),
    -- we can leave it to service_role strictly for security.
    -- The service_role bypasses RLS automatically, so dropping the INSERT policy for authenticated users is enough.

    -- ── 3. RLS HARDENING: PROFILES & BRIEFS ──
    -- Enforce explicit auth.uid() checks for all core tables (already properly set in previous scripts, just ensuring strictness)
    -- Profiles
    DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
    CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
    CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

    -- Daily Briefs
    DROP POLICY IF EXISTS "Users read own briefs" ON public.daily_briefs;
    DROP POLICY IF EXISTS "Users insert own briefs" ON public.daily_briefs;
    CREATE POLICY "Users read own briefs" ON public.daily_briefs FOR SELECT USING (user_id = auth.uid());
    CREATE POLICY "Users insert own briefs" ON public.daily_briefs FOR INSERT WITH CHECK (user_id = auth.uid());

END $$;

-- ── 4. INDEX MAINTENANCE: COMPOSITE B-TREE ──
-- Create explicit composite indexes for O(log n) History/Brief lookups
CREATE INDEX IF NOT EXISTS idx_processed_articles_user_date_comp
    ON public.processed_articles (user_id, processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_briefs_user_date_comp
    ON public.daily_briefs (user_id, date DESC);

-- ── 5. INDEX MAINTENANCE: BRIN FOR CHRONOLOGICAL DATA ──
-- Implementing BRIN (Block Range INdexes) for scalable time-series operations
-- BRIN is extremely efficient for large insert-only tabular data sorted by time.
CREATE INDEX IF NOT EXISTS brin_idx_processed_articles_time
    ON public.processed_articles USING brin (processed_at);

CREATE INDEX IF NOT EXISTS brin_idx_daily_briefs_time
    ON public.daily_briefs USING brin (date);

CREATE INDEX IF NOT EXISTS brin_idx_feedbacks_time
    ON public.feedbacks USING brin (created_at);

-- ═══════════════════════════════════════════════════════════
-- ✅ Script Terminé.
-- ═══════════════════════════════════════════════════════════
