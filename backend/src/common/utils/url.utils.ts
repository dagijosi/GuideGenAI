import { EXCLUDED_EXTENSIONS, EXCLUDED_URL_PATTERNS } from '../constants';

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove hash fragments — same page
    parsed.hash = '';
    // Remove trailing slash for consistent deduplication
    let result = parsed.toString();
    if (result.endsWith('/') && parsed.pathname !== '/') {
      result = result.slice(0, -1);
    }
    return result;
  } catch {
    return url;
  }
}

export function isSameDomain(url: string, baseUrl: string): boolean {
  try {
    const urlHost = new URL(url).hostname.toLowerCase();
    const baseHost = new URL(baseUrl).hostname.toLowerCase();
    // Allow exact match or subdomain of base
    return urlHost === baseHost || urlHost.endsWith('.' + baseHost);
  } catch {
    return false;
  }
}

export function shouldCrawlUrl(url: string, baseUrl: string): boolean {
  if (!url || !url.startsWith('http')) return false;
  if (!isSameDomain(url, baseUrl)) return false;

  const lowerUrl = url.toLowerCase();

  // Skip static asset extensions
  if (EXCLUDED_EXTENSIONS.some((ext) => {
    const withoutQuery = lowerUrl.split('?')[0];
    return withoutQuery.endsWith(ext);
  })) return false;

  // Skip dangerous or irrelevant URL types
  if (EXCLUDED_URL_PATTERNS.some((pattern) => pattern.test(url))) return false;

  return true;
}

export function generatePageSlug(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname
      .replace(/\//g, '-')
      .replace(/^-+|-+$/g, '') // trim leading/trailing dashes
      || 'home';
    // Sanitize — keep only alphanumeric and dashes
    return path.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  } catch {
    return 'page';
  }
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
