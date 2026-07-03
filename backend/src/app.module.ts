import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './modules/ai/ai.module';
import { AutomationModule } from './modules/automation/automation.module';
import { BrowserModule } from './modules/browser/browser.module';
import { ProjectModule } from './modules/project/project.module';
import { DocumentationModule } from './modules/documentation/documentation.module';
import { ExportModule } from './modules/export/export.module';
import { VideoModule } from './modules/video/video.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { FileModule } from './modules/file/file.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ReportModule } from './modules/report/report.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { DatabaseModule } from './common/database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AiModule,
    BrowserModule,
    AutomationModule,
    AuthenticationModule,
    ProjectModule,
    DocumentationModule,
    ExportModule,
    VideoModule,
    WorkflowModule,
    FileModule,
    SettingsModule,
    ReportModule,
  ],
})
export class AppModule {}
