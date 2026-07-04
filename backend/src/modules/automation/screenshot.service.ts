import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import { join, resolve } from 'path';
import { ensureDir, sanitizeFilename } from '../../common/utils/file.utils';
import { generatePageSlug } from '../../common/utils/url.utils';

@Injectable()
export class ScreenshotService {
  private readonly logger = new Logger(ScreenshotService.name);

  async takeScreenshot(page: Page, screenshotDir: string, url: string): Promise<string> {
    const absDir = resolve(screenshotDir);
    ensureDir(absDir);

    const slug = generatePageSlug(url) || 'page';
    const filename = `${slug}_${Date.now()}.png`;
    const screenshotPath = join(absDir, filename);

    // Inject a style that marks all fonts as optional so Playwright's screenshot
    // renderer does not wait for external font CDN requests to complete.
    // This is the main cause of "waiting for fonts to load..." timeouts.
    try {
      await page.addStyleTag({
        content: `@font-face { font-display: optional !important; }
                  * { font-display: optional !important; }`,
      });
    } catch {
      // Non-fatal — best effort
    }

    // Attempt 1: full-page screenshot with animations disabled
    try {
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        animations: 'disabled',
        timeout: 12000,
      });
      this.logger.debug(`Screenshot saved: ${screenshotPath}`);
      return screenshotPath;
    } catch (fullPageError) {
      this.logger.warn(`Full-page screenshot failed, trying viewport: ${(fullPageError as Error).message}`);
    }

    // Attempt 2: viewport-only, animations disabled
    try {
      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        animations: 'disabled',
        timeout: 8000,
      });
      this.logger.debug(`Viewport screenshot saved: ${screenshotPath}`);
      return screenshotPath;
    } catch (viewportError) {
      this.logger.warn(`Viewport screenshot failed, trying clip: ${(viewportError as Error).message}`);
    }

    // Attempt 3: clip to a fixed region — works even when full layout hasn't settled
    try {
      const viewportSize = page.viewportSize();
      const width = viewportSize?.width ?? 1280;
      const height = viewportSize?.height ?? 800;
      await page.screenshot({
        path: screenshotPath,
        clip: { x: 0, y: 0, width, height },
        animations: 'disabled',
        timeout: 6000,
      });
      this.logger.debug(`Clip screenshot saved: ${screenshotPath}`);
      return screenshotPath;
    } catch (error) {
      this.logger.warn(`Screenshot completely failed for ${url}: ${(error as Error).message}`);
      return '';
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
      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        animations: 'disabled',
        timeout: 8000,
      });
      return screenshotPath;
    } catch {
      return '';
    }
  }
}
