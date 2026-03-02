import { z } from "zod";

/**
 * Mizan.ai — Shared Schemas (Zod)
 * These schemas are used to validate data coming from the Backend
 * and provide full TypeScript safety.
 */

export const ArticleVerdictSchema = z.object({
    localized_title: z.string(),
    summary: z.string().optional().default(""),
    score: z.number().min(0).max(100),
    keep: z.boolean().default(true),
    category: z.enum(["Impact", "Passion"]).default("Passion"),
    reason: z.string().optional().default(""),
    credibility_score: z.number().min(0).max(10).default(5),
    link: z.string().url(),
    gate_passed: z.enum(["impact", "interest"]).optional(),
});

export const DailyBriefSchema = z.object({
    date: z.string(),
    global_digest: z.string().optional().default(""),
    total_collected: z.number().default(0),
    total_kept: z.number().default(0),
    content: z.array(ArticleVerdictSchema).default([]),
});

export const UserProfileSchema = z.object({
    username: z.string(),
    language: z.enum(["fr", "en", "ja"]).default("fr"),
    score_threshold: z.number().default(70),
    identity: z.record(z.any()).default({}),
    interests: z.record(z.number()).default({}),
    rejection_rules: z.array(z.string()).default([]),
    preferences: z.record(z.any()).default({}),
});

// TypeScript Types
export type ArticleVerdict = z.TypeOf<typeof ArticleVerdictSchema>;
export type DailyBrief = z.TypeOf<typeof DailyBriefSchema>;
export type UserProfile = z.TypeOf<typeof UserProfileSchema>;
