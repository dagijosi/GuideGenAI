import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DocumentationService } from './documentation.service';
import { ProjectDocumentation } from '../../common/interfaces/documentation.interface';
import { IWorkflow } from '../../common/interfaces/workflow.interface';

@ApiTags('Documentation')
@Controller('v1/documentation')
export class DocumentationController {
  constructor(private readonly documentationService: DocumentationService) {}

  @Get(':projectId')
  @ApiOperation({ summary: 'Get project documentation' })
  async getProjectDocs(
    @Param('projectId') projectId: string,
  ): Promise<ProjectDocumentation> {
    const docs = await this.documentationService.getProjectDocs(projectId);
    if (!docs) throw new NotFoundException(`No documentation found for project: ${projectId}`);
    return docs;
  }

  @Get(':projectId/summary')
  @ApiOperation({ summary: 'Get documentation summary (page count, date)' })
  async getSummary(@Param('projectId') projectId: string) {
    return this.documentationService.getProjectDocsSummary(projectId);
  }

  @Get(':projectId/workflows')
  @ApiOperation({ summary: 'Get detected workflows for a project' })
  async getWorkflows(
    @Param('projectId') projectId: string,
  ): Promise<IWorkflow[]> {
    return this.documentationService.getProjectWorkflows(projectId);
  }
}
