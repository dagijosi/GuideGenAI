import { Controller, Get } from '@nestjs/common';
import { AiService } from './ai.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('AI')
@Controller('v1/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check LM Studio availability' })
  async getStatus(): Promise<{ available: boolean }> {
    const available = await this.aiService.isAvailable();
    return { available };
  }
}
