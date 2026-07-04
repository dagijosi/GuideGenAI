import {
  Controller, Get, Post, Param, Body,
  NotFoundException, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { DocumentationService } from './documentation.service';
import { ProjectService } from '../project/project.service';
import { ProjectDocumentation, DocGenerationMode } from '../../common/interfaces/documentation.interface';
import { IWorkflow } from '../../common/interfaces/workflow.interface';

import { IsString, IsNotEmpty } from 'class-validator';

class WorkflowDocRequestDto {
  @IsString()
  @IsNotEmpty()
  workflowName: string;
}

@ApiTags('Documentation')
@Controller('v1/documentation')
export class DocumentationController {
  constructor(
    private readonly documentationService: DocumentationService,
    private readonly projectService: ProjectService,
  ) {}

  @Get(':projectId')
  @ApiOperation({ summary: 'Get project documentation' })
  async getProjectDocs(@Param('projectId') projectId: string): Promise<ProjectDocumentation> {
    const docs = await this.documentationService.getProjectDocs(projectId);
    if (!docs) throw new NotFoundException(`No documentation found for project: ${projectId}`);
    return docs;
  }

  @Get(':projectId/summary')
  @ApiOperation({ summary: 'Get documentation summary (page count, date, mode)' })
  async getSummary(@Param('projectId') projectId: string) {
    return this.documentationService.getProjectDocsSummary(projectId);
  }

  @Get(':projectId/workflows')
  @ApiOperation({ summary: 'Get detected workflows for a project' })
  async getWorkflows(@Param('projectId') projectId: string): Promise<IWorkflow[]> {
    return this.documentationService.getProjectWorkflows(projectId);
  }

  @Post(':projectId/generate/overview')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Quick overview mode — ~2 AI calls, no per-page docs',
    description: 'Generates a high-level application overview using the app map only. Fast — use this for a first look at a large site.',
  })
  async generateOverview(
    @Param('projectId') projectId: string,
  ): Promise<{ mode: DocGenerationMode; message: string }> {
    await this.projectService.startScopedDocJob(projectId, { mode: 'overview' });
    return { mode: 'overview', message: 'Overview generation started' };
  }

  @Post(':projectId/generate/workflow')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Workflow deep-dive — full docs for one workflow + continuous guide',
    description: 'Generates complete per-page documentation only for pages in the named workflow (with template dedup). Produces one end-to-end walkthrough guide.',
  })
  @ApiBody({ type: WorkflowDocRequestDto })
  async generateWorkflow(
    @Param('projectId') projectId: string,
    @Body() body: WorkflowDocRequestDto,
  ): Promise<{ mode: DocGenerationMode; message: string }> {
    await this.projectService.startScopedDocJob(projectId, {
      mode: 'workflow',
      workflowName: body.workflowName,
    });
    return { mode: 'workflow', message: 'Workflow documentation generation started' };
  }

  @Post(':projectId/generate/full')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Full documentation mode — all pages with template deduplication',
    description: 'Generates complete documentation for every unique page template. Duplicate pages (same layout, different data) share one AI-generated doc.',
  })
  async generateFull(
    @Param('projectId') projectId: string,
  ): Promise<{ mode: DocGenerationMode; message: string }> {
    await this.projectService.startScopedDocJob(projectId, { mode: 'full' });
    return { mode: 'full', message: 'Full documentation generation started' };
  }
}
