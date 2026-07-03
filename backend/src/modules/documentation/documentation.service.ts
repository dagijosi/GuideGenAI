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
  ): Promise<ProjectDocumentation> {
    onProgress?.('Generating page documentation with AI...', 86);

    const pageDocs: PageDocumentation[] = [];
    const total = pages.length;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      try {
        const doc = await this.aiService.generatePageDocumentation(page);
        doc.pageId = uuidv4();
        pageDocs.push(doc);
        onProgress?.(
          `Documented: ${page.title}`,
          86 + Math.round((i / total) * 6),
        );
      } catch (error) {
        this.logger.warn(`Failed to generate docs for ${page.title}: ${(error as Error).message}`);
      }
    }

    onProgress?.('Generating project overview...', 92);
    const overview = await this.aiService.generateProjectOverview(
      project.name,
      project.url,
      pages,
    );

    onProgress?.('Generating getting started guide...', 93);
    const gettingStarted = await this.aiService.generateGettingStarted(pages);

    onProgress?.('Generating FAQ...', 94);
    const faq = await this.aiService.generateFaq(pages);

    return {
      projectId: project.id,
      projectName: project.name,
      overview,
      gettingStarted,
      features: pages.flatMap((p) => p.buttons.map((b) => b.text)).slice(0, 20),
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
