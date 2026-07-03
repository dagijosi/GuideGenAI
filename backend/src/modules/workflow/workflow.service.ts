import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { AiService } from '../ai/ai.service';
import { IWorkflow } from '../../common/interfaces/workflow.interface';
import { PageMetadata } from '../../common/interfaces/page-metadata.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly aiService: AiService,
  ) {}

  async detectAndSaveWorkflows(projectId: string, pages: PageMetadata[]): Promise<IWorkflow[]> {
    this.logger.log(`Detecting workflows for project: ${projectId}`);

    const workflowPageGroups = await this.aiService.detectWorkflows(pages);
    const workflows: IWorkflow[] = [];

    for (const group of workflowPageGroups) {
      const steps = group.map((title, index) => {
        const page = pages.find((p) => p.title === title);
        return {
          order: index + 1,
          pageTitle: title,
          url: page?.url ?? '',
          action: index === 0 ? 'Start' : 'Navigate',
          screenshotPath: page?.screenshotPath,
        };
      });

      const workflow: IWorkflow = {
        id: uuidv4(),
        projectId,
        name: `${group[0]} → ${group[group.length - 1]}`,
        description: `Workflow from ${group[0]} to ${group[group.length - 1]}`,
        steps,
        createdAt: new Date().toISOString(),
      };

      this.db.getDb().prepare(`
        INSERT INTO workflows (id, project_id, name, description, steps, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(workflow.id, projectId, workflow.name, workflow.description, JSON.stringify(workflow.steps), workflow.createdAt);

      workflows.push(workflow);
    }

    this.logger.log(`Detected ${workflows.length} workflows for project: ${projectId}`);
    return workflows;
  }

  async getProjectWorkflows(projectId: string): Promise<IWorkflow[]> {
    const rows = this.db.getDb()
      .prepare('SELECT * FROM workflows WHERE project_id = ? ORDER BY created_at DESC')
      .all(projectId);

    return rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r['id'] as string,
        projectId: r['project_id'] as string,
        name: r['name'] as string,
        description: r['description'] as string,
        steps: JSON.parse(r['steps'] as string),
        videoPath: r['video_path'] as string | undefined,
        createdAt: r['created_at'] as string,
      };
    });
  }
}
