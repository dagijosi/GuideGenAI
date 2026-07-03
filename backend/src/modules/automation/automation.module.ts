import { Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { UiAnalyzerService } from './ui-analyzer.service';
import { CrawlerService } from './crawler.service';
import { ScreenshotService } from './screenshot.service';
import { BrowserModule } from '../browser/browser.module';
import { AuthenticationModule } from '../authentication/authentication.module';

@Module({
  imports: [BrowserModule, AuthenticationModule],
  providers: [AutomationService, UiAnalyzerService, CrawlerService, ScreenshotService],
  exports: [AutomationService, ScreenshotService],
})
export class AutomationModule {}
