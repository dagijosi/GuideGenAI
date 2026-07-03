import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';

export interface ProjectStats {
  totalProjects: number;
  completedProjects: number;
  failedProjects: number;
  totalPages: number;
  totalWorkflows: number;
  totalScreenshots: number;
}

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(private readonly db: DatabaseService) {}

  getStats(): ProjectStats {
    const result = this.db.getDb().prepare(`
      SELECT
        COUNT(*) as total_projects,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_projects,
        SUM(page_count) as total_pages,
        SUM(workflow_count) as total_workflows,
        SUM(screenshot_count) as total_screenshots
      FROM projects
    `).get() as Record<string, number>;

    return {
      totalProjects: result['total_projects'] ?? 0,
      completedProjects: result['completed_projects'] ?? 0,
      failedProjects: result['failed_projects'] ?? 0,
      totalPages: result['total_pages'] ?? 0,
      totalWorkflows: result['total_workflows'] ?? 0,
      totalScreenshots: result['total_screenshots'] ?? 0,
    };
  }
}
