import asyncio
import httpx
import re
from loguru import logger
from datetime import datetime, timezone, timedelta
import random

YOUTUBE_RSS_BASE = "https://www.youtube.com/feeds/videos.xml?channel_id="
TIMEOUT_SEC = 25

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
]

async def _get_channel_id(channel_input: str) -> str:
    """Resolve a channel name/url to its YouTube Channel ID via direct fetch or search fallback."""
    original_input = channel_input.strip()
    channel_input = original_input.rstrip('/')
    if not channel_input:
        return ""
    
    # If it's already a channel ID
    if re.match(r'^UC[\w-]{22}$', channel_input):
        return channel_input

    # 1. Prepare direct URL if it looks like a handle or full URL
    if "youtube.com" in channel_input or "youtu.be" in channel_input:
        url = channel_input
    else:
        clean_name = channel_input.lstrip("@")
        if " " not in clean_name:
            url = f"https://www.youtube.com/@{clean_name}"
        else:
            # If it has spaces, skip direct URL and go straight to search
            url = f"https://www.youtube.com/results?search_query={clean_name.replace(' ', '+')}"

    try:
        # User persistent cookie to bypass some consent screens
        cookies = {"CONSENT": "YES+cb.20210328-17-p0.en+FX+434"}
        headers = {
            "User-Agent": random.choice(_USER_AGENTS),
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        }
        
        async with httpx.AsyncClient(follow_redirects=True, timeout=TIMEOUT_SEC, cookies=cookies) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            
            # Simple extractor for channelId which can be in meta tags OR JSON blob
            def extract(html):
                # Meta tag (most reliable)
                m = re.search(r'itemprop=["\']channelId["\']\s+content=["\'](UC[\w-]{22})["\']', html)
                if m: return m.group(1)
                # JSON payload
                m = re.search(r'channelId["\']?\s*[:=]\s*["\'](UC[\w-]{22})["\']', html)
                if m: return m.group(1)
                # Browse ID
                m = re.search(r'browseId["\']?\s*[:=]\s*["\'](UC[\w-]{22})["\']', html)
                if m: return m.group(1)
                return None

            cid = extract(resp.text)
            if cid:
                logger.info(f"✅ Resolved '{original_input}' -> {cid}")
                return cid
                
            # 2. Fallback: Search if not found or if the direct URL was a consent page
            # (especially if the final URL contains consent.youtube.com)
            if "results?" not in url:
                search_url = f"https://www.youtube.com/results?search_query={clean_name.replace(' ', '+')}"
                resp_search = await client.get(search_url, headers=headers)
                cid = extract(resp_search.text)
                if cid:
                    logger.info(f"✅ Resolved '{original_input}' -> {cid} (via Search)")
                    return cid

            logger.warning(f"🔍 [YT] No channelId found for '{original_input}' after search.")
            return ""
    except Exception as e:
        logger.error(f"❌ Failed to resolve YouTube channel '{original_input}': {e}")
        return ""

async def fetch_youtube_videos(channels_list: list) -> list:
    """Fetch videos for the given channels published in the last 24-48h."""
    import os
    if not channels_list:
        return []
    
    logger.info(f"🎥 Fetching YouTube videos for: {channels_list}")
    videos = []
async def fetch_youtube_videos(channels_list: list) -> list:
    """Fetch videos for the given channels published in the last 24h (relative to the latest content)."""
    import os
    if not channels_list:
        return []
    
    logger.info(f"🎥 Fetching YouTube videos for: {channels_list}")
    all_candidates = []
    
    # 1. Resolve IDs
    channel_ids = set()
    resolution_tasks = [_get_channel_id(c) for c in channels_list]
    results = await asyncio.gather(*resolution_tasks)
    for cid in results:
        if cid:
            channel_ids.add(cid)

    if not channel_ids:
        logger.warning("⚠️ No valid YouTube Channel IDs resolved.")
        return []

    # 2. Fetch all entries from all channels
    async def _fetch_rss(cid: str):
        url = f"{YOUTUBE_RSS_BASE}{cid}"
        try:
            headers = {"User-Agent": random.choice(_USER_AGENTS)}
            async with httpx.AsyncClient(timeout=TIMEOUT_SEC) as client:
                res = await client.get(url, headers=headers)
                res.raise_for_status()
                text = res.text
                
                ch_title_match = re.search(r'<title>([^<]+)</title>', text)
                channel_name = ch_title_match.group(1) if ch_title_match else "Chaîne inconnue"
                
                entries = re.findall(r'<entry>.*?</entry>', text, re.DOTALL)
                logger.debug(f"📡 Found {len(entries)} entries for '{channel_name}'")
                
                for entry_xml in entries:
                    try:
                        title_m = re.search(r'<title>([^<]+)</title>', entry_xml)
                        link_m = re.search(r'<link [^>]*href=["\']([^"\']+)["\']', entry_xml)
                        pub_m = re.search(r'<published>([^<]+)</published>', entry_xml)
                        vid_id_m = re.search(r'<yt:videoId>([^<]+)</yt:videoId>', entry_xml)
                        
                        if title_m and link_m and pub_m:
                            published_str = pub_m.group(1)
                            dt = datetime.fromisoformat(published_str.replace('Z', '+00:00'))
                            
                            vid_id = vid_id_m.group(1) if vid_id_m else None
                            if not vid_id:
                                id_m = re.search(r'v=([\w-]{11})', link_m.group(1))
                                vid_id = id_m.group(1) if id_m else None
                                
                            if vid_id:
                                all_candidates.append({
                                    "title": title_m.group(1),
                                    "link": link_m.group(1),
                                    "channel": channel_name,
                                    "thumbnail": f"https://img.youtube.com/vi/{vid_id}/maxresdefault.jpg",
                                    "published": published_str,
                                    "dt": dt
                                })
                    except Exception: continue
        except Exception as e:
            logger.error(f"❌ Failed to fetch YT feed for {cid}: {e}")

    # Fetch them concurrently
    await asyncio.gather(*[_fetch_rss(cid) for cid in channel_ids])

    if not all_candidates:
        return []

    # 3. Smart Filtering: 24h window relative to the GLOBAL most recent video
    # This correctly handles both real-time and 2026 simulations.
    global_max_date = max(c['dt'] for c in all_candidates)
    logger.info(f"📌 Latest video date found: {global_max_date.isoformat()}")
    
    # We define the "News Window" as [max_date - 24h, max_date]
    window_start = global_max_date - timedelta(hours=24)
    
    final_videos = [
        v for v in all_candidates 
        if v['dt'] >= window_start
    ]
    
    # Sort descending
    final_videos.sort(key=lambda x: x["dt"], reverse=True)
    
    # Clean up internal 'dt' object before returning
    for v in final_videos:
        if 'dt' in v: del v['dt']

    logger.info(f"✅ Filtered to {len(final_videos)} videos within the 24h window.")
    return final_videos
