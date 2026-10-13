"""Small local image-search API backed by the official Unsplash API."""

from __future__ import annotations

import asyncio
import time
from typing import Literal
from urllib.parse import urlencode, urlparse

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    unsplash_access_key: str = ""
    image_search_allowed_origins: str = (
        "http://localhost:8081,http://127.0.0.1:8081"
    )
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
UNSPLASH_API = "https://api.unsplash.com"
UNSPLASH_IMAGE_HOST = "images.unsplash.com"
CACHE_TTL_SECONDS = 600
MAX_PARALLEL_SEARCHES = 4

app = FastAPI(title="TezMind Image Search", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in settings.image_search_allowed_origins.split(",")
        if origin.strip()
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class ImageResult(BaseModel):
    id: str
    alt: str
    image_url: HttpUrl
    photo_url: HttpUrl
    photographer: str
    photographer_url: HttpUrl
    width: int
    height: int
    color: str | None = None


class ImageSearchResponse(BaseModel):
    query: str
    results: list[ImageResult]


_cache: dict[tuple[str, str, int], tuple[float, ImageSearchResponse]] = {}
_download_locations: dict[str, tuple[float, str]] = {}
_cache_lock = asyncio.Lock()
_search_limit = asyncio.Semaphore(MAX_PARALLEL_SEARCHES)


def _with_attribution_params(url: str) -> str:
    """Add the required Unsplash referral parameters to attribution links."""
    parsed = urlparse(url)
    query = dict(item.split("=", 1) for item in parsed.query.split("&") if "=" in item)
    query.update({"utm_source": "tezmind", "utm_medium": "referral"})
    return parsed._replace(query=urlencode(query)).geturl()


def _photo_result(photo: dict) -> ImageResult | None:
    image_url = photo.get("urls", {}).get("small")
    photo_url = photo.get("links", {}).get("html")
    user = photo.get("user", {})
    photographer_url = user.get("links", {}).get("html")
    if not all((image_url, photo_url, photographer_url)):
        return None
    if urlparse(image_url).hostname != UNSPLASH_IMAGE_HOST:
        return None
    if urlparse(photo_url).hostname not in {"unsplash.com", "www.unsplash.com"}:
        return None
    if urlparse(photographer_url).hostname not in {"unsplash.com", "www.unsplash.com"}:
        return None

    return ImageResult(
        id=str(photo.get("id", "")),
        alt=(photo.get("alt_description") or photo.get("description") or "Photo").strip(),
        image_url=image_url,
        photo_url=_with_attribution_params(photo_url),
        photographer=user.get("name") or "Unsplash photographer",
        photographer_url=_with_attribution_params(photographer_url),
        width=int(photo.get("width") or 0),
        height=int(photo.get("height") or 0),
        color=photo.get("color"),
    )


@app.get("/health")
async def health() -> dict[str, str | bool]:
    return {"ok": True, "provider": "unsplash", "configured": bool(settings.unsplash_access_key)}


@app.get("/api/images/search", response_model=ImageSearchResponse)
async def search_images(
    query: str = Query(min_length=2, max_length=120),
    orientation: Literal["landscape", "portrait", "squarish"] | None = None,
    limit: int = Query(default=1, ge=1, le=6),
) -> ImageSearchResponse:
    clean_query = " ".join(query.split())
    if not clean_query:
        raise HTTPException(status_code=422, detail="Search query cannot be blank")
    if not settings.unsplash_access_key:
        raise HTTPException(
            status_code=503,
            detail="Image search is not configured. Set UNSPLASH_ACCESS_KEY in the project .env file.",
        )

    cache_key = (clean_query.casefold(), orientation or "", limit)
    async with _cache_lock:
        cached = _cache.get(cache_key)
        if cached and cached[0] > time.monotonic():
            return cached[1]

    params: dict[str, str | int] = {
        "query": clean_query,
        "per_page": limit,
        "content_filter": "high",
    }
    if orientation:
        params["orientation"] = orientation

    try:
        async with _search_limit:
            async with httpx.AsyncClient(timeout=httpx.Timeout(12.0)) as client:
                response = await client.get(
                    f"{UNSPLASH_API}/search/photos",
                    params=params,
                    headers={"Authorization": f"Client-ID {settings.unsplash_access_key}"},
                )
        response.raise_for_status()
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Image search timed out") from exc
    except httpx.HTTPStatusError as exc:
        status = 429 if exc.response.status_code == 429 else 502
        raise HTTPException(status_code=status, detail="Image provider search failed") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Image provider is unavailable") from exc

    photos = response.json().get("results", [])
    results = [result for photo in photos if (result := _photo_result(photo)) is not None]
    payload = ImageSearchResponse(query=clean_query, results=results)
    async with _cache_lock:
        expiry = time.monotonic() + CACHE_TTL_SECONDS
        _cache[cache_key] = (expiry, payload)
        for photo in photos:
            photo_id = str(photo.get("id", ""))
            download_location = photo.get("links", {}).get("download_location")
            if photo_id and download_location:
                _download_locations[photo_id] = (expiry, download_location)
        expired = [key for key, (expiry, _) in _cache.items() if expiry <= time.monotonic()]
        for key in expired:
            _cache.pop(key, None)
    return payload


@app.post("/api/images/selection/{photo_id}")
async def track_image_selection(photo_id: str) -> dict[str, bool]:
    """Report a selected image through Unsplash's required download endpoint."""
    async with _cache_lock:
        cached = _download_locations.get(photo_id)
    if not cached or cached[0] <= time.monotonic():
        raise HTTPException(status_code=404, detail="Image result expired; search again")
    if not settings.unsplash_access_key:
        raise HTTPException(status_code=503, detail="Image search is not configured")

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0)) as client:
            response = await client.get(
                cached[1],
                headers={"Authorization": f"Client-ID {settings.unsplash_access_key}"},
            )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not report image selection") from exc
    return {"tracked": True}
