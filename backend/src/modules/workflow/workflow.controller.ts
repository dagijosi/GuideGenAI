import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WorkflowService } from './workflow.service';
import { IWorkflow } from '../../common/interfaces/workflow.interface';

@ApiTags('Workflows')
@Controller('v1/workflows')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get(':projectId')
  @ApiOperation({ summary: 'Get workflows for a project' })
  async getWorkflows(@Param('projectId') projectId: string): Promise<IWorkflow[]> {
    return this.workflowService.getProjectWorkflows(projectId);
  }
}
