-- ══════════════════════════════════════════════
-- Mizan.ai — SaaS Migration
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════

-- 1. Subscriptions table (Stripe billing)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

-- 2. Job Queue table
CREATE TABLE IF NOT EXISTS public.job_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'retry', 'dead')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    result JSONB,
    error TEXT,
    retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- 3. Add stripe_customer_id to profiles
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- ══════════════════════════════════════════════
-- Indexes
-- ══════════════════════════════════════════════

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
    ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status
    ON public.subscriptions (status);

-- Job Queue
CREATE INDEX IF NOT EXISTS idx_job_queue_status_priority
    ON public.job_queue (status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_job_queue_user_id
    ON public.job_queue (user_id);

-- ══════════════════════════════════════════════
-- RLS Policies
-- ══════════════════════════════════════════════

-- Subscriptions RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own subscriptions"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can manage all subscriptions (for webhooks)
CREATE POLICY "Service role manages subscriptions"
    ON public.subscriptions FOR ALL
    USING (auth.role() = 'service_role');

-- Job Queue RLS
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own jobs"
    ON public.job_queue FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role manages jobs"
    ON public.job_queue FOR ALL
    USING (auth.role() = 'service_role');
