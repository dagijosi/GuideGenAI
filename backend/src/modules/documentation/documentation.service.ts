import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { AiService } from '../ai/ai.service';
import { PageMetadata } from '../../common/interfaces/page-metadata.interface';
import {
  PageDocumentation,
  ProjectDocumentation,
} from '../../common/interfaces/documentation.interface';
import { IProject } from '../../common/interfaces/project.interface';
import { IWorkflow, WorkflowStep } from '../../common/interfaces/workflow.interface';
import { v4 as uuidv4 } from 'uuid';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ensureDir } from '../../common/utils/file.utils';

type ProgressCallback = (message: string, progress: number) => void;

@Injectable()
export class DocumentationService {
  private readonly logger = new Logger(DocumentationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly aiService: AiService,
  ) {}

  async generateProjectDocs(
    project: IProject,
    pages: PageMetadata[],
    onProgress?: ProgressCallback,
    signal?: AbortSignal,
  ): Promise<{ docs: ProjectDocumentation; workflows: IWorkflow[] }> {
    onProgress?.('Generating page documentation with AI...', 86);

    const pageDocs: PageDocumentation[] = [];
    const total = pages.length;

    for (let i = 0; i < pages.length; i++) {
      // Check for stop/cancel before each AI call
      if (signal?.aborted) {
        this.logger.log(`Documentation generation aborted after ${i}/${total} pages`);
        break;
      }

      const page = pages[i];
      const progressPct = 86 + Math.round(((i + 1) / total) * 6);
      onProgress?.(`Documenting page ${i + 1}/${total}: ${page.title}`, progressPct);

      try {
        const doc = await this.aiService.generatePageDocumentation(page);
        doc.pageId = uuidv4();
        pageDocs.push(doc);
        this.logger.log(`Documented [${i + 1}/${total}]: ${page.title}`);
      } catch (error) {
        // On timeout or AI failure, generate a minimal fallback doc so the job doesn't fail
        this.logger.warn(`AI doc failed for "${page.title}": ${(error as Error).message} — using fallback`);
        pageDocs.push(this.buildFallbackDoc(page));
      }
    }

    onProgress?.('Generating project overview...', 92);
    const overview = await this.generateWithFallback(
      () => signal?.aborted ? Promise.resolve('') : this.aiService.generateProjectOverview(project.name, project.url, pages),
      `${project.name} is a web application at ${project.url} with ${pages.length} pages including: ${pages.slice(0, 8).map((p) => p.title).join(', ')}.`,
      'project overview',
    );

    onProgress?.('Generating getting started guide...', 93);
    const gettingStarted = await this.generateWithFallback(
      () => signal?.aborted ? Promise.resolve('') : this.aiService.generateGettingStarted(pages),
      this.buildFallbackGettingStarted(pages),
      'getting started guide',
    );

    onProgress?.('Generating FAQ...', 94);
    const faq = await this.generateWithFallback(
      () => signal?.aborted ? Promise.resolve([]) : this.aiService.generateFaq(pages),
      [],
      'FAQ',
    );

    onProgress?.('Detecting workflows...', 95);
    const workflowPaths = signal?.aborted ? [] : await this.generateWithFallback(
      () => this.aiService.detectWorkflows(pages),
      this.buildFallbackWorkflows(pages),
      'workflows',
    );

    // Convert workflow paths to IWorkflow objects
    const pagesByTitle = new Map(pages.map(p => [p.title, p]));
    const workflows: IWorkflow[] = workflowPaths
      .filter(path => path.length >= 2)
      .map((path, idx) => {
        const steps: WorkflowStep[] = path.map((title, order) => {
          const page = pagesByTitle.get(title);
          return {
            order,
            pageTitle: title,
            url: page?.url ?? '',
            action: order === 0 ? 'Navigate to page' : 'Continue workflow',
            screenshotPath: page?.screenshotPath,
          };
        });
        return {
          id: uuidv4(),
          projectId: project.id,
          name: `Workflow ${idx + 1}: ${path[0]} → ${path[path.length - 1]}`,
          description: `User flow through ${path.join(' → ')}`,
          steps,
          createdAt: new Date().toISOString(),
        };
      });

    return {
      docs: {
        projectId: project.id,
        projectName: project.name,
        overview,
        gettingStarted,
        features: pages.flatMap((p) => p.buttons.map((b) => b.text)).filter(Boolean).slice(0, 30),
        pages: pageDocs,
        workflows: workflows.map(w => w.name),
        faq,
        troubleshooting: '',
        releaseNotes: '',
        developerGuide: '',
        glossary: {},
        generatedAt: new Date().toISOString(),
      },
      workflows,
    };
  }

  /**
   * Builds simple workflow paths from navigation structure when AI is unavailable.
   * Groups pages by their navigationPath prefix to find natural flows.
   */
  private buildFallbackWorkflows(pages: PageMetadata[]): string[][] {
    const workflows: string[][] = [];

    // Look for pages with multi-step navigation paths and group them
    const pathGroups = new Map<string, PageMetadata[]>();
    for (const page of pages) {
      if (page.navigationPath.length >= 2) {
        const root = page.navigationPath[0];
        if (!pathGroups.has(root)) pathGroups.set(root, []);
        pathGroups.get(root)!.push(page);
      }
    }

    for (const [, group] of pathGroups) {
      if (group.length >= 2) {
        workflows.push(group.slice(0, 4).map(p => p.title));
      }
      if (workflows.length >= 3) break;
    }

    return workflows;
  }

  /**
   * Runs an AI generation call and returns a fallback value if it times out or fails.
   * This prevents a single slow AI call from killing the entire documentation job.
   */
  private async generateWithFallback<T>(
    fn: () => Promise<T>,
    fallback: T,
    label: string,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.logger.warn(`AI ${label} failed: ${(error as Error).message} — using fallback`);
      return fallback;
    }
  }

  /**
   * Builds a minimal doc entry from raw metadata when AI times out.
   * Ensures every page still has useful documentation even without AI.
   */
  private buildFallbackDoc(page: PageMetadata): PageDocumentation {
    const actions = page.buttons.map((b) => b.text).filter(Boolean);
    const navLinks = page.navigationLinks.map((n) => n.text).filter(Boolean);
    const features: string[] = [
      ...actions.slice(0, 10).map((a) => `${a} button`),
      ...page.inputs.map((i) => `${i.label || i.placeholder || i.type} input field`).slice(0, 5),
      ...(page.tables.length > 0 ? [`Data table with columns: ${page.tables[0].headers.join(', ')}`] : []),
      ...(page.searchFields.length > 0 ? ['Search functionality'] : []),
      ...(page.pagination ? ['Pagination'] : []),
    ];

    return {
      pageId: uuidv4(),
      url: page.url,
      title: page.title,
      overview: `The ${page.title} page${page.breadcrumbs.length > 0 ? ` (${page.breadcrumbs.join(' > ')})` : ''} provides access to the following features.`,
      features: features.length > 0 ? features : ['Page content'],
      userGuide: [
        `Navigate to this page via: ${page.url}`,
        actions.length > 0 ? `Available actions: ${actions.slice(0, 8).join(', ')}` : '',
        navLinks.length > 0 ? `Navigation links: ${navLinks.slice(0, 8).join(', ')}` : '',
        page.tables.length > 0 ? `Contains data tables: ${page.tables.map((t) => t.headers.join(', ')).join('; ')}` : '',
      ].filter(Boolean).join('\n'),
      tips: [],
      warnings: [],
      faq: [],
      testCases: [],
      releaseNotes: '',
      developerNotes: undefined,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Minimal getting started guide built from raw metadata — used when AI times out.
   */
  private buildFallbackGettingStarted(pages: PageMetadata[]): string {
    const lines: string[] = [
      '## Getting Started',
      '',
      'This guide will help you navigate the application.',
      '',
      '### Available Pages',
      '',
    ];

    for (const page of pages) {
      lines.push(`**${page.title}** — ${page.url}`);
      const actions = page.buttons.map((b) => b.text).filter(Boolean).slice(0, 5);
      if (actions.length > 0) {
        lines.push(`Available actions: ${actions.join(', ')}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  async persistDocs(projectId: string, docs: ProjectDocumentation, workflows?: IWorkflow[]): Promise<void> {
    const project = this.db.getDb().prepare('SELECT storage_path FROM projects WHERE id = ?').get(projectId) as { storage_path: string } | undefined;
    if (!project) return;

    const docsDir = join(project.storage_path, 'docs');
    ensureDir(docsDir);

    // Save JSON
    writeFileSync(join(docsDir, 'documentation.json'), JSON.stringify(docs, null, 2));

    // Save Markdown
    const markdown = this.buildMarkdown(docs);
    writeFileSync(join(docsDir, 'documentation.md'), markdown);

    const now = new Date().toISOString();

    // Persist documentation rows
    const stmt = this.db.getDb().prepare(`
      INSERT INTO documentation (id, project_id, page_id, type, content, generated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(uuidv4(), projectId, null, 'project', JSON.stringify(docs), now);

    for (const page of docs.pages) {
      stmt.run(uuidv4(), projectId, page.pageId, 'page', JSON.stringify(page), now);
    }

    // Persist workflows to the workflows table
    if (workflows && workflows.length > 0) {
      const wfStmt = this.db.getDb().prepare(`
        INSERT INTO workflows (id, project_id, name, description, steps, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const wf of workflows) {
        wfStmt.run(wf.id, projectId, wf.name, wf.description, JSON.stringify(wf.steps), wf.createdAt);
      }
      // Update workflow_count on the project row
      this.db.getDb().prepare('UPDATE projects SET workflow_count = ? WHERE id = ?')
        .run(workflows.length, projectId);
      this.logger.log(`Persisted ${workflows.length} workflow(s) for project: ${projectId}`);
    }

    this.logger.log(`Documentation persisted for project: ${projectId}`);
  }

  async getProjectDocs(projectId: string): Promise<ProjectDocumentation | null> {
    const row = this.db.getDb().prepare(
      "SELECT content FROM documentation WHERE project_id = ? AND type = 'project' ORDER BY generated_at DESC LIMIT 1",
    ).get(projectId) as { content: string } | undefined;

    if (!row) return null;
    return JSON.parse(row.content) as ProjectDocumentation;
  }

  async getProjectWorkflows(projectId: string): Promise<IWorkflow[]> {
    const rows = this.db.getDb()
      .prepare('SELECT * FROM workflows WHERE project_id = ? ORDER BY created_at ASC')
      .all(projectId) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: row['id'] as string,
      projectId: row['project_id'] as string,
      name: row['name'] as string,
      description: row['description'] as string,
      steps: JSON.parse(row['steps'] as string) as IWorkflow['steps'],
      videoPath: row['video_path'] as string | undefined,
      createdAt: row['created_at'] as string,
    }));
  }

  async getProjectDocsSummary(projectId: string): Promise<{ pageCount: number; generatedAt: string } | null> {
    const row = this.db.getDb().prepare(
      "SELECT content FROM documentation WHERE project_id = ? AND type = 'project' ORDER BY generated_at DESC LIMIT 1",
    ).get(projectId) as { content: string } | undefined;

    if (!row) return null;
    const docs = JSON.parse(row.content) as ProjectDocumentation;
    return { pageCount: docs.pages.length, generatedAt: docs.generatedAt };
  }

  private buildMarkdown(docs: ProjectDocumentation): string {
    const lines: string[] = [
      `# ${docs.projectName}`,
      '',
      '## Overview',
      docs.overview,
      '',
      '## Getting Started',
      docs.gettingStarted,
      '',
      '## Pages',
      '',
    ];

    for (const page of docs.pages) {
      lines.push(`### ${page.title}`);
      lines.push(`**URL:** ${page.url}`);
      lines.push('');
      lines.push('#### Overview');
      lines.push(page.overview);
      lines.push('');
      if (page.features.length > 0) {
        lines.push('#### Features');
        page.features.forEach((f) => lines.push(`- ${f}`));
        lines.push('');
      }
      lines.push('#### User Guide');
      lines.push(page.userGuide);
      lines.push('');
      if (page.tips.length > 0) {
        lines.push('#### Tips');
        page.tips.forEach((t) => lines.push(`> ${t}`));
        lines.push('');
      }
      if (page.warnings.length > 0) {
        lines.push('#### Warnings');
        page.warnings.forEach((w) => lines.push(`⚠️ ${w}`));
        lines.push('');
      }
    }

    if (docs.faq.length > 0) {
      lines.push('## FAQ');
      lines.push('');
      docs.faq.forEach((item) => {
        lines.push(`**Q: ${item.question}**`);
        lines.push(`A: ${item.answer}`);
        lines.push('');
      });
    }

    return lines.join('\n');
  }
}
