import { Injectable, Logger } from '@nestjs/common';
import { BrowserService } from '../browser/browser.service';
import { AuthenticationService } from '../authentication/authentication.service';
import { CrawlerService, ProgressCallback } from './crawler.service';
import { ScreenshotService } from './screenshot.service';
import { UiAnalyzerService } from './ui-analyzer.service';
import { PageMetadata } from '../../common/interfaces/page-metadata.interface';
import { CrawlJobOptions } from '../../common/types';
import { IProject } from '../../common/interfaces/project.interface';
import { normalizeUrl } from '../../common/utils/url.utils';
import { join } from 'path';

export interface CrawlResult {
  pages: PageMetadata[];
  screenshotDir: string;
}

/**
 * Orchestrates the full two-phase crawl:
 *
 * Phase 1 — Public (pre-auth)
 *   - Crawl from the base URL, following all links
 *   - Visit signup page (screenshot + document)
 *   - Visit login page (screenshot + document)
 *
 * Phase 2 — Authenticated (post-auth)  [only if credentials provided]
 *   - Fill in login form with user-provided credentials
 *   - Capture post-login landing page (dashboard)
 *   - Crawl all authenticated pages: sidebar, topnav, sub-pages, etc.
 *   - Skip pages already covered in Phase 1
 */
@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly browserService: BrowserService,
    private readonly authService: AuthenticationService,
    private readonly crawlerService: CrawlerService,
    private readonly screenshotService: ScreenshotService,
    private readonly uiAnalyzer: UiAnalyzerService,
  ) {}

  async runCrawl(
    project: IProject,
    options: Partial<CrawlJobOptions>,
    onProgress?: ProgressCallback,
    signal?: AbortSignal,
  ): Promise<CrawlResult> {
    const sessionPath = this.browserService.getSessionPath(project.id);
    const screenshotDir = join(project.storagePath, 'screenshots');
    const hasCredentials = !!(project.credentials?.username && project.credentials?.password);

    // -------------------------------------------------------------------------
    // Browser setup
    // -------------------------------------------------------------------------
    onProgress?.('Launching browser...', 2);
    await this.browserService.createContext(project.id);

    // -------------------------------------------------------------------------
    // PHASE 1 — Public crawl (no login)
    // -------------------------------------------------------------------------
    onProgress?.('Phase 1: Exploring public pages...', 5);
    const { pages: publicPages, visitedUrls } = await this.runPublicPhase(
      project,
      screenshotDir,
      options,
      onProgress,
      hasCredentials,
      signal,
    );

    // If aborted during phase 1 — return what we have
    if (signal?.aborted) {
      return { pages: publicPages, screenshotDir };
    }

    // If no credentials, we are done
    if (!hasCredentials) {
      onProgress?.(`Complete — ${publicPages.length} pages documented`, 95);
      return { pages: publicPages, screenshotDir };
    }

    // -------------------------------------------------------------------------
    // Transition: Login with user credentials
    // -------------------------------------------------------------------------
    onProgress?.('Logging in with provided credentials...', 46);
    const postLoginUrl = await this.performLogin(project, screenshotDir, onProgress, visitedUrls);

    if (!postLoginUrl) {
      this.logger.warn('Login failed — returning Phase 1 results only');
      onProgress?.('Login failed — returning public pages only', 90);
      return { pages: publicPages, screenshotDir };
    }

    await this.browserService.saveSession(project.id, sessionPath);
    onProgress?.('Login successful — starting authenticated crawl...', 52);

    // -------------------------------------------------------------------------
    // PHASE 2 — Authenticated crawl
    // -------------------------------------------------------------------------
    const { pages: authPages } = await this.crawlerService.crawlAuthenticatedPhase(
      project.id,
      postLoginUrl,
      project.url,
      screenshotDir,
      options,
      onProgress,
      visitedUrls,
      55,
      90,
      signal,
    );

    const allPages = [...publicPages, ...authPages];
    onProgress?.(`Complete — ${allPages.length} pages documented (${publicPages.length} public + ${authPages.length} authenticated)`, 92);
    this.logger.log(`Crawl complete: ${allPages.length} total pages`);

    return { pages: allPages, screenshotDir };
  }

  // ---------------------------------------------------------------------------
  // Phase 1 helper — public crawl
  // Also ensures signup and login pages are explicitly visited and screenshotted
  // ---------------------------------------------------------------------------
  private async runPublicPhase(
    project: IProject,
    screenshotDir: string,
    options: Partial<CrawlJobOptions>,
    onProgress: ProgressCallback | undefined,
    hasCredentials: boolean,
    signal?: AbortSignal,
  ): Promise<{ pages: PageMetadata[]; visitedUrls: Set<string> }> {
    const { pages } = await this.crawlerService.crawlPublicPhase(
      project.id,
      project.url,
      screenshotDir,
      options,
      onProgress,
      5,
      hasCredentials ? 40 : 90,
      signal,
    );

    // Build set of visited URLs for deduplication in Phase 2
    const visitedUrls = new Set(pages.map((p) => normalizeUrl(p.url)));

    // If we have credentials, explicitly visit signup then login in that order
    // so they are documented and screenshotted before we actually log in
    if (hasCredentials) {
      const extraPages = await this.visitAuthPages(project, screenshotDir, visitedUrls, onProgress);
      pages.push(...extraPages);
      extraPages.forEach((p) => visitedUrls.add(normalizeUrl(p.url)));
    }

    return { pages, visitedUrls };
  }

  // ---------------------------------------------------------------------------
  // Explicitly visit signup then login pages (if they exist and weren't already
  // crawled) so they are documented before we fill in credentials
  // ---------------------------------------------------------------------------
  private async visitAuthPages(
    project: IProject,
    screenshotDir: string,
    visitedUrls: Set<string>,
    onProgress: ProgressCallback | undefined,
  ): Promise<PageMetadata[]> {
    const pages: PageMetadata[] = [];

    // Common signup and login path candidates — tried in order, first match wins
    const signupCandidates = ['/register', '/signup', '/sign-up', '/create-account'];
    const loginCandidates = ['/login', '/signin', '/sign-in'];

    const base = project.url.replace(/\/$/, '');

    const tryVisit = async (paths: string[], label: string): Promise<void> => {
      for (const path of paths) {
        const url = `${base}${path}`;
        const norm = normalizeUrl(url);
        if (visitedUrls.has(norm)) {
          this.logger.log(`${label} page already visited: ${url}`);
          return;
        }

        const page = await this.browserService.newPage(project.id);
        try {
          onProgress?.(`Visiting ${label} page...`, 42);
          const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

          // Page doesn't exist
          if (!response || response.status() === 404) continue;

          // Check we actually landed on this path (not redirected elsewhere)
          const finalUrl = page.url();
          const finalPath = new URL(finalUrl).pathname.toLowerCase();
          if (!finalPath.includes(path.replace(/^\//, '').split('-')[0])) continue;

          await page.waitForTimeout(800);

          const metadata = await this.uiAnalyzer.analyzePage(page);
          metadata.navigationPath = [label];
          metadata.navigationUrlPath = [normalizeUrl(finalUrl)];

          const screenshotPath = await this.screenshotService.takeScreenshot(page, screenshotDir, finalUrl);
          if (screenshotPath) metadata.screenshotPath = screenshotPath;

          pages.push(metadata);
          visitedUrls.add(normalizeUrl(finalUrl));
          this.logger.log(`Documented ${label}: ${finalUrl}`);
          return; // found — stop trying other candidates for this label
        } catch (error) {
          this.logger.debug(`${label} not at ${url}: ${(error as Error).message}`);
        } finally {
          await page.close().catch(() => undefined);
        }
      }
      this.logger.log(`${label} page not found for: ${base}`);
    };

    await tryVisit(signupCandidates, 'Signup');
    await tryVisit(loginCandidates, 'Login');

    return pages;
  }

  // ---------------------------------------------------------------------------
  // Login and return the post-login URL (dashboard entry point)
  // Resolves the actual login page URL from Phase 1 findings, then logs in.
  // ---------------------------------------------------------------------------
  private async performLogin(
    project: IProject,
    screenshotDir: string,
    onProgress: ProgressCallback | undefined,
    visitedUrls?: Set<string>,
  ): Promise<string | null> {
    // Find the login URL — prefer one we already confirmed exists in Phase 1
    const loginUrl = this.resolveLoginUrl(project.url, visitedUrls);
    this.logger.log(`Using login URL: ${loginUrl}`);

    const loginPage = await this.browserService.newPage(project.id);
    try {
      onProgress?.('Opening login page...', 47);
      const success = await this.authService.login(loginPage, loginUrl, {
        username: project.credentials!.username!,
        password: project.credentials!.password!,
      });

      if (!success) return null;

      // Capture a screenshot of the dashboard as the first authenticated page
      onProgress?.('Capturing dashboard screenshot...', 50);
      await loginPage.waitForTimeout(1000); // let dashboard fully render
      await this.screenshotService.takeScreenshot(loginPage, screenshotDir, loginPage.url());

      const postLoginUrl = loginPage.url();
      this.logger.log(`Post-login landing URL: ${postLoginUrl}`);
      return postLoginUrl;
    } catch (error) {
      this.logger.error(`Login failed: ${(error as Error).message}`);
      return null;
    } finally {
      await loginPage.close().catch(() => undefined);
    }
  }

  /**
   * Finds the login page URL by checking which login-path candidates were
   * already confirmed visited in Phase 1, falling back to common guesses.
   */
  private resolveLoginUrl(baseUrl: string, visitedUrls?: Set<string>): string {
    const base = baseUrl.replace(/\/$/, '');
    const loginCandidates = ['/login', '/signin', '/sign-in'];

    if (visitedUrls) {
      for (const path of loginCandidates) {
        const url = `${base}${path}`;
        if (visitedUrls.has(normalizeUrl(url))) {
          return url;
        }
      }
    }

    // Default fallback
    return `${base}/login`;
  }

  async cleanupProject(projectId: string): Promise<void> {
    await this.browserService.closeContext(projectId);
  }
}
