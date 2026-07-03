import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import { PageMetadata, ButtonMeta, InputMeta, TableMeta, NavigationLinkMeta } from '../../common/interfaces/page-metadata.interface';
import { SELECTORS } from '../../common/constants';

@Injectable()
export class UiAnalyzerService {
  private readonly logger = new Logger(UiAnalyzerService.name);

  async analyzePage(page: Page): Promise<PageMetadata> {
    this.logger.debug(`Analyzing page: ${page.url()}`);

    const [
      title,
      url,
      breadcrumbs,
      buttons,
      inputs,
      tables,
      navigationLinks,
      forms,
      textSections,
      hasPagination,
      images,
    ] = await Promise.all([
      this.getTitle(page),
      Promise.resolve(page.url()),
      this.getBreadcrumbs(page),
      this.getButtons(page),
      this.getInputs(page),
      this.getTables(page),
      this.getNavigationLinks(page),
      this.getForms(page),
      this.getTextSections(page),
      this.hasPagination(page),
      this.getImages(page),
    ]);

    return {
      title,
      url,
      breadcrumbs,
      navigationPath: [],
      buttons,
      inputs,
      dropdowns: await this.getDropdowns(page),
      tables,
      cards: await this.getCards(page),
      charts: await this.getCharts(page),
      dialogs: await this.getDialogs(page),
      forms,
      searchFields: await this.getSearchFields(page),
      filters: await this.getFilters(page),
      pagination: hasPagination,
      images,
      icons: [],
      textSections,
      navigationLinks,
      visitedAt: new Date().toISOString(),
    };
  }

  private async getTitle(page: Page): Promise<string> {
    try {
      return await page.title();
    } catch {
      return 'Unknown';
    }
  }

  private async getBreadcrumbs(page: Page): Promise<string[]> {
    try {
      return await page.$$eval(SELECTORS.BREADCRUMBS + ' a, ' + SELECTORS.BREADCRUMBS + ' span', (els) =>
        els.map((el) => el.textContent?.trim() ?? '').filter(Boolean),
      );
    } catch {
      return [];
    }
  }

  private async getButtons(page: Page): Promise<ButtonMeta[]> {
    try {
      return await page.$$eval(SELECTORS.BUTTONS, (els) =>
        els.slice(0, 50).map((el) => ({
          text: el.textContent?.trim() ?? '',
          type: el.getAttribute('type') ?? 'button',
          selector: el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : 'button',
        })),
      );
    } catch {
      return [];
    }
  }

  private async getInputs(page: Page): Promise<InputMeta[]> {
    try {
      return await page.$$eval(SELECTORS.INPUTS, (els) =>
        els.slice(0, 30).map((el) => ({
          label: el.getAttribute('aria-label') ?? el.getAttribute('placeholder') ?? '',
          type: el.getAttribute('type') ?? 'text',
          name: el.getAttribute('name') ?? '',
          placeholder: el.getAttribute('placeholder') ?? '',
        })),
      );
    } catch {
      return [];
    }
  }

  private async getTables(page: Page): Promise<TableMeta[]> {
    try {
      return await page.$$eval(SELECTORS.TABLES, (tables) =>
        tables.map((table) => ({
          headers: Array.from(table.querySelectorAll('th')).map((th) => th.textContent?.trim() ?? ''),
          rowCount: table.querySelectorAll('tbody tr').length,
        })),
      );
    } catch {
      return [];
    }
  }

  private async getNavigationLinks(page: Page): Promise<NavigationLinkMeta[]> {
    try {
      return await page.$$eval(SELECTORS.NAV + ' a', (links) =>
        links.slice(0, 50).map((link) => ({
          text: link.textContent?.trim() ?? '',
          href: link.getAttribute('href') ?? '',
          isActive:
            link.classList.contains('active') ||
            link.getAttribute('aria-current') === 'page',
        })),
      );
    } catch {
      return [];
    }
  }

  private async getForms(page: Page): Promise<string[]> {
    try {
      return await page.$$eval(SELECTORS.FORMS, (forms) =>
        forms.map((f) => f.getAttribute('id') ?? f.getAttribute('name') ?? 'form'),
      );
    } catch {
      return [];
    }
  }

  private async getTextSections(page: Page): Promise<string[]> {
    try {
      return await page.$$eval('h1, h2, h3, h4', (els) =>
        els.slice(0, 20).map((el) => el.textContent?.trim() ?? '').filter(Boolean),
      );
    } catch {
      return [];
    }
  }

  private async hasPagination(page: Page): Promise<boolean> {
    try {
      const el = await page.$(SELECTORS.PAGINATION);
      return !!el;
    } catch {
      return false;
    }
  }

  private async getImages(page: Page): Promise<string[]> {
    try {
      return await page.$$eval('img[alt]', (imgs) =>
        imgs.slice(0, 20).map((img) => img.getAttribute('alt') ?? '').filter(Boolean),
      );
    } catch {
      return [];
    }
  }

  private async getDropdowns(page: Page): Promise<string[]> {
    try {
      return await page.$$eval('select, [role="listbox"], [role="combobox"]', (els) =>
        els.slice(0, 20).map((el) => el.getAttribute('aria-label') ?? el.getAttribute('name') ?? 'dropdown'),
      );
    } catch {
      return [];
    }
  }

  private async getCards(page: Page): Promise<string[]> {
    try {
      return await page.$$eval(SELECTORS.CARDS, (els) =>
        els.slice(0, 20).map((el) => el.querySelector('h2, h3, h4, .card-title')?.textContent?.trim() ?? 'card').filter(Boolean),
      );
    } catch {
      return [];
    }
  }

  private async getCharts(page: Page): Promise<string[]> {
    try {
      return await page.$$eval('canvas, svg[class*="chart"], [class*="chart"]', (els) =>
        els.slice(0, 10).map((el) => el.getAttribute('aria-label') ?? 'chart'),
      );
    } catch {
      return [];
    }
  }

  private async getDialogs(page: Page): Promise<string[]> {
    try {
      return await page.$$eval(SELECTORS.MODALS, (els) =>
        els.map((el) => el.getAttribute('aria-label') ?? el.querySelector('h2, h3')?.textContent?.trim() ?? 'dialog'),
      );
    } catch {
      return [];
    }
  }

  private async getSearchFields(page: Page): Promise<string[]> {
    try {
      return await page.$$eval(
        'input[type="search"], input[placeholder*="search" i], input[aria-label*="search" i]',
        (els) => els.map((el) => el.getAttribute('placeholder') ?? 'search'),
      );
    } catch {
      return [];
    }
  }

  private async getFilters(page: Page): Promise<string[]> {
    try {
      return await page.$$eval('[class*="filter"], [data-filter]', (els) =>
        els.slice(0, 10).map((el) => el.textContent?.trim() ?? 'filter').filter(Boolean),
      );
    } catch {
      return [];
    }
  }
}
