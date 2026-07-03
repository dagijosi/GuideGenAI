import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { VideoService, VideoRecord } from './video.service';

@ApiTags('Video')
@Controller('v1/videos')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get(':projectId')
  @ApiOperation({ summary: 'List videos for a project' })
  async listVideos(@Param('projectId') projectId: string): Promise<VideoRecord[]> {
    return this.videoService.listProjectVideos(projectId);
  }
}
