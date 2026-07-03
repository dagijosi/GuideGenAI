import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import { BrowserService } from '../browser/browser.service';
import { UiAnalyzerService } from './ui-analyzer.service';
import { ScreenshotService } from './screenshot.service';
import { PageMetadata } from '../../common/interfaces/page-metadata.interface';
import { CrawlJobOptions } from '../../common/types';
import { shouldCrawlUrl, normalizeUrl } from '../../common/utils/url.utils';
import { DEFAULT_CRAWL_OPTIONS } from '../../common/constants';

export type ProgressCallback = (message: string, progress: number) => void;

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    private readonly browserService: BrowserService,
    private readonly uiAnalyzer: UiAnalyzerService,
    private readonly screenshotService: ScreenshotService,
  ) {}

  async crawl(
    projectId: string,
    startUrl: string,
    screenshotDir: string,
    options: Partial<CrawlJobOptions> = {},
    onProgress?: ProgressCallback,
  ): Promise<PageMetadata[]> {
    const opts = { ...DEFAULT_CRAWL_OPTIONS, ...options };
    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number; path: string[] }> = [
      { url: normalizeUrl(startUrl), depth: 0, path: [] },
    ];
    const pages: PageMetadata[] = [];

    this.logger.log(`Starting crawl from: ${startUrl}`);
    onProgress?.('Starting website exploration...', 15);

    while (queue.length > 0 && visited.size < opts.maxPages) {
      const item = queue.shift()!;
      const { url, depth, path } = item;
      const normalized = normalizeUrl(url);

      if (visited.has(normalized) || depth > opts.maxDepth) continue;
      visited.add(normalized);

      const page = await this.browserService.newPage(projectId);
      try {
        const progressPct = 15 + Math.round((visited.size / Math.min(opts.maxPages, 50)) * 65);
        onProgress?.(`Exploring: ${normalized}`, Math.min(progressPct, 80));

        // Use domcontentloaded + short wait — more reliable than networkidle on SPAs
        await page.goto(normalized, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });

        // Wait for the page to settle — handles React/Vue/Angular hydration
        await this.waitForPageReady(page);

        const metadata = await this.uiAnalyzer.analyzePage(page);
        metadata.navigationPath = [...path, metadata.title];

        if (opts.includeScreenshots) {
          const screenshotPath = await this.screenshotService.takeScreenshot(
            page,
            screenshotDir,
            normalized,
          );
          if (screenshotPath) {
            metadata.screenshotPath = screenshotPath;
            this.logger.log(`Screenshot saved: ${screenshotPath}`);
          }
        }

        pages.push(metadata);
        this.logger.log(`Crawled [${visited.size}]: ${metadata.title} (${normalized})`);

        // Discover new links
        if (depth < opts.maxDepth) {
          const newUrls = await this.discoverUrls(page, startUrl);
          for (const newUrl of newUrls) {
            const norm = normalizeUrl(newUrl);
            if (!visited.has(norm) && !queue.some((q) => normalizeUrl(q.url) === norm)) {
              queue.push({ url: norm, depth: depth + 1, path: metadata.navigationPath });
            }
          }
          this.logger.debug(`Queue size: ${queue.length}, discovered from ${normalized}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to crawl ${normalized}: ${(error as Error).message}`);
      } finally {
        await page.close().catch(() => undefined);
      }
    }

    onProgress?.(`Exploration complete — ${pages.length} pages found`, 82);
    this.logger.log(`Crawl complete: ${pages.length} pages discovered from ${visited.size} visited`);
    return pages;
  }

  /**
   * Waits for the page to be visually ready — handles SPAs that hydrate after DOMContentLoaded
   */
  private async waitForPageReady(page: Page): Promise<void> {
    try {
      // Wait for body to have actual content
      await page.waitForFunction(
        () => document.body && document.body.innerText.length > 10,
        { timeout: 5000 },
      );
    } catch {
      // Page may have minimal content — still proceed
    }

    // Short fixed delay to let JS frameworks render
    await page.waitForTimeout(800);
  }

  private async discoverUrls(page: Page, baseUrl: string): Promise<string[]> {
    try {
      const currentUrl = page.url();

      // Collect all hrefs from anchor tags
      const hrefs = await page.$$eval('a[href]', (links) =>
        links.map((link) => (link as HTMLAnchorElement).href).filter(Boolean),
      );

      const seen = new Set<string>();
      const result: string[] = [];

      for (const href of hrefs) {
        try {
          // href from $$eval is already resolved to absolute URL by the browser
          const resolved = new URL(href, currentUrl).toString();
          const normalized = resolved.split('#')[0].replace(/\/$/, '');

          if (!seen.has(normalized) && shouldCrawlUrl(normalized, baseUrl)) {
            seen.add(normalized);
            result.push(normalized);
          }
        } catch {
          // skip malformed
        }
      }

      return result;
    } catch (error) {
      this.logger.warn(`URL discovery failed: ${(error as Error).message}`);
      return [];
    }
  }
}
