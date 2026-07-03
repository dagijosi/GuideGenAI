import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';

export interface VideoRecord {
  id: string;
  projectId: string;
  name: string;
  path: string;
  type: 'navigation' | 'workflow' | 'feature' | 'training';
  createdAt: string;
}

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(private readonly db: DatabaseService) {}

  async listProjectVideos(projectId: string): Promise<VideoRecord[]> {
    // TODO: Integrate Playwright video recording
    // Playwright supports: context = await browser.newContext({ recordVideo: { dir: '...' } })
    this.logger.log(`Listing videos for project: ${projectId}`);
    return [];
  }
}
