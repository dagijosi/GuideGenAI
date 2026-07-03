import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../common/database/database.service';
import { IProject, ProjectStatus } from '../../common/interfaces/project.interface';
import { ProjectNotFoundException } from '../../common/exceptions/guidegen.exceptions';
import { AutomationService } from '../automation/automation.service';
import { AiService } from '../ai/ai.service';
import { DocumentationService } from '../documentation/documentation.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectGateway } from './project.gateway';
import { buildProjectPath, ensureDir } from '../../common/utils/file.utils';
import { join } from 'path';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);
  private readonly storagePath: string;

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
    private readonly automationService: AutomationService,
    private readonly aiService: AiService,
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
      throw new Error('Cannot reset a running project — wait for it to finish or stop it first');
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

  async startJob(id: string): Promise<void> {
    const project = await this.findById(id);
    if (project.status === 'running') {
      this.logger.warn(`Project ${id} is already running`);
      return;
    }

    // Run async without blocking
    this.runJob(project).catch((error) => {
      this.logger.error(`Job failed for project ${id}: ${(error as Error).message}`);
      this.updateStatus(id, 'failed', 0, (error as Error).message);
    });
  }

  private async runJob(project: IProject): Promise<void> {
    this.updateStatus(project.id, 'running', 0);

    const emit = (message: string, progress: number) => {
      this.gateway.emitProgress(project.id, message, progress);
      this.updateStatus(project.id, 'running', progress);
      this.logger.log(`[${project.id}] ${message}`);
    };

    try {
      // Step 1: Crawl — use the project's own saved settings
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
      );

      this.updatePageCount(project.id, pages.length);
      // Count actual screenshots taken
      const screenshotCount = pages.filter((p) => p.screenshotPath).length;
      this.updateCounts(project.id, pages.length, screenshotCount);

      // Step 2: Generate documentation
      emit('Generating AI documentation...', 85);
      const docs = await this.documentationService.generateProjectDocs(project, pages, emit);

      // Step 3: Persist docs
      emit('Saving documentation...', 95);
      await this.documentationService.persistDocs(project.id, docs);

      emit('Documentation complete!', 100);
      this.updateStatus(project.id, 'completed', 100);
    } catch (error) {
      const message = (error as Error).message;
      emit(`Error: ${message}`, -1);
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

  private updatePageCount(id: string, count: number): void {
    this.db.getDb().prepare('UPDATE projects SET page_count = ? WHERE id = ?').run(count, id);
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
