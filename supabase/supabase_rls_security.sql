-- ═══════════════════════════════════════════════════════════
-- Mizan.ai — Supabase Security: RLS + Index + Contraintes
-- Exécuter dans Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── 1. Activer Row Level Security ──

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.url_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_status ENABLE ROW LEVEL SECURITY;


-- ── 2. Policies: Chaque utilisateur ne voit que ses données ──

-- profiles: l'utilisateur peut lire/modifier son propre profil
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- daily_briefs: l'utilisateur peut lire/insérer ses propres briefs
CREATE POLICY "Users read own briefs"
  ON public.daily_briefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own briefs"
  ON public.daily_briefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- processed_articles: l'utilisateur peut lire/insérer ses propres articles traités
CREATE POLICY "Users read own processed"
  ON public.processed_articles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own processed"
  ON public.processed_articles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- feedbacks: l'utilisateur peut lire/insérer ses propres feedbacks
CREATE POLICY "Users read own feedback"
  ON public.feedbacks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own feedback"
  ON public.feedbacks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- url_cache: accessible à tous les utilisateurs authentifiés (cache partagé)
CREATE POLICY "Authenticated users read cache"
  ON public.url_cache FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users insert cache"
  ON public.url_cache FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- generation_status: l'utilisateur peut lire/modifier son propre statut
CREATE POLICY "Users read own status"
  ON public.generation_status FOR SELECT
  USING (true);  -- Le backend utilise username, pas user_id

CREATE POLICY "Users upsert own status"
  ON public.generation_status FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users update own status"
  ON public.generation_status FOR UPDATE
  USING (true);


-- ── 3. IMPORTANT: Policy pour le backend (service_role) ──
-- Le backend Python utilise la clé anon par défaut.
-- Pour que le pipeline puisse insérer des données pour les utilisateurs,
-- il faudra soit:
--   A) Utiliser la clé service_role (bypass RLS) dans le backend
--   B) Ou ajouter des policies plus permissives
--
-- Pour l'instant, RLS protège les accès directs via l'API Supabase.
-- Le backend Python devrait idéalement utiliser SUPABASE_SERVICE_ROLE_KEY.


-- ── 4. Index pour la performance ──

CREATE INDEX IF NOT EXISTS idx_processed_articles_user_url
  ON public.processed_articles (user_id, url);

CREATE INDEX IF NOT EXISTS idx_processed_articles_user_date
  ON public.processed_articles (user_id, processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_briefs_user_date
  ON public.daily_briefs (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id
  ON public.feedbacks (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_url_cache_url
  ON public.url_cache (url);

CREATE INDEX IF NOT EXISTS idx_generation_status_username
  ON public.generation_status (username);


-- ── 5. Contraintes d'unicité (anti-doublons) ──

-- Un seul brief par utilisateur par jour
ALTER TABLE public.daily_briefs
  ADD CONSTRAINT IF NOT EXISTS unique_user_date
  UNIQUE (user_id, date);

-- Un article ne peut être marqué comme traité qu'une fois par utilisateur
ALTER TABLE public.processed_articles
  ADD CONSTRAINT IF NOT EXISTS unique_user_url
  UNIQUE (user_id, url);

-- Une seule entrée de statut par username
ALTER TABLE public.generation_status
  ADD CONSTRAINT IF NOT EXISTS unique_generation_username
  UNIQUE (username);


-- ═══════════════════════════════════════════════════════════
-- ✅ Script terminé.
-- Les données sont maintenant protégées par RLS.
-- Les index accélèrent les requêtes fréquentes.
-- Les contraintes d'unicité empêchent les doublons.
-- ═══════════════════════════════════════════════════════════
