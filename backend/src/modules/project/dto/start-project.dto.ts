import { IsOptional, IsIn, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class StartProjectDto {
  @ApiPropertyOptional({
    enum: ['overview', 'full', 'workflow'],
    default: 'overview',
    description: 'Documentation mode after crawl. overview = fast (1 AI call), full = all pages with dedup, workflow = deep-dive one workflow',
  })
  @IsOptional()
  @IsIn(['overview', 'full', 'workflow'])
  docMode?: 'overview' | 'full' | 'workflow';

  @ApiPropertyOptional({ description: 'Required when docMode is workflow — name or ID of the workflow to document' })
  @IsOptional()
  @IsString()
  workflowName?: string;
}
