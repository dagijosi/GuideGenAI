import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import { BrowserService } from '../browser/browser.service';
import { UiAnalyzerService } from './ui-analyzer.service';
import { ScreenshotService } from './screenshot.service';
import { PageMetadata } from '../../common/interfaces/page-metadata.interface';
import { CrawlJobOptions } from '../../common/types';
import { shouldCrawlUrl, normalizeUrl } from '../../common/utils/url.utils';
import { DEFAULT_CRAWL_OPTIONS } from '../../common/constants';

export type ProgressCallback = (message: string, progress: number, pageCount?: number) => void;

/**
 * URL path patterns that belong only to the pre-auth (public) phase.
 * During the post-auth phase these are skipped — they were already covered.
 */
const AUTH_PAGE_PATTERNS = [
  /\/(login|signin|sign-in|sign_in)(\/|$|\?)/i,
  /\/(logout|signout|sign-out|sign_out)(\/|$|\?)/i,
  /\/(register|signup|sign-up|sign_up)(\/|$|\?)/i,
  /\/(forgot-password|reset-password|password-reset)(\/|$|\?)/i,
];

const PUBLIC_ONLY_PATH_PATTERNS = [
  ...AUTH_PAGE_PATTERNS,
  /\/(terms|privacy|cookie-policy|legal)(\/|$|\?)/i,
];

export interface CrawlPhaseResult {
  pages: PageMetadata[];
  /** URL the browser was on at the end of this phase (used as next phase seed) */
  finalUrl?: string;
}

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    private readonly browserService: BrowserService,
    private readonly uiAnalyzer: UiAnalyzerService,
    private readonly screenshotService: ScreenshotService,
  ) {}

  // ---------------------------------------------------------------------------
  // PHASE 1 — Public (pre-auth) crawl
  // Crawls everything reachable without credentials, including signup/login pages.
  // Returns all discovered public pages + metadata.
  // ---------------------------------------------------------------------------
  async crawlPublicPhase(
    projectId: string,
    baseUrl: string,
    screenshotDir: string,
    options: Partial<CrawlJobOptions> = {},
    onProgress?: ProgressCallback,
    progressStart = 5,
    progressEnd = 40,
    signal?: AbortSignal,
  ): Promise<CrawlPhaseResult> {
    this.logger.log(`[Phase 1] Starting public crawl from: ${baseUrl}`);
    onProgress?.('Phase 1: Exploring public pages...', progressStart);

    const pages = await this.runCrawlLoop({
      projectId,
      startUrl: baseUrl,
      baseUrl,
      screenshotDir,
      options,
      onProgress,
      progressStart,
      progressEnd,
      skipPatterns: [], // crawl everything public, including login/signup
      stopOnLoginRedirect: false,
      phaseLabel: 'Public',
      signal,
    });

    return { pages };
  }

  async crawlAuthenticatedPhase(
    projectId: string,
    startUrl: string,
    baseUrl: string,
    screenshotDir: string,
    options: Partial<CrawlJobOptions> = {},
    onProgress?: ProgressCallback,
    alreadyVisited: Set<string> = new Set(),
    progressStart = 55,
    progressEnd = 90,
    signal?: AbortSignal,
  ): Promise<CrawlPhaseResult> {
    this.logger.log(`[Phase 2] Starting authenticated crawl from: ${startUrl}`);
    onProgress?.('Phase 2: Exploring authenticated pages...', progressStart);

    const pages = await this.runCrawlLoop({
      projectId,
      startUrl,
      baseUrl,
      screenshotDir,
      options,
      onProgress,
      progressStart,
      progressEnd,
      skipPatterns: PUBLIC_ONLY_PATH_PATTERNS, // skip public-only pages in auth phase
      stopOnLoginRedirect: true,               // stop if session expires
      phaseLabel: 'Auth',
      alreadyVisited,
      signal,
    });

    return { pages };
  }

  // ---------------------------------------------------------------------------
  // Core crawl loop — shared by both phases
  // ---------------------------------------------------------------------------
  private async runCrawlLoop(params: {
    projectId: string;
    startUrl: string;
    baseUrl: string;
    screenshotDir: string;
    options: Partial<CrawlJobOptions>;
    onProgress?: ProgressCallback;
    progressStart: number;
    progressEnd: number;
    skipPatterns: RegExp[];
    stopOnLoginRedirect: boolean;
    phaseLabel: string;
    alreadyVisited?: Set<string>;
    signal?: AbortSignal;
  }): Promise<PageMetadata[]> {
    const {
      projectId, startUrl, baseUrl, screenshotDir, options,
      onProgress, progressStart, progressEnd,
      skipPatterns, stopOnLoginRedirect, phaseLabel, alreadyVisited, signal,
    } = params;

    const opts = { ...DEFAULT_CRAWL_OPTIONS, ...options };
    const visited = new Set<string>(alreadyVisited ?? []);
    const queue: Array<{ url: string; depth: number; titlePath: string[]; urlPath: string[] }> = [
      { url: normalizeUrl(startUrl), depth: 0, titlePath: [], urlPath: [] },
    ];
    const pages: PageMetadata[] = [];
    let phaseCrawled = 0;
    const progressRange = progressEnd - progressStart;

    while (queue.length > 0 && phaseCrawled < opts.maxPages) {
      // Check for stop/cancel signal before processing each page
      if (signal?.aborted) {
        this.logger.log(`[${phaseLabel}] Crawl aborted (${String(signal.reason)}) after ${phaseCrawled} pages`);
        break;
      }

      const item = queue.shift()!;
      const { url, depth, titlePath, urlPath } = item;
      const normalized = normalizeUrl(url);

      if (visited.has(normalized) || depth > opts.maxDepth) continue;
      visited.add(normalized);

      const page = await this.browserService.newPage(projectId);
      try {
        const progressPct = progressStart + Math.round((phaseCrawled / Math.max(opts.maxPages, 1)) * progressRange);
        onProgress?.(`[${phaseLabel}] Exploring: ${normalized}`, Math.min(progressPct, progressEnd - 1));

        await page.goto(normalized, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.waitForPageReady(page);

        // Check for session expiry (auth phase only)
        const finalUrl = page.url();
        if (stopOnLoginRedirect && this.matchesPatterns(finalUrl, AUTH_PAGE_PATTERNS)) {
          this.logger.warn(`[${phaseLabel}] Session expired — redirected to: ${finalUrl}. Stopping.`);
          onProgress?.('Session expired — stopping authenticated crawl', progressEnd - 2);
          break;
        }

        const metadata = await this.uiAnalyzer.analyzePage(page);
        metadata.navigationPath = [...titlePath, metadata.title];
        metadata.navigationUrlPath = [...urlPath, normalized];

        if (opts.includeScreenshots) {
          const screenshotPath = await this.screenshotService.takeScreenshot(page, screenshotDir, normalized);
          if (screenshotPath) {
            metadata.screenshotPath = screenshotPath;
          }
        }

        pages.push(metadata);
        phaseCrawled++;
        this.logger.log(`[${phaseLabel}] Crawled [${phaseCrawled}]: ${metadata.title} (${normalized})`);

        // Emit updated page count so the frontend can show live progress
        const totalSoFar = (alreadyVisited?.size ?? 0) + pages.length;
        onProgress?.(`[${phaseLabel}] Crawled: ${metadata.title}`, Math.min(progressPct, progressEnd - 1), totalSoFar);
        if (depth < opts.maxDepth) {
          const newUrls = await this.discoverUrls(page, baseUrl);
          for (const newUrl of newUrls) {
            const norm = normalizeUrl(newUrl);
            if (visited.has(norm) || queue.some((q) => normalizeUrl(q.url) === norm)) continue;
            if (skipPatterns.length > 0 && this.matchesPatterns(norm, skipPatterns)) {
              this.logger.debug(`[${phaseLabel}] Skipping pattern-matched URL: ${norm}`);
              continue;
            }
            queue.push({
              url: norm,
              depth: depth + 1,
              titlePath: metadata.navigationPath,
              urlPath: metadata.navigationUrlPath ?? [...urlPath, normalized],
            });
          }
          this.logger.debug(`[${phaseLabel}] Queue: ${queue.length} remaining`);
        }
      } catch (error) {
        this.logger.warn(`[${phaseLabel}] Failed to crawl ${normalized}: ${(error as Error).message}`);
      } finally {
        await page.close().catch(() => undefined);
      }
    }

    onProgress?.(`[${phaseLabel}] Done — ${pages.length} pages`, progressEnd);
    this.logger.log(`[${phaseLabel}] Phase complete: ${pages.length} pages from ${phaseCrawled} visited`);
    return pages;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private matchesPatterns(url: string, patterns: RegExp[]): boolean {
    try {
      const pathname = new URL(url).pathname;
      return patterns.some((p) => p.test(pathname));
    } catch {
      return false;
    }
  }

  /**
   * Waits for the page to be fully ready for analysis and screenshots.
   *
   * Strategy:
   * 1. Wait for body to have real content (ensures JS has rendered the DOM)
   * 2. Wait for network to settle — but with font requests excluded via CSS injection
   * 3. Scroll to bottom to trigger lazy-loaded content
   * 4. Scroll back to top for clean screenshot framing
   * 5. Final stabilization delay for animations/transitions
   */
  private async waitForPageReady(page: Page): Promise<void> {
    // Inject font-display:optional early so external font requests don't block
    // networkidle or screenshot rendering. This is the primary cause of timeouts
    // on sites using Google Fonts or other external font CDNs.
    try {
      await page.addStyleTag({
        content: `* { font-display: optional !important; }`,
      });
    } catch {
      // Non-fatal — page may not support style injection (e.g. CSP)
    }

    try {
      // Wait for body to have real textual content
      await page.waitForFunction(
        () => document.body && document.body.innerText.length > 10,
        { timeout: 8000 },
      );
    } catch {
      this.logger.debug('Page has minimal text content — continuing anyway');
    }

    try {
      // Wait for network to be mostly idle (API calls, images, deferred scripts)
      // Fonts are now optional so this should settle faster
      await page.waitForLoadState('networkidle', { timeout: 8000 });
    } catch {
      this.logger.debug('Network did not idle within 8s — proceeding anyway');
    }

    // Short delay for SPA hydration and CSS animations
    await page.waitForTimeout(800);

    try {
      // Scroll to bottom to trigger lazy-load content
      await page.evaluate(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
      });
      await page.waitForTimeout(1000);

      // Scroll back to top for clean screenshot framing
      await page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
      await page.waitForTimeout(500);
    } catch (error) {
      this.logger.debug(`Scroll operation failed: ${(error as Error).message}`);
    }

    // Final stabilization for transitions
    await page.waitForTimeout(300);
  }

  private async discoverUrls(page: Page, baseUrl: string): Promise<string[]> {
    try {
      const currentUrl = page.url();
      const hrefs = await page.$$eval('a[href]', (links) =>
        links.map((link) => (link as HTMLAnchorElement).href).filter(Boolean),
      );

      const seen = new Set<string>();
      const result: string[] = [];

      for (const href of hrefs) {
        try {
          const resolved = new URL(href, currentUrl).toString();
          const normalized = resolved.split('#')[0].replace(/\/$/, '');
          if (!seen.has(normalized) && shouldCrawlUrl(normalized, baseUrl)) {
            seen.add(normalized);
            result.push(normalized);
          }
        } catch {
          // skip malformed URLs
        }
      }

      return result;
    } catch (error) {
      this.logger.warn(`URL discovery failed: ${(error as Error).message}`);
      return [];
    }
  }
}
