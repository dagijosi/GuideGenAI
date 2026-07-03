import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { LmStudioProvider } from './providers/lm-studio.provider';
import { AiController } from './ai.controller';

@Module({
  controllers: [AiController],
  providers: [AiService, LmStudioProvider],
  exports: [AiService],
})
export class AiModule {}
