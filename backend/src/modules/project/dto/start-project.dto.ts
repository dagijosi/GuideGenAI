import { IsOptional, IsIn, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class StartProjectDto {
  @ApiPropertyOptional({
    enum: ['overview', 'full', 'workflow', 'discovery'],
    default: 'overview',
    description: 'Documentation mode after crawl. overview = fast (1 AI call), full = all pages with dedup, workflow = deep-dive one workflow, discovery = fast crawl only, no AI',
  })
  @IsOptional()
  @IsIn(['overview', 'full', 'workflow', 'discovery'])
  docMode?: 'overview' | 'full' | 'workflow' | 'discovery';

  @ApiPropertyOptional({ description: 'Required when docMode is workflow — name or ID of the workflow to document' })
  @IsOptional()
  @IsString()
  workflowName?: string;
}
