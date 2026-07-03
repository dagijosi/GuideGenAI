import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Browser,
  BrowserContext,
  Page,
  chromium,
  firefox,
  webkit,
  BrowserType as PlaywrightBrowserType,
} from 'playwright';
import { BrowserType } from '../../common/types';
import { BrowserException } from '../../common/exceptions/guidegen.exceptions';
import { ensureDir } from '../../common/utils/file.utils';
import { join } from 'path';
import { existsSync } from 'fs';

interface SessionData {
  cookies: Record<string, string>[];
  localStorage: Record<string, string>;
}

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();

  constructor(private readonly configService: ConfigService) {}

  async onModuleDestroy(): Promise<void> {
    await this.closeAll();
  }

  async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }
    return this.launchBrowser();
  }

  private async launchBrowser(): Promise<Browser> {
    const browserType = this.configService.get<BrowserType>('BROWSER_TYPE', 'chromium');
    const headlessRaw = this.configService.get<string>('BROWSER_HEADLESS', 'true');
    const headless = headlessRaw === 'true' || headlessRaw === '1';

    const launcher: PlaywrightBrowserType = this.getBrowserLauncher(browserType);

    this.browser = await launcher.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    this.logger.log(`Browser launched: ${browserType} (headless=${headless})`);
    return this.browser;
  }

  private getBrowserLauncher(browserType: BrowserType): PlaywrightBrowserType {
    switch (browserType) {
      case 'firefox':
        return firefox;
      case 'webkit':
        return webkit;
      default:
        return chromium;
    }
  }

  async createContext(projectId: string, sessionPath?: string): Promise<BrowserContext> {
    const browser = await this.getBrowser();

    const contextOptions: Parameters<Browser['newContext']>[0] = {
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    };

    if (sessionPath && existsSync(sessionPath)) {
      contextOptions.storageState = sessionPath;
      this.logger.log(`Restoring session for project ${projectId}`);
    } else {
      this.logger.log(`No saved session found for project ${projectId}, starting fresh`);
    }

    const context = await browser.newContext(contextOptions);
    this.contexts.set(projectId, context);
    this.logger.log(`Browser context created for project: ${projectId}`);
    return context;
  }

  async getContext(projectId: string): Promise<BrowserContext> {
    const context = this.contexts.get(projectId);
    if (!context) {
      throw new BrowserException(`No browser context found for project: ${projectId}`);
    }
    return context;
  }

  async newPage(projectId: string): Promise<Page> {
    const context = await this.getContext(projectId);
    const page = await context.newPage();
    const timeout = parseInt(this.configService.get<string>('BROWSER_TIMEOUT', '30000'), 10);
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);
    return page;
  }

  async saveSession(projectId: string, sessionPath: string): Promise<void> {
    const context = this.contexts.get(projectId);
    if (!context) return;

    ensureDir(join(sessionPath, '..'));
    await context.storageState({ path: sessionPath });
    this.logger.log(`Session saved for project: ${projectId}`);
  }

  async closeContext(projectId: string): Promise<void> {
    const context = this.contexts.get(projectId);
    if (context) {
      await context.close();
      this.contexts.delete(projectId);
      this.logger.log(`Browser context closed for project: ${projectId}`);
    }
  }

  async closeAll(): Promise<void> {
    for (const [id, context] of this.contexts) {
      await context.close().catch(() => undefined);
      this.contexts.delete(id);
    }
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
    this.logger.log('All browser resources closed');
  }

  getSessionPath(projectId: string): string {
    const sessionsPath = this.configService.get<string>('SESSIONS_PATH', './storage/sessions');
    return join(sessionsPath, `${projectId}.json`);
  }
}
