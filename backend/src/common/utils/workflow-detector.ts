import { PageMetadata } from '../interfaces/page-metadata.interface';
import { PageDeduplicator } from './page-deduplicator';
import { normalizeUrl } from './url.utils';

export interface DetectedWorkflow {
  /** Stable key derived from normalised URL pattern path */
  id: string;
  /** Human-readable name, e.g. "Home → Shop → Product Detail" */
  name: string;
  description: string;
  /** Ordered pages in this journey (one representative per URL pattern step) */
  pages: PageMetadata[];
  /** Normalised URL patterns for each step, e.g. /shop/:id */
  patternPath: string[];
}

/**
 * Detects user workflows from real crawl navigation paths — not AI guesses.
 *
 * During crawl, each page records the URL chain that led to it (BFS parent chain).
 * Pages that share the same product title but different URLs become distinct steps;
 * pages that share the same URL pattern (e.g. /products/:id) collapse into one
 * template workflow like "Home → Shop → Product Detail".
 */
export class WorkflowDetector {
  static detect(pages: PageMetadata[]): DetectedWorkflow[] {
    if (pages.length === 0) return [];

    const pagesByUrl = new Map<string, PageMetadata>();
    for (const p of pages) {
      pagesByUrl.set(normalizeUrl(p.url), p);
    }

    const patternMap = new Map<string, { pages: PageMetadata[]; pattern: string[] }>();

    for (const page of pages) {
      const urlPath = page.navigationUrlPath ?? [];
      if (urlPath.length < 2) continue;

      const resolvedPages = urlPath
        .map(u => pagesByUrl.get(normalizeUrl(u)))
        .filter((p): p is PageMetadata => !!p);

      if (resolvedPages.length < 2) continue;

      const pattern = urlPath.map(u => PageDeduplicator.normaliseUrlPattern(u));

      if (!WorkflowDetector.isValidPatternPath(pattern)) continue;

      // Collapse consecutive pages that share the same normalised pattern
      const { collapsedPages, collapsedPattern } = WorkflowDetector.collapseConsecutivePatterns(
        resolvedPages,
        pattern,
      );

      if (collapsedPages.length < 2) continue;
      if (!WorkflowDetector.isValidPatternPath(collapsedPattern)) continue;

      const patternKey = collapsedPattern.join('|');
      if (!patternMap.has(patternKey)) {
        patternMap.set(patternKey, { pages: collapsedPages, pattern: collapsedPattern });
      }
    }

    const workflows = [...patternMap.values()].map(({ pages: pathPages, pattern }) => {
      const name = WorkflowDetector.buildWorkflowName(pathPages, pattern, pages);
      return {
        id: pattern.join('|'),
        name,
        description: `User journey: ${name}`,
        pages: pathPages,
        patternPath: pattern,
      };
    });

    // Prefer longer, more specific journeys; cap count to avoid noise
    return workflows
      .sort((a, b) => b.pages.length - a.pages.length || a.name.localeCompare(b.name))
      .slice(0, 20);
  }

  /** Resolve a workflow by name substring or id; falls back to first. */
  static resolve(
    workflows: DetectedWorkflow[],
    workflowName?: string,
  ): DetectedWorkflow | null {
    if (workflows.length === 0) return null;

    if (workflowName) {
      const needle = workflowName.toLowerCase();
      const match = workflows.find(wf =>
        wf.name.toLowerCase().includes(needle)
        || wf.id.toLowerCase().includes(needle)
        || wf.description.toLowerCase().includes(needle),
      );
      if (match) return match;
    }

    return workflows[0];
  }

  /** Convert to title arrays for AppMap / AI context prompts. */
  static toTitlePaths(workflows: DetectedWorkflow[], allPages: PageMetadata[]): string[][] {
    return workflows.map(wf =>
      wf.pages.map((p, i) => WorkflowDetector.stepLabel(p, wf.patternPath[i], allPages)),
    );
  }

  /** Display label for a single step. */
  static stepLabel(page: PageMetadata, pattern: string, allPages: PageMetadata[]): string {
    if (pattern.includes(':id')) {
      return WorkflowDetector.inferDynamicStepName(pattern, page);
    }
    return WorkflowDetector.disambiguateTitle(page, allPages);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private static isValidPatternPath(pattern: string[]): boolean {
    if (pattern.length < 2) return false;

    const unique = new Set(pattern);
    if (unique.size < 2) return false;

    for (let i = 1; i < pattern.length; i++) {
      if (pattern[i] === pattern[i - 1]) return false;
    }

    return true;
  }

  private static collapseConsecutivePatterns(
    pages: PageMetadata[],
    patterns: string[],
  ): { collapsedPages: PageMetadata[]; collapsedPattern: string[] } {
    const collapsedPages: PageMetadata[] = [];
    const collapsedPattern: string[] = [];

    for (let i = 0; i < pages.length; i++) {
      const pat = patterns[i];
      if (i > 0 && pat === patterns[i - 1]) continue;
      collapsedPages.push(pages[i]);
      collapsedPattern.push(pat);
    }

    return { collapsedPages, collapsedPattern };
  }

  private static buildWorkflowName(
    pathPages: PageMetadata[],
    pattern: string[],
    allPages: PageMetadata[],
  ): string {
    return pathPages
      .map((p, i) => WorkflowDetector.stepLabel(p, pattern[i], allPages))
      .join(' → ');
  }

  private static disambiguateTitle(page: PageMetadata, allPages: PageMetadata[]): string {
    const dupes = allPages.filter(p => p.title === page.title);
    if (dupes.length <= 1) return page.title || WorkflowDetector.urlShortLabel(page.url);

    const slug = WorkflowDetector.urlShortLabel(page.url);
    const title = page.title || slug;
    return slug && slug.toLowerCase() !== title.toLowerCase()
      ? `${title} (${slug})`
      : title;
  }

  private static inferDynamicStepName(pattern: string, page: PageMetadata): string {
    try {
      const pathname = new URL(pattern).pathname;
      const segments = pathname.split('/').filter(Boolean);
      const staticSegs = segments.filter(s => s !== ':id');
      const parent = staticSegs[staticSegs.length - 1] ?? '';

      const LABELS: Record<string, string> = {
        shop: 'Shop Item',
        product: 'Product Detail',
        products: 'Product Detail',
        item: 'Item Detail',
        items: 'Item Detail',
        order: 'Order Detail',
        orders: 'Order Detail',
        user: 'User Profile',
        users: 'User Profile',
        learn: 'Learning Resource',
        article: 'Article Detail',
        articles: 'Article Detail',
        course: 'Course Detail',
        courses: 'Course Detail',
      };

      if (parent && LABELS[parent.toLowerCase()]) {
        return LABELS[parent.toLowerCase()];
      }

      if (parent) {
        const word = parent.charAt(0).toUpperCase() + parent.slice(1).replace(/-/g, ' ');
        return `${word} Detail`;
      }
    } catch {
      // fall through
    }

    return page.title && !WorkflowDetector.isGenericTitle(page.title)
      ? page.title
      : 'Item Detail';
  }

  private static isGenericTitle(title: string): boolean {
    const t = title.trim().toLowerCase();
    return t.length <= 2 || /^page$|^untitled$|^home$/.test(t);
  }

  private static urlShortLabel(url: string): string {
    try {
      const parts = new URL(url).pathname.split('/').filter(Boolean);
      return parts[parts.length - 1]?.replace(/-/g, ' ') ?? '';
    } catch {
      return '';
    }
  }
}
