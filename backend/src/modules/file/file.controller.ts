import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { FileService, ProjectFile } from './file.service';
import { existsSync } from 'fs';
import { resolve } from 'path';

@ApiTags('Files')
@Controller('v1/files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get(':projectId')
  @ApiOperation({ summary: 'List files for a project' })
  listFiles(@Param('projectId') projectId: string): ProjectFile[] {
    return this.fileService.listProjectFiles(projectId);
  }

  @Get(':projectId/screenshots')
  @ApiOperation({ summary: 'List screenshots for a project' })
  listScreenshots(@Param('projectId') projectId: string): ProjectFile[] {
    return this.fileService
      .listProjectFiles(projectId)
      .filter((f) => f.type === 'screenshot');
  }

  @Get('screenshot/:projectId/:filename')
  @ApiOperation({ summary: 'Serve a screenshot image' })
  serveScreenshot(
    @Param('projectId') projectId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ): void {
    const file = this.fileService
      .listProjectFiles(projectId)
      .find((f) => f.type === 'screenshot' && f.name === filename);

    if (!file) {
      throw new NotFoundException('Screenshot not found');
    }

    // resolve() ensures absolute path — required by Express sendFile
    const absPath = resolve(file.path);

    if (!existsSync(absPath)) {
      throw new NotFoundException('Screenshot file missing from disk');
    }

    res.sendFile(absPath, (err) => {
      if (err) {
        res.status(500).json({ message: 'Failed to serve screenshot' });
      }
    });
  }
}
