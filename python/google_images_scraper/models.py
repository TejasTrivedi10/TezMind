"""
    Pydantic models for Google Images scraper.
"""

from pydantic import BaseModel


class Image(BaseModel):
    title: str
    url: str
    source_url: str


class ImageResult(BaseModel):
    id: str
    alt: str
    image_url: str
    photo_url: str
    photographer: str
    photographer_url: str
    width: int = 400
    height: int = 300
    color: str | None = None


class ImageSearchResponse(BaseModel):
    query: str
    results: list[ImageResult]
