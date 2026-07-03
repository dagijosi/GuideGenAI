import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export function buildProjectPath(storagePath: string, projectId: string): string {
  return join(storagePath, 'projects', projectId);
}

export function buildScreenshotPath(projectPath: string, slug: string): string {
  return join(projectPath, 'screenshots', `${slug}.png`);
}

export function buildVideoPath(projectPath: string, name: string): string {
  return join(projectPath, 'videos', `${name}.webm`);
}

export function buildDocsPath(projectPath: string): string {
  return join(projectPath, 'docs');
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}
