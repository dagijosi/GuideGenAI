import { Injectable, Logger } from '@nestjs/common';
import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { DatabaseService } from '../../common/database/database.service';

export interface ProjectFile {
  name: string;
  path: string;
  type: 'screenshot' | 'video' | 'document' | 'export' | 'other';
  size: number;
  createdAt: string;
}

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(private readonly db: DatabaseService) {}

  listProjectFiles(projectId: string): ProjectFile[] {
    const project = this.db.getDb()
      .prepare('SELECT storage_path FROM projects WHERE id = ?')
      .get(projectId) as { storage_path: string } | undefined;

    if (!project) return [];

    const files: ProjectFile[] = [];
    const dirs = ['screenshots', 'videos', 'docs', 'exports'];

    for (const dir of dirs) {
      const dirPath = join(project.storage_path, dir);
      if (!existsSync(dirPath)) continue;

      const entries = readdirSync(dirPath);
      for (const entry of entries) {
        const filePath = join(dirPath, entry);
        try {
          const stat = statSync(filePath);
          files.push({
            name: entry,
            path: filePath,
            type: this.resolveFileType(dir, entry),
            size: stat.size,
            createdAt: stat.birthtime.toISOString(),
          });
        } catch {
          // skip unreadable files
        }
      }
    }

    return files;
  }

  private resolveFileType(dir: string, filename: string): ProjectFile['type'] {
    if (dir === 'screenshots') return 'screenshot';
    if (dir === 'videos') return 'video';
    if (dir === 'docs') return 'document';
    if (dir === 'exports') return 'export';
    return 'other';
  }
}
