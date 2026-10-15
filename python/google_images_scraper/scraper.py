"""
    Module for scraping Google Images.
"""

import hashlib
import logging
import time
import urllib.parse
from typing import List

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager

from google_images_scraper.conf import google_images_scraper_settings
from google_images_scraper.models import Image, ImageResult


logging.getLogger("WDM").setLevel(logging.ERROR)


class ConsentFormAcceptError(BaseException):
    message = "Unable to accept Google consent form."


class DriverInitializationError(BaseException):
    message = "Unable to initialize Chrome webdriver for scraping."


class DriverGetImageDataError(BaseException):
    message = "Unable to get Google Image data with Chrome webdriver."


class GoogleImagesScraper:
    """Class for scraping Google Images"""

    def __init__(self, logger: logging.Logger | None = None) -> None:
        self._logger = logger if logger else logging.getLogger(__name__)
        self._consent_button_xpath = "/html/body/c-wiz/div/div/div/div[2]/div[1]/div[3]/div[1]/div[1]/form[2]/div/div/button/span"
        self._driver: webdriver.Chrome | None = None
        self._driver_path: str | None = None

    def _get_or_create_driver(self) -> webdriver.Chrome:
        """Returns active Chrome webdriver, creating or recreating if dead."""
        if self._driver is not None:
            try:
                # Quick health check
                _ = self._driver.current_window_handle
                return self._driver
            except Exception:
                self._logger.warning("Existing Chrome driver session lost, recreating...")
                try:
                    self._driver.quit()
                except Exception:
                    pass
                self._driver = None

        if self._driver_path is None:
            self._driver_path = ChromeDriverManager().install()

        chrome_options = Options()
        chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option("useAutomationExtension", False)
        chrome_options.add_argument(
            "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        service = Service(self._driver_path)
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.set_page_load_timeout(15)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        self._driver = driver
        return driver

    def _init_chrome_driver(self) -> webdriver.Chrome:
        return self._get_or_create_driver()

    def _click_consent_button(self, driver: webdriver.Chrome) -> None:
        """Clicks google consent form with selenium Chrome webdriver"""
        self._logger.info("Accepting consent form..")
        try:
            driver.get(google_images_scraper_settings.lens_url)
            consent_button = driver.find_element(
                By.XPATH,
                self._consent_button_xpath,
            )
            consent_button.click()
            time.sleep(2)
        except Exception as e:
            # Non-fatal if no consent banner is presented
            self._logger.debug(f"Consent form bypass skipped: {e}")

    def _get_data_from_image_div(self, div: webdriver.Chrome) -> Image:
        """Retrieves image data from a div element and returns it as an Image object."""
        a_element = div.find_element(By.TAG_NAME, "a")
        title = a_element.get_attribute("aria-label") or ""
        source_url = a_element.get_attribute("href") or ""
        img_element = div.find_element(By.TAG_NAME, "img")
        image_url = img_element.get_attribute("data-src") or img_element.get_attribute("src") or ""
        return Image(title=title, url=image_url, source_url=source_url)

    def _get_images_from_page(self, url: str, driver: webdriver.Chrome) -> List[Image]:
        """Retrieves image data from a Google Images search page."""
        self._logger.info("Scraping Google Images page..")
        driver.get(google_images_scraper_settings.get_upload_url_for_image(url))
        image_divs = driver.find_elements(By.CLASS_NAME, "G19kAf")
        return [self._get_data_from_image_div(div) for div in image_divs]

    def query_images_for_url(self, url: str) -> List[Image]:
        """
        Retrieves a list of images queried in Google Images for a given image URL.
        """
        self._logger.info(f"Retrieving images for {url}..")

        try:
            driver = self._init_chrome_driver()
        except Exception as e:
            raise DriverInitializationError from e

        try:
            self._click_consent_button(driver)
        except Exception:
            pass

        try:
            return self._get_images_from_page(url, driver)
        except Exception as e:
            raise DriverGetImageDataError from e
        finally:
            driver.quit()

    def query_images_for_keyword(
        self,
        query: str,
        limit: int = 1,
        orientation: str | None = None,
    ) -> List[ImageResult]:
        """
        Retrieves a list of ImageResult objects from Google Images for a given text search query.
        """
        clean_query = " ".join(query.split())
        search_query = clean_query
        if orientation and orientation in {"landscape", "portrait", "squarish"}:
            search_query += f" {orientation}"

        encoded_query = urllib.parse.quote(search_query)
        search_url = f"https://www.google.com/search?q={encoded_query}&udm=2"
        self._logger.info(f"Scraping Google Images for query: {search_query}")

        try:
            driver = self._init_chrome_driver()
        except Exception as e:
            self._logger.exception("Failed to initialize driver for keyword search")
            raise DriverInitializationError from e

        try:
            driver.get(search_url)
            time.sleep(1.8)

            # Accept consent if button is present
            for btn_text in ["Accept all", "I agree", "Tout accepter", "Alle akzeptieren", "Accept"]:
                try:
                    buttons = driver.find_elements(By.XPATH, f"//button[contains(., '{btn_text}')]")
                    if buttons:
                        buttons[0].click()
                        time.sleep(1)
                        break
                except Exception:
                    pass

            js_extract = driver.execute_script("""
                const items = [];
                const seen = new Set();
                const imgs = document.querySelectorAll('img');
                for (const img of imgs) {
                    const rect = img.getBoundingClientRect();
                    if (rect.width < 60 || rect.height < 60) continue;
                    const src = img.src || img.getAttribute('data-src');
                    if (!src || src.startsWith('data:image/gif') || seen.has(src)) continue;
                    
                    const anchor = img.closest('a');
                    const href = anchor ? anchor.href : '';
                    const alt = (img.alt || (anchor ? anchor.innerText : '')).trim();
                    if (alt.startsWith('Add ') || alt.startsWith('Filters') || alt.includes('logo')) continue;
                    
                    seen.add(src);
                    items.push({
                        src: src,
                        alt: alt || 'Photo',
                        href: href || '',
                        width: Math.round(rect.width) || 400,
                        height: Math.round(rect.height) || 300
                    });
                    if (items.length >= 20) break;
                }
                return items;
            """)

            results: List[ImageResult] = []
            for raw in (js_extract or [])[:limit]:
                img_url = raw.get("src", "")
                if not img_url:
                    continue
                img_id = hashlib.sha256(img_url.encode()).hexdigest()[:12]
                href = raw.get("href", "")
                source_domain = "Google Images"
                if href and href.startswith("http"):
                    try:
                        netloc = urllib.parse.urlparse(href).netloc
                        if netloc and "google." not in netloc:
                            source_domain = netloc.replace("www.", "")
                    except Exception:
                        pass

                results.append(
                    ImageResult(
                        id=img_id,
                        alt=raw.get("alt") or clean_query,
                        image_url=img_url,
                        photo_url=href or search_url,
                        photographer=source_domain,
                        photographer_url=href or search_url,
                        width=raw.get("width", 400),
                        height=raw.get("height", 300),
                    )
                )

            return results
        except Exception as e:
            self._logger.exception(f"Error scraping images for query: {search_query}")
            try:
                driver.quit()
            except Exception:
                pass
            self._driver = None
            raise DriverGetImageDataError from e
