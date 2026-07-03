import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReportService } from './report.service';
import type { ProjectStats } from './report.service';

@ApiTags('Reports')
@Controller('v1/reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform statistics' })
  getStats(): ProjectStats {
    return this.reportService.getStats();
  }
}
