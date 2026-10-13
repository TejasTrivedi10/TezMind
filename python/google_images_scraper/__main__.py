"""Main module for google_images_scraper.

Runs the local image search API server by default (`python -m google_images_scraper`),
or scrapes images for a specific URL via CLI (`python -m google_images_scraper --url <url>`).
"""

import logging
import sys
import uvicorn

from google_images_scraper.conf import google_images_scraper_settings

logging.basicConfig(level=logging.INFO)


def main() -> None:
    if "--url" in sys.argv:
        import click
        from google_images_scraper.collector import GoogleImagesDataCollector

        @click.command()
        @click.option(
            "--url",
            help="The url for which to return Google Images results for.",
            required=True,
        )
        def scrape_google_images(url: str) -> None:
            collector = GoogleImagesDataCollector()
            collector.save_image_data_for_url(url)

        scrape_google_images()
    else:
        uvicorn.run(
            "google_images_scraper.app:app",
            host=google_images_scraper_settings.host,
            port=google_images_scraper_settings.port,
            reload=True,
        )


if __name__ == "__main__":
    main()
