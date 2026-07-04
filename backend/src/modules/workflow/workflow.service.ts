import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { AiService, AppMap } from '../ai/ai.service';
import { IWorkflow } from '../../common/interfaces/workflow.interface';
import { PageMetadata } from '../../common/interfaces/page-metadata.interface';
import { WorkflowDetector } from '../../common/utils/workflow-detector';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly aiService: AiService,
  ) {}

  detectAndSaveWorkflows(
    projectId: string,
    pages: PageMetadata[],
    appMap?: AppMap,
  ): IWorkflow[] {
    this.logger.log(`Detecting workflows for project: ${projectId}`);

    const resolvedMap: AppMap =
      appMap ?? this.aiService.buildFallbackAppMapPublic(projectId, pages);

    const detected = WorkflowDetector.detect(pages);
    resolvedMap.workflows = WorkflowDetector.toTitlePaths(detected, pages);

    const workflows: IWorkflow[] = detected.map(wf => ({
      id: uuidv4(),
      projectId,
      name: wf.name,
      description: wf.description,
      steps: wf.pages.map((page, order) => ({
        order,
        pageTitle: WorkflowDetector.stepLabel(page, wf.patternPath[order], pages),
        url: page.url,
        action: order === 0 ? 'Start here' : 'Continue workflow',
        screenshotPath: page.screenshotPath,
      })),
      createdAt: new Date().toISOString(),
    }));

    for (const workflow of workflows) {
      this.db.getDb().prepare(
        `INSERT INTO workflows (id, project_id, name, description, steps, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        workflow.id,
        projectId,
        workflow.name,
        workflow.description,
        JSON.stringify(workflow.steps),
        workflow.createdAt,
      );
    }

    this.logger.log(`Detected ${workflows.length} navigation-based workflows for project: ${projectId}`);
    return workflows;
  }

  getProjectWorkflows(projectId: string): IWorkflow[] {
    const rows = this.db
      .getDb()
      .prepare(
        'SELECT * FROM workflows WHERE project_id = ? ORDER BY created_at DESC',
      )
      .all(projectId);

    return rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r['id'] as string,
        projectId: r['project_id'] as string,
        name: r['name'] as string,
        description: r['description'] as string,
        steps: JSON.parse(r['steps'] as string) as IWorkflow['steps'],
        videoPath: r['video_path'] as string | undefined,
        createdAt: r['created_at'] as string,
      };
    });
  }
}
