"""
    Config module for google_images_scraper.
"""

from urllib.parse import urljoin

from pydantic_settings import BaseSettings, SettingsConfigDict


class GoogleImagesScraperSettings(BaseSettings):
    """Settings class for Google Images Scraper"""

    lens_url: str = "https://lens.google.com/"
    image_search_allowed_origins: str = (
        "http://localhost:8081,http://127.0.0.1:8081,http://localhost:3000,http://127.0.0.1:3000"
    )
    host: str = "127.0.0.1"
    port: int = 8000
    cache_ttl_seconds: int = 900
    max_parallel_searches: int = 4

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def get_upload_url_for_image(self, url: str) -> str:
        return urljoin(self.lens_url, f"uploadbyurl?url={url}")


google_images_scraper_settings = GoogleImagesScraperSettings()
