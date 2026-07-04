import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../common/database/database.service';
import { IProject, ProjectStatus } from '../../common/interfaces/project.interface';
import { ProjectNotFoundException } from '../../common/exceptions/guidegen.exceptions';
import { AutomationService } from '../automation/automation.service';
import { DocumentationService, GenerateDocsOptions } from '../documentation/documentation.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { StartProjectDto } from './dto/start-project.dto';
import { ProjectGateway } from './project.gateway';
import { buildProjectPath, ensureDir } from '../../common/utils/file.utils';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);
  private readonly storagePath: string;

  /** One AbortController per running project — used to stop or cancel jobs */
  private readonly runningJobs = new Map<string, AbortController>();

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
    private readonly automationService: AutomationService,
    private readonly documentationService: DocumentationService,
    private readonly gateway: ProjectGateway,
  ) {
    this.storagePath = this.configService.get<string>('STORAGE_PATH', './storage');
  }

  async create(dto: CreateProjectDto): Promise<IProject> {
    const id = uuidv4();
    const storagePath = buildProjectPath(this.storagePath, id);
    ensureDir(storagePath);

    const now = new Date().toISOString();
    const credentials = dto.username
      ? JSON.stringify({ username: dto.username, password: dto.password })
      : null;

    this.db.getDb().prepare(`
      INSERT INTO projects (id, name, url, credentials, status, progress, storage_path, page_count, workflow_count, screenshot_count, video_count, max_depth, max_pages, include_screenshots, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'idle', 0, ?, 0, 0, 0, 0, ?, ?, ?, ?, ?)
    `).run(
      id, dto.name, dto.url, credentials, storagePath,
      dto.maxDepth ?? 3,
      dto.maxPages ?? 50,
      dto.includeScreenshots !== false ? 1 : 0,
      now, now,
    );

    this.logger.log(`Project created: ${id} — ${dto.name}`);
    return this.findById(id);
  }

  async findAll(): Promise<IProject[]> {
    const rows = this.db.getDb().prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  async findById(id: string): Promise<IProject> {
    const row = this.db.getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) throw new ProjectNotFoundException(id);
    return this.mapRow(row);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    this.db.getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
    this.logger.log(`Project deleted: ${id}`);
  }

  async update(id: string, dto: UpdateProjectDto): Promise<IProject> {
    const project = await this.findById(id);
    if (project.status === 'running') {
      throw new Error('Cannot edit a project while it is running');
    }

    const credentials =
      dto.username !== undefined
        ? JSON.stringify({ username: dto.username, password: dto.password ?? '' })
        : project.credentials
          ? JSON.stringify(project.credentials)
          : null;

    this.db.getDb().prepare(`
      UPDATE projects
      SET name = ?, url = ?, credentials = ?, max_depth = ?, max_pages = ?, include_screenshots = ?, updated_at = ?
      WHERE id = ?
    `).run(
      dto.name ?? project.name,
      dto.url ?? project.url,
      credentials,
      dto.maxDepth ?? project.maxDepth,
      dto.maxPages ?? project.maxPages,
      (dto.includeScreenshots !== undefined ? dto.includeScreenshots : project.includeScreenshots) ? 1 : 0,
      new Date().toISOString(),
      id,
    );

    this.logger.log(`Project updated: ${id}`);
    return this.findById(id);
  }

  async reset(id: string): Promise<IProject> {
    const project = await this.findById(id);
    if (project.status === 'running') {
      throw new Error('Cannot reset a running project — stop it first');
    }

    // Clear previous results from DB
    this.db.getDb().prepare('DELETE FROM documentation WHERE project_id = ?').run(id);
    this.db.getDb().prepare('DELETE FROM pages WHERE project_id = ?').run(id);
    this.db.getDb().prepare('DELETE FROM workflows WHERE project_id = ?').run(id);

    // Reset counters and status
    this.db.getDb().prepare(`
      UPDATE projects
      SET status = 'idle', progress = 0, error = NULL,
          page_count = 0, screenshot_count = 0, video_count = 0, workflow_count = 0,
          updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), id);

    this.logger.log(`Project reset: ${id}`);
    return this.findById(id);
  }

  async startJob(id: string, options: StartProjectDto = {}): Promise<void> {
    const project = await this.findById(id);
    if (project.status === 'running') {
      this.logger.warn(`Project ${id} is already running`);
      return;
    }

    const controller = new AbortController();
    this.runningJobs.set(id, controller);

    const docOptions: GenerateDocsOptions = {
      mode: options.docMode ?? 'overview',
      workflowName: options.workflowName,
    };

    // Run async without blocking the HTTP response
    this.runJob(project, controller.signal, docOptions).catch((error) => {
      this.logger.error(`Job failed for project ${id}: ${(error as Error).message}`);
      this.updateStatus(id, 'failed', 0, (error as Error).message);
    }).finally(() => {
      this.runningJobs.delete(id);
    });
  }

  /**
   * Re-generates documentation from stored crawl data without re-crawling.
   * Used for overview, workflow deep-dive, or full documentation modes.
   */
  async startScopedDocJob(id: string, options: GenerateDocsOptions): Promise<void> {
    const project = await this.findById(id);
    if (project.status === 'running') {
      throw new Error('Project is already running');
    }
    if (project.pageCount === 0 && this.documentationService.getPagesForProject(id).length === 0) {
      throw new Error('No crawled pages found. Run a crawl first.');
    }

    const controller = new AbortController();
    this.runningJobs.set(id, controller);

    void this.runScopedDocJob(project, options, controller.signal).catch((error) => {
      this.logger.error(`Scoped doc job failed for ${id}: ${(error as Error).message}`);
      this.updateStatus(id, 'failed', project.progress, (error as Error).message);
    }).finally(() => {
      this.runningJobs.delete(id);
    });
  }

  private async runScopedDocJob(
    project: IProject,
    options: GenerateDocsOptions,
    signal: AbortSignal,
  ): Promise<void> {
    this.updateStatus(project.id, 'running', 85);
    const emit = (message: string, progress: number) => {
      if (signal.aborted) return;
      this.gateway.emitProgress(project.id, message, progress);
      this.updateStatus(project.id, 'running', progress);
      this.logger.log(`[${project.id}] ${message}`);
    };

    try {
      emit(`Generating ${options.mode ?? 'overview'} documentation...`, 86);
      await this.documentationService.runScopedGeneration(project, options, emit, signal);

      if (signal.aborted) {
        this.updateStatus(project.id, 'paused', project.progress);
        return;
      }

      emit('Documentation complete!', 100);
      this.updateStatus(project.id, 'completed', 100);
    } catch (error) {
      if (signal.aborted) return;
      const message = (error as Error).message;
      this.gateway.emitProgress(project.id, `Error: ${message}`, -1);
      this.updateStatus(project.id, 'failed', project.progress, message);
    }
  }

  /**
   * Stops the running job gracefully — immediately marks as 'stopping' in the DB
   * so the frontend stops polling, then signals the crawl loop to exit cleanly.
   * The crawl loop saves progress and transitions to 'paused' when it exits.
   */
  async stopJob(id: string): Promise<void> {
    const project = await this.findById(id);
    if (project.status !== 'running') {
      this.logger.warn(`Project ${id} is not running (status: ${project.status})`);
      return;
    }

    // Write 'stopping' immediately so the next frontend poll sees it and stops refetching
    this.updateStatus(id, 'stopping', project.progress);
    this.gateway.emitProgress(id, 'Stop requested — finishing current page…', project.progress);

    const controller = this.runningJobs.get(id);
    if (controller) {
      controller.abort('stopped');
      this.logger.log(`Job stop requested: ${id}`);
    } else {
      // No controller found — job may have already ended, force paused
      this.updateStatus(id, 'paused', project.progress);
    }
  }

  /**
   * Cancels the running job immediately — marks as 'stopping' in the DB right away,
   * signals abort, and the crawl loop will transition to 'failed' when it exits.
   */
  async cancelJob(id: string): Promise<void> {
    const project = await this.findById(id);
    if (project.status !== 'running') {
      this.logger.warn(`Project ${id} is not running (status: ${project.status})`);
      return;
    }

    // Write 'stopping' immediately so the frontend stops polling
    this.updateStatus(id, 'stopping', project.progress);
    this.gateway.emitProgress(id, 'Cancelling…', project.progress);

    const controller = this.runningJobs.get(id);
    if (controller) {
      controller.abort('cancelled');
      this.logger.log(`Job cancel requested: ${id}`);
    } else {
      this.updateStatus(id, 'failed', project.progress, 'Cancelled by user');
    }
  }

  private async runJob(project: IProject, signal: AbortSignal, docOptions: GenerateDocsOptions = { mode: 'overview' }): Promise<void> {
    this.updateStatus(project.id, 'running', 0);

    const emit = (message: string, progress: number, pageCount?: number) => {
      if (signal.aborted) return;
      this.gateway.emitProgress(project.id, message, progress, pageCount);
      this.updateStatus(project.id, 'running', progress);
      this.logger.log(`[${project.id}] ${message}`);
    };

    try {
      emit('Launching browser...', 2);
      const { pages } = await this.automationService.runCrawl(
        project,
        {
          maxDepth: project.maxDepth,
          maxPages: project.maxPages,
          includeScreenshots: project.includeScreenshots,
          includeVideo: false,
          followExternalLinks: false,
          waitForNetworkIdle: false,
        },
        emit,
        signal,
      );

      if (signal.aborted) {
        const reason = signal.reason as string;
        const finalStatus: ProjectStatus = reason === 'stopped' ? 'paused' : 'failed';
        const msg = reason === 'stopped' ? `Stopped — ${pages.length} pages saved` : 'Cancelled';
        this.updateCounts(project.id, pages.length, pages.filter(p => p.screenshotPath).length);
        this.gateway.emitProgress(project.id, msg, project.progress);
        this.updateStatus(project.id, finalStatus, project.progress, reason === 'cancelled' ? 'Cancelled by user' : undefined);
        return;
      }

      this.updateCounts(project.id, pages.length, pages.filter(p => p.screenshotPath).length);

      emit('Generating AI documentation...', 85);
      const { docs, workflows } = await this.documentationService.generateProjectDocs(
        project, pages, emit, signal, docOptions,
      );

      if (signal.aborted) {
        const reason = signal.reason as string;
        const finalStatus: ProjectStatus = reason === 'stopped' ? 'paused' : 'failed';
        if (docs.pages.length > 0) {
          await this.documentationService.persistDocs(project.id, docs, workflows);
        }
        this.gateway.emitProgress(project.id, 'Stopped during documentation', project.progress);
        this.updateStatus(project.id, finalStatus, project.progress, reason === 'cancelled' ? 'Cancelled by user' : undefined);
        return;
      }

      emit('Saving documentation...', 95);
      await this.documentationService.persistDocs(project.id, docs, workflows, pages);

      emit('Documentation complete!', 100);
      this.updateStatus(project.id, 'completed', 100);
      // Update workflow count now that they're persisted
      if (workflows.length > 0) {
        this.db.getDb().prepare('UPDATE projects SET workflow_count = ? WHERE id = ?')
          .run(workflows.length, project.id);
      }
    } catch (error) {
      if (signal.aborted) return;
      const message = (error as Error).message;
      this.gateway.emitProgress(project.id, `Error: ${message}`, -1);
      this.updateStatus(project.id, 'failed', 0, message);
    } finally {
      await this.automationService.cleanupProject(project.id);
    }
  }

  private updateStatus(id: string, status: ProjectStatus, progress: number, error?: string): void {
    this.db.getDb().prepare(`
      UPDATE projects SET status = ?, progress = ?, error = ?, updated_at = ? WHERE id = ?
    `).run(status, progress, error ?? null, new Date().toISOString(), id);
  }

  private updateCounts(id: string, pageCount: number, screenshotCount: number): void {
    this.db.getDb()
      .prepare('UPDATE projects SET page_count = ?, screenshot_count = ? WHERE id = ?')
      .run(pageCount, screenshotCount, id);
  }

  private mapRow(row: Record<string, unknown>): IProject {
    return {
      id: row['id'] as string,
      name: row['name'] as string,
      url: row['url'] as string,
      credentials: row['credentials'] ? JSON.parse(row['credentials'] as string) : undefined,
      status: row['status'] as ProjectStatus,
      progress: row['progress'] as number,
      createdAt: row['created_at'] as string,
      updatedAt: row['updated_at'] as string,
      storagePath: row['storage_path'] as string,
      pageCount: row['page_count'] as number,
      workflowCount: row['workflow_count'] as number,
      screenshotCount: row['screenshot_count'] as number,
      videoCount: row['video_count'] as number,
      maxDepth: (row['max_depth'] as number) ?? 3,
      maxPages: (row['max_pages'] as number) ?? 50,
      includeScreenshots: row['include_screenshots'] !== 0,
      logs: [],
      error: row['error'] as string | undefined,
    };
  }
}
