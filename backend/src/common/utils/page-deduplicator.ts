import { PageMetadata } from '../interfaces/page-metadata.interface';

export interface DeduplicationResult {
  /** Pages that should receive full AI documentation (one per unique template) */
  representatives: PageMetadata[];
  /**
   * Maps every page URL to the URL of its representative.
   * For representative pages this maps to themselves.
   * For duplicates this maps to the representative they share.
   */
  urlToRepresentative: Map<string, string>;
  /**
   * Groups of URLs that share the same template.
   * Key = representative URL, value = all URLs in that group (including representative).
   */
  groups: Map<string, string[]>;
  /**
   * Normalised URL pattern for each page URL.
   * e.g. /product/123 → /product/:id
   */
  urlPatterns: Map<string, string>;
}

/**
 * Detects pages that share the same structural template and deduplicates them
 * so the AI only generates documentation once per unique layout.
 *
 * Two pages are considered duplicates when they share:
 *   1. The same normalised URL pattern  (/product/:id, /user/:id, etc.)
 *   2. The same structural fingerprint  (same buttons + inputs + table headers)
 *
 * This handles the common case of e-commerce product pages, user profiles,
 * order detail pages, etc. — where 10–50 pages have identical layouts but
 * different data.
 */
export class PageDeduplicator {
  /**
   * Normalises a URL path by replacing numeric and UUID-like segments with
   * a `:id` placeholder, making /product/123 and /product/456 identical.
   */
  static normaliseUrlPattern(url: string): string {
    try {
      const parsed = new URL(url);
      const normPath = parsed.pathname
        // Replace UUID segments
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
        // Replace pure numeric segments
        .replace(/\/\d+/g, '/:id')
        // Replace slug-like segments that look like generated IDs (32+ hex chars)
        .replace(/\/[0-9a-f]{32,}/gi, '/:id')
        // Normalise trailing slash
        .replace(/\/$/, '') || '/';
      return `${parsed.origin}${normPath}`;
    } catch {
      // Fallback for malformed URLs — apply same replacements to raw string
      return url
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
        .replace(/\/\d+/g, '/:id')
        .replace(/\/[0-9a-f]{32,}/gi, '/:id')
        .replace(/\/$/, '');
    }
  }

  /**
   * Produces a short structural fingerprint for a page based on its UI elements.
   * Two pages with the same fingerprint have the same interactive layout.
   */
  static fingerprint(page: PageMetadata): string {
    const buttons = [...new Set(page.buttons.map(b => b.text.trim().toLowerCase()))]
      .sort()
      .slice(0, 12)
      .join('|');

    const inputs = [...new Set(page.inputs.map(i => (i.name || i.label || i.placeholder || i.type).toLowerCase()))]
      .sort()
      .slice(0, 10)
      .join('|');

    const tableHeaders = page.tables
      .flatMap(t => t.headers.map(h => h.toLowerCase()))
      .sort()
      .slice(0, 15)
      .join('|');

    const forms = [...new Set(page.forms.map(f => f.toLowerCase()))].sort().join('|');

    // Count-based signals (not exact values, just presence/structure)
    const structure = [
      `b:${buttons}`,
      `i:${inputs}`,
      `t:${tableHeaders}`,
      `f:${forms}`,
      `sf:${page.searchFields.length > 0 ? '1' : '0'}`,
      `pg:${page.pagination ? '1' : '0'}`,
    ].join(';');

    return structure;
  }

  /**
   * Groups pages by (urlPattern, structuralFingerprint) and returns one
   * representative per group along with full deduplication metadata.
   *
   * Pages with unique URL patterns (no `:id` substitution happened) are always
   * their own representatives, even if they happen to have similar structure.
   */
  static deduplicate(pages: PageMetadata[]): DeduplicationResult {
    const urlToRepresentative = new Map<string, string>();
    const groups = new Map<string, string[]>();
    const urlPatterns = new Map<string, string>();

    // Group pages by (normalisedUrl + fingerprint)
    const templateMap = new Map<string, PageMetadata[]>();

    for (const page of pages) {
      const normUrl = PageDeduplicator.normaliseUrlPattern(page.url);
      urlPatterns.set(page.url, normUrl);

      // Only deduplicate if the URL was actually normalised (i.e. it contained a dynamic segment)
      const isDynamic = normUrl !== page.url.replace(/\/$/, '');
      if (!isDynamic) {
        // Unique page — maps to itself
        templateMap.set(`unique:${page.url}`, [page]);
        continue;
      }

      const fp = PageDeduplicator.fingerprint(page);
      const key = `${normUrl}::${fp}`;
      if (!templateMap.has(key)) templateMap.set(key, []);
      templateMap.get(key)!.push(page);
    }

    const representatives: PageMetadata[] = [];

    for (const [, group] of templateMap) {
      // Sort so the representative is always the same page regardless of crawl order
      group.sort((a, b) => a.url.localeCompare(b.url));
      const rep = group[0];
      representatives.push(rep);

      const groupUrls = group.map(p => p.url);
      groups.set(rep.url, groupUrls);

      for (const page of group) {
        urlToRepresentative.set(page.url, rep.url);
      }
    }

    return { representatives, urlToRepresentative, groups, urlPatterns };
  }

  /**
   * Builds a human-readable note for a page that is a duplicate of a representative.
   * This note is appended to the representative's documentation overview
   * when it's applied to all pages in the group.
   */
  static buildDuplicateNote(representativeUrl: string, allUrls: string[], urlPattern: string): string {
    const count = allUrls.length;
    if (count <= 1) return '';
    return `\n\n> **Note:** This documentation applies to ${count} pages that share the same layout (URL pattern: \`${urlPattern}\`). Each page displays different data but works the same way.`;
  }
}
