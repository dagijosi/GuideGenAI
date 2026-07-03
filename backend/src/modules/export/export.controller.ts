import { Controller, Post, Param, Query, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { ExportService } from './export.service';
import type { ExportFormat } from '../../common/types';

@ApiTags('Export')
@Controller('v1/export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post(':projectId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export project documentation' })
  @ApiQuery({ name: 'format', enum: ['markdown', 'json', 'html'], required: true })
  async export(
    @Param('projectId') projectId: string,
    @Query('format') format: ExportFormat,
    @Res() res: Response,
  ): Promise<void> {
    const filePath = await this.exportService.exportProject(projectId, format);
    res.download(filePath);
  }
}
