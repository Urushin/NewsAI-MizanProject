import feedparser
import httpx
import urllib.parse
from pprint import pprint

_GOOGLE_NEWS_PARAMS = {
    "fr": {"hl": "fr", "gl": "FR", "ceid": "FR:fr"},
}

def build_google_rss_url(query: str, language: str = "fr") -> str:
    encoded = urllib.parse.quote(query)
    p = _GOOGLE_NEWS_PARAMS.get(language, _GOOGLE_NEWS_PARAMS["fr"])
    return f"https://news.google.com/rss/search?q={encoded}&hl={p['hl']}&gl={p['gl']}&ceid={p['ceid']}"

query = '"Culture & Divertissement" OR "Football" OR "Sports de Combat (MMA/Boxe)" OR "Basket / NBA" OR "Automobile & F1" OR "Voyage & Aventure" OR "Gastronomie" OR "Mode & Luxe" OR "Manga & Anime" OR "Cinéma & Séries" OR "Musique & Concerts" OR "Littérature & BD" OR "Art & Design" OR "Jeux Vidéo & Esport"'

url = build_google_rss_url(query)
print("URL:", url)

headers = {"User-Agent": "Mozilla/5.0"}
resp = httpx.get(url, headers=headers, follow_redirects=True)
feed = feedparser.parse(resp.text)

print("Entries count:", len(feed.entries))
if feed.entries:
    for e in feed.entries[:3]:
        print("-", e.title)
else:
    print("NO ENTRIES!")
