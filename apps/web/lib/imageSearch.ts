export interface SearchedImage {
  id: string;
  alt: string;
  image_url: string;
  photo_url: string;
  photographer: string;
  photographer_url: string;
  width: number;
  height: number;
  color?: string | null;
}

interface SearchResponse {
  results?: SearchedImage[];
}

const baseUrl = (process.env.EXPO_PUBLIC_IMAGE_SEARCH_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const searchCache = new Map<string, Promise<SearchedImage | null>>();

function inferOrientation(element: HTMLElement): 'landscape' | 'portrait' | 'squarish' {
  const [width, height] = (element.dataset.ratio || '16:9').split(':').map(Number);
  if (!width || !height || Math.abs(width / height - 1) < 0.16) return 'squarish';
  return width > height ? 'landscape' : 'portrait';
}

function imageQuery(element: HTMLElement): string {
  const alt = (element.dataset.alt || '').trim();
  if (alt && !/^(image|photo|picture|placeholder|background)$/i.test(alt)) return alt;
  return (element.dataset.img || '').replace(/[-_]+/g, ' ').trim();
}

async function searchImage(query: string, orientation: string): Promise<SearchedImage | null> {
  const key = `${query.toLowerCase()}|${orientation}`;
  const cached = searchCache.get(key);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  const request = fetch(
    `${baseUrl}/api/images/search?query=${encodeURIComponent(query)}&orientation=${orientation}&limit=1`,
    { signal: controller.signal },
  )
    .then(async (response) => {
      if (!response.ok) {
        searchCache.delete(key);
        return null;
      }
      const payload = (await response.json()) as SearchResponse;
      const result = payload.results?.[0];
      if (!result) {
        searchCache.delete(key);
        return null;
      }
      const imageUrl = new URL(result.image_url);
      const creditUrl = new URL(result.photographer_url);
      if (imageUrl.protocol !== 'https:' || imageUrl.hostname !== 'images.unsplash.com') return null;
      if (creditUrl.protocol !== 'https:' || !/(^|\.)unsplash\.com$/i.test(creditUrl.hostname)) return null;
      return result;
    })
    .catch(() => {
      searchCache.delete(key);
      return null;
    })
    .finally(() => clearTimeout(timeout));
  searchCache.set(key, request);
  return request;
}

function showImage(element: HTMLElement, result: SearchedImage): void {
  element.dataset.imageUrl = result.image_url;
  element.dataset.imageCredit = result.photographer;
  element.dataset.imageCreditUrl = result.photographer_url;
  element.style.backgroundImage = `url("${result.image_url}")`;
  element.style.backgroundPosition = 'center';
  element.style.backgroundSize = 'cover';
  element.setAttribute('aria-label', result.alt || element.dataset.alt || 'Photo');
  element.dataset.imageResolved = 'true';
  element.replaceChildren();

  const credit = element.ownerDocument.createElement('a');
  credit.className = 'img-credit';
  credit.dataset.imgCredit = 'true';
  credit.href = result.photographer_url;
  credit.target = '_blank';
  credit.rel = 'noopener noreferrer';
  credit.setAttribute('aria-label', `Photo by ${result.photographer} on Unsplash`);
  credit.textContent = `Photo by ${result.photographer} · Unsplash`;
  element.appendChild(credit);
}

/** Resolve generated image placeholders to real, attributed photos when the local service is available. */
export async function resolveGeneratedImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll<HTMLElement>('.img[data-img]'))
    .filter((element) => !element.dataset.imageUrl && element.dataset.imageResolved !== 'true' && element.dataset.imageSearchPending !== 'true')
    .slice(0, 6);

  await Promise.all(images.map(async (element) => {
    const query = imageQuery(element);
    if (query.length < 2) return;
    element.dataset.imageSearchPending = 'true';
    const result = await searchImage(query, inferOrientation(element));
    delete element.dataset.imageSearchPending;
    if (!result || !element.isConnected) return;

    showImage(element, result);
    // Unsplash asks API clients to report an image selection through this URL.
    void fetch(`${baseUrl}/api/images/selection/${encodeURIComponent(result.id)}`, { method: 'POST' }).catch(() => undefined);
  }));
}

/** Resolve image placeholders into durable, attributed HTML before the screen is saved. */
export async function resolveGeneratedImagesInHtml(html: string): Promise<string> {
  if (typeof DOMParser === 'undefined' || !html.trim()) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return html;
  const images = Array.from(root.querySelectorAll<HTMLElement>('.img[data-img]'))
    .filter((element) => !element.dataset.imageUrl)
    .slice(0, 6);

  await Promise.all(images.map(async (element) => {
    const query = imageQuery(element);
    if (query.length < 2) return;
    const result = await searchImage(query, inferOrientation(element));
    if (!result) return;
    element.dataset.imageUrl = result.image_url;
    element.dataset.imageCredit = result.photographer;
    element.dataset.imageCreditUrl = result.photographer_url;
    void fetch(`${baseUrl}/api/images/selection/${encodeURIComponent(result.id)}`, { method: 'POST' }).catch(() => undefined);
  }));
  return root.outerHTML;
}
