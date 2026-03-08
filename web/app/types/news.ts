export interface NewsItem {
    title: string;
    localized_title?: string;
    category: string;
    sub_category?: string;
    summary: string | string[];
    score: number;
    link: string;
    keep: boolean;
    gate_passed?: string;
    reason?: string;
    credibility_score?: number;
    source_name?: string;
    source_names?: string[];
    sources_count?: number;
    source_urls?: string[];
    image_url?: string;
    isFused?: boolean;
    is_fused?: boolean;
    fused_count?: number;
    source_icons?: string[];
}

export interface BriefData {
    status?: string;
    date: string;
    generated_at: string;
    total_collected: number;
    total_kept: number;
    duration_seconds: number;
    global_digest?: string;
    content: NewsItem[];
    youtube_videos?: {
        title: string;
        link: string;
        channel: string;
        thumbnail: string;
        published: string;
    }[];
    ai_seal?: {
        model: string;
        precision: number;
        hallucination_check: boolean;
    };
}
