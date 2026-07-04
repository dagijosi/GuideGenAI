const API_BASE = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000';

export function screenshotFilename(path?: string): string | null {
  if (!path) return null;
  return path.split(/[/\\]/).pop() ?? null;
}

export function getScreenshotUrl(projectId: string, screenshotPath?: string): string | null {
  const filename = screenshotFilename(screenshotPath);
  if (!filename) return null;
  return `${API_BASE}/v1/files/screenshot/${projectId}/${encodeURIComponent(filename)}`;
}
