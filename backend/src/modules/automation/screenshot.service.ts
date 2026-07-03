import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import { join, resolve } from 'path';
import { ensureDir, sanitizeFilename } from '../../common/utils/file.utils';
import { generatePageSlug } from '../../common/utils/url.utils';

@Injectable()
export class ScreenshotService {
  private readonly logger = new Logger(ScreenshotService.name);

  async takeScreenshot(page: Page, screenshotDir: string, url: string): Promise<string> {
    // Always resolve to absolute path — relative paths break when CWD is unexpected
    const absDir = resolve(screenshotDir);
    ensureDir(absDir);

    const slug = generatePageSlug(url) || 'page';
    const filename = `${slug}_${Date.now()}.png`;
    const screenshotPath = join(absDir, filename);

    try {
      // Try full-page screenshot first
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        timeout: 10000,
      });
      this.logger.debug(`Screenshot saved: ${screenshotPath}`);
      return screenshotPath;
    } catch (fullPageError) {
      this.logger.warn(`Full-page screenshot failed, trying viewport: ${(fullPageError as Error).message}`);
      try {
        // Fall back to viewport-only screenshot
        await page.screenshot({
          path: screenshotPath,
          fullPage: false,
          timeout: 8000,
        });
        this.logger.debug(`Viewport screenshot saved: ${screenshotPath}`);
        return screenshotPath;
      } catch (error) {
        this.logger.warn(`Screenshot completely failed for ${url}: ${(error as Error).message}`);
        return '';
      }
    }
  }

  async takeWorkflowScreenshot(
    page: Page,
    screenshotDir: string,
    stepName: string,
  ): Promise<string> {
    const absDir = resolve(screenshotDir);
    ensureDir(absDir);
    const filename = `workflow_${sanitizeFilename(stepName)}_${Date.now()}.png`;
    const screenshotPath = join(absDir, filename);

    try {
      await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 8000 });
      return screenshotPath;
    } catch {
      return '';
    }
  }
}
