import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import { BrowserService } from '../browser/browser.service';
import { LoginException } from '../../common/exceptions/guidegen.exceptions';

export interface LoginCredentials {
  username: string;
  password: string;
}

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);

  constructor(private readonly browserService: BrowserService) {}

  async login(page: Page, url: string, credentials: LoginCredentials): Promise<boolean> {
    this.logger.log(`Attempting login at: ${url}`);

    try {
      // Use domcontentloaded — networkidle times out on SPAs
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Give JS frameworks time to render the login form
      await page.waitForTimeout(1500);

      // If no login form found, the site may not require login — proceed anyway
      const loginDetected = await this.detectAndFillLoginForm(page, credentials);
      if (!loginDetected) {
        this.logger.warn('No login form detected — site may not require authentication');
        return false;
      }

      // Wait for post-login navigation — use a generous timeout, don't fail if it doesn't fire
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        page.waitForTimeout(5000), // fallback for SPAs that don't do a full navigation
      ]).catch(() => undefined);

      // Additional wait for SPA to finish rendering post-login
      await page.waitForTimeout(1000);

      const loginFailed = await this.detectLoginFailure(page);
      if (loginFailed) {
        throw new LoginException('Invalid credentials or login failed');
      }

      this.logger.log('Login successful');
      return true;
    } catch (error) {
      if (error instanceof LoginException) throw error;
      throw new LoginException(`${(error as Error).message}`);
    }
  }

  private async detectAndFillLoginForm(
    page: Page,
    credentials: LoginCredentials,
  ): Promise<boolean> {
    const usernameSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[name="user"]',
      'input[id*="email"]',
      'input[id*="username"]',
      'input[id*="user"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]',
    ];

    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[id*="password"]',
      'input[autocomplete="current-password"]',
    ];

    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      'button:has-text("Log in")',
      'button:has-text("Submit")',
      'button:has-text("Sign In")',
    ];

    // Wait for any username field to appear — up to 8s
    let usernameField = null;
    for (const selector of usernameSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 1000 });
        usernameField = await page.$(selector);
        if (usernameField) break;
      } catch {
        // try next selector
      }
    }

    let passwordField = null;
    for (const selector of passwordSelectors) {
      passwordField = await page.$(selector);
      if (passwordField) break;
    }

    if (!usernameField || !passwordField) {
      this.logger.warn('Could not find username or password field');
      return false;
    }

    await usernameField.fill(credentials.username);
    await page.waitForTimeout(200);
    await passwordField.fill(credentials.password);
    await page.waitForTimeout(200);

    let submitButton = null;
    for (const selector of submitSelectors) {
      submitButton = await page.$(selector);
      if (submitButton) break;
    }

    if (submitButton) {
      await submitButton.click();
      this.logger.log('Clicked submit button');
    } else {
      await passwordField.press('Enter');
      this.logger.log('Pressed Enter on password field');
    }

    return true;
  }

  private async detectLoginFailure(page: Page): Promise<boolean> {
    const errorSelectors = [
      '.error',
      '.alert-danger',
      '[role="alert"]',
      '.login-error',
      '.invalid-feedback',
      '.error-message',
      '[class*="error"]',
    ];

    for (const selector of errorSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = (await element.textContent()) ?? '';
          const lower = text.toLowerCase();
          if (
            lower.includes('invalid') ||
            lower.includes('incorrect') ||
            lower.includes('wrong') ||
            lower.includes('failed') ||
            lower.includes('unauthorized')
          ) {
            return true;
          }
        }
      } catch {
        // skip
      }
    }

    return false;
  }

  async isAuthenticated(page: Page): Promise<boolean> {
    const loginIndicators = [
      'input[type="password"]',
      'form[action*="login"]',
      'form[action*="signin"]',
    ];

    for (const selector of loginIndicators) {
      const element = await page.$(selector);
      if (element) return false;
    }

    return true;
  }
}
