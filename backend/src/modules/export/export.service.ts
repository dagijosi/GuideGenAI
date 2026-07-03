import { Injectable, Logger } from '@nestjs/common';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DatabaseService } from '../../common/database/database.service';
import { DocumentationService } from '../documentation/documentation.service';
import { ExportException } from '../../common/exceptions/guidegen.exceptions';
import { ExportFormat } from '../../common/types';
import { ensureDir } from '../../common/utils/file.utils';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly documentationService: DocumentationService,
  ) {}

  async exportProject(projectId: string, format: ExportFormat): Promise<string> {
    const project = this.db.getDb()
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(projectId) as Record<string, unknown> | undefined;

    if (!project) throw new ExportException(`Project not found: ${projectId}`);

    const docsDir = join(project['storage_path'] as string, 'docs');
    const exportsDir = join(project['storage_path'] as string, 'exports');
    ensureDir(exportsDir);

    switch (format) {
      case 'markdown':
        return this.exportMarkdown(docsDir, exportsDir, projectId);
      case 'json':
        return this.exportJson(docsDir, exportsDir, projectId);
      case 'html':
        return this.exportHtml(docsDir, exportsDir, projectId);
      default:
        throw new ExportException(`Export format '${format}' is not yet implemented`);
    }
  }

  private exportMarkdown(docsDir: string, exportsDir: string, projectId: string): string {
    const srcPath = join(docsDir, 'documentation.md');
    if (!existsSync(srcPath)) throw new ExportException('Markdown documentation not found');
    const destPath = join(exportsDir, `${projectId}_documentation.md`);
    writeFileSync(destPath, readFileSync(srcPath));
    this.logger.log(`Exported markdown: ${destPath}`);
    return destPath;
  }

  private exportJson(docsDir: string, exportsDir: string, projectId: string): string {
    const srcPath = join(docsDir, 'documentation.json');
    if (!existsSync(srcPath)) throw new ExportException('JSON documentation not found');
    const destPath = join(exportsDir, `${projectId}_documentation.json`);
    writeFileSync(destPath, readFileSync(srcPath));
    this.logger.log(`Exported JSON: ${destPath}`);
    return destPath;
  }

  private exportHtml(docsDir: string, exportsDir: string, projectId: string): string {
    const mdPath = join(docsDir, 'documentation.md');
    if (!existsSync(mdPath)) throw new ExportException('Documentation not found');
    const mdContent = readFileSync(mdPath, 'utf-8');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GuideGen AI Documentation</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    h1, h2, h3, h4 { color: #1a1a2e; }
    code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; }
    blockquote { border-left: 4px solid #6366f1; margin: 0; padding-left: 1rem; color: #555; }
  </style>
</head>
<body>
<pre>${mdContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;

    const destPath = join(exportsDir, `${projectId}_documentation.html`);
    writeFileSync(destPath, html);
    this.logger.log(`Exported HTML: ${destPath}`);
    return destPath;
  }
}
