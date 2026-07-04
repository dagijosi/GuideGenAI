import { Module, forwardRef } from '@nestjs/common';
import { DocumentationService } from './documentation.service';
import { DocumentationController } from './documentation.controller';
import { AiModule } from '../ai/ai.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [AiModule, forwardRef(() => ProjectModule)],
  controllers: [DocumentationController],
  providers: [DocumentationService],
  exports: [DocumentationService],
})
export class DocumentationModule {}
