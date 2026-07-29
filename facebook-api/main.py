from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import requests
from bs4 import BeautifulSoup
import re
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MBASIC_URL = "https://mbasic.facebook.com"

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/facebook")
async def facebook_posts(page: str = Query("SNTSSSeccionXXMichoacan"), pages: int = Query(3)):
    try:
        url = f"{MBASIC_URL}/{page}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        res = requests.get(url, headers=headers, timeout=15)
        res.raise_for_status()

        soup = BeautifulSoup(res.text, "lxml")
        posts = []

        for article in soup.select("article") or soup.select("div[data-ft]"):
            text_el = article.select_one("p, div.story_body_container")
            text = text_el.get_text(strip=True) if text_el else ""

            time_el = article.select_one("abbr, span.timestamp, a[href*='story']")
            time_str = time_el.get_text(strip=True) if time_el else ""

            img_el = article.select_one("img")
            image = img_el.get("src") if img_el else None

            link_el = article.select_one("a[href*='story.php']")
            url_path = link_el.get("href") if link_el else ""
            full_url = f"https://facebook.com{url_path}" if url_path and url_path.startswith("/") else url_path

            if text or image:
                posts.append({
                    "id": str(hash(text + full_url)),
                    "text": text[:2000] if text else None,
                    "time": time_str,
                    "image": image,
                    "video": None,
                    "likes": None,
                    "comments": None,
                    "shares": None,
                    "url": full_url or None,
                })

            if len(posts) >= pages * 5:
                break

        return {"posts": posts}
    except Exception as e:
        return {"error": str(e)}