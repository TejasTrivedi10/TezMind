"""FastAPI server for TezMind image search powered by google_images_scraper."""

from __future__ import annotations

import asyncio
import time
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from google_images_scraper.conf import google_images_scraper_settings
from google_images_scraper.models import ImageResult, ImageSearchResponse
from google_images_scraper.scraper import GoogleImagesScraper

app = FastAPI(title="TezMind Google Images Scraper", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in google_images_scraper_settings.image_search_allowed_origins.split(",")
        if origin.strip()
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_cache: dict[tuple[str, str, int], tuple[float, ImageSearchResponse]] = {}
_cache_lock = asyncio.Lock()
_search_limit = asyncio.Semaphore(google_images_scraper_settings.max_parallel_searches)
_scraper = GoogleImagesScraper()


class ScrapeUrlRequest(BaseModel):
    url: str


@app.get("/health")
async def health() -> dict[str, str | bool]:
    return {
        "ok": True,
        "provider": "google_images_scraper",
        "configured": True,
    }


@app.get("/api/images/search", response_model=ImageSearchResponse)
async def search_images(
    query: str = Query(min_length=2, max_length=120),
    orientation: Literal["landscape", "portrait", "squarish"] | None = None,
    limit: int = Query(default=1, ge=1, le=6),
) -> ImageSearchResponse:
    clean_query = " ".join(query.split())
    if not clean_query:
        raise HTTPException(status_code=422, detail="Search query cannot be blank")

    cache_key = (clean_query.casefold(), orientation or "", limit)
    async with _cache_lock:
        cached = _cache.get(cache_key)
        if cached and cached[0] > time.monotonic():
            return cached[1]

    try:
        async with _search_limit:
            # Run selenium scraper in a thread to keep FastAPI non-blocking
            results = await asyncio.to_thread(
                _scraper.query_images_for_keyword,
                clean_query,
                limit,
                orientation,
            )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Scraping Google Images failed: {exc}") from exc

    payload = ImageSearchResponse(query=clean_query, results=results)

    async with _cache_lock:
        expiry = time.monotonic() + google_images_scraper_settings.cache_ttl_seconds
        _cache[cache_key] = (expiry, payload)
        # Purge expired cache items
        expired = [key for key, (exp, _) in _cache.items() if exp <= time.monotonic()]
        for key in expired:
            _cache.pop(key, None)

    return payload


@app.post("/api/images/selection/{photo_id}")
async def track_image_selection(photo_id: str) -> dict[str, bool]:
    """Compatibility endpoint for image selection reporting."""
    return {"tracked": True}


@app.post("/api/images/scrape-url")
async def scrape_images_for_url(request: ScrapeUrlRequest) -> dict:
    """Scrape Google Lens / Google Images for similar images of a given URL."""
    try:
        images = await asyncio.to_thread(_scraper.query_images_for_url, request.url)
        return {"images": [img.model_dump() for img in images]}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Scraping URL failed: {exc}") from exc
