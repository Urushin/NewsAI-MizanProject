from pprint import pprint

def _build_user_interest_sources(profile: dict) -> list:
    interests = profile.get("interests", {})
    if not interests:
        return []
    
    if isinstance(interests, list):
        return interests
        
    sources = []
    for topic, weight in interests.items():
        if isinstance(weight, (int, float)) and weight < 0.3:
            continue
        
        lang = profile.get("preferences", {}).get("language", "fr")
        
        if isinstance(weight, list):
            sources.append({
                "id": f"user_macro_{topic}",
                "active": True,
                "type": "topic",
                "query": topic,
                "category": topic,
                "language": lang,
            })
            for sub in weight:
                clean_sub = sub.strip()
                if not clean_sub:
                    continue
                sources.append({
                    "id": f"user_sub_{clean_sub}",
                    "active": True,
                    "type": "topic",
                    "query": clean_sub,
                    "category": topic,
                    "language": lang,
                })
        else:
            sources.append({
                "id": f"user_topic_{topic}",
                "active": True,
                "type": "topic",
                "query": topic,
                "category": topic,
                "language": lang,
            })
    return sources

profile = {
    "preferences": {"language": "fr"},
    "interests": {
        "Lifestyle & Sport": ["Football", "Automobile & F1"],
        "Culture": ["Manga", "Cinéma & Séries"],
        "Notes": ["Pokemon"]
    }
}

res = _build_user_interest_sources(profile)
print(f"Total queries: {len(res)}")
for r in res[:5]:
    pprint(r)
