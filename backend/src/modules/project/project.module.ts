import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { ProjectGateway } from './project.gateway';
import { AutomationModule } from '../automation/automation.module';
import { AiModule } from '../ai/ai.module';
import { DocumentationModule } from '../documentation/documentation.module';

@Module({
  imports: [AutomationModule, AiModule, DocumentationModule],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectGateway],
  exports: [ProjectService],
})
export class ProjectModule {}
