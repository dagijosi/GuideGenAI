import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { AiService } from '../ai/ai.service';
import { PageMetadata } from '../../common/interfaces/page-metadata.interface';
import {
  PageDocumentation,
  ProjectDocumentation,
} from '../../common/interfaces/documentation.interface';
import { IProject } from '../../common/interfaces/project.interface';
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
  ): Promise<ProjectDocumentation> {
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

    return {
      projectId: project.id,
      projectName: project.name,
      overview,
      gettingStarted,
      features: pages.flatMap((p) => p.buttons.map((b) => b.text)).filter(Boolean).slice(0, 30),
      pages: pageDocs,
      workflows: [],
      faq,
      troubleshooting: '',
      releaseNotes: '',
      developerGuide: '',
      glossary: {},
      generatedAt: new Date().toISOString(),
    };
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

  async persistDocs(projectId: string, docs: ProjectDocumentation): Promise<void> {
    const project = this.db.getDb().prepare('SELECT storage_path FROM projects WHERE id = ?').get(projectId) as { storage_path: string } | undefined;
    if (!project) return;

    const docsDir = join(project.storage_path, 'docs');
    ensureDir(docsDir);

    // Save JSON
    writeFileSync(join(docsDir, 'documentation.json'), JSON.stringify(docs, null, 2));

    // Save Markdown
    const markdown = this.buildMarkdown(docs);
    writeFileSync(join(docsDir, 'documentation.md'), markdown);

    // Persist to DB
    const now = new Date().toISOString();
    const stmt = this.db.getDb().prepare(`
      INSERT INTO documentation (id, project_id, page_id, type, content, generated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(uuidv4(), projectId, null, 'project', JSON.stringify(docs), now);

    for (const page of docs.pages) {
      stmt.run(uuidv4(), projectId, page.pageId, 'page', JSON.stringify(page), now);
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
