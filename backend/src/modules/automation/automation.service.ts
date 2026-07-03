import { Injectable, Logger } from '@nestjs/common';
import { BrowserService } from '../browser/browser.service';
import { AuthenticationService } from '../authentication/authentication.service';
import { CrawlerService, ProgressCallback } from './crawler.service';
import { PageMetadata } from '../../common/interfaces/page-metadata.interface';
import { CrawlJobOptions } from '../../common/types';
import { IProject } from '../../common/interfaces/project.interface';
import { join } from 'path';

export interface CrawlResult {
  pages: PageMetadata[];
  screenshotDir: string;
}

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly browserService: BrowserService,
    private readonly authService: AuthenticationService,
    private readonly crawlerService: CrawlerService,
  ) {}

  async runCrawl(
    project: IProject,
    options: Partial<CrawlJobOptions>,
    onProgress?: ProgressCallback,
  ): Promise<CrawlResult> {
    const sessionPath = this.browserService.getSessionPath(project.id);
    const screenshotDir = join(project.storagePath, 'screenshots');

    onProgress?.('Launching browser...', 2);
    await this.browserService.createContext(project.id, sessionPath);

    // Handle authentication
    if (project.credentials?.username && project.credentials?.password) {
      onProgress?.('Opening login page...', 5);
      const loginPage = await this.browserService.newPage(project.id);

      try {
        onProgress?.('Logging in...', 8);
        await this.authService.login(loginPage, project.url, {
          username: project.credentials.username,
          password: project.credentials.password,
        });
        await this.browserService.saveSession(project.id, sessionPath);
        onProgress?.('Login successful, saving session...', 12);
      } finally {
        await loginPage.close().catch(() => undefined);
      }
    }

    onProgress?.('Discovering navigation...', 15);
    const pages = await this.crawlerService.crawl(
      project.id,
      project.url,
      screenshotDir,
      options,
      onProgress,
    );

    return { pages, screenshotDir };
  }

  async cleanupProject(projectId: string): Promise<void> {
    await this.browserService.closeContext(projectId);
  }
}
