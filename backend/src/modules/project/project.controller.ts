import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { StartProjectDto } from './dto/start-project.dto';
import { IProject } from '../../common/interfaces/project.interface';

@ApiTags('Projects')
@Controller('v1/projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @ApiOperation({ summary: 'List all projects' })
  async findAll(): Promise<IProject[]> {
    return this.projectService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project created' })
  async create(@Body() dto: CreateProjectDto): Promise<IProject> {
    return this.projectService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  async findOne(@Param('id') id: string): Promise<IProject> {
    return this.projectService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project name, URL or credentials' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<IProject> {
    return this.projectService.update(id, dto);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start documentation job for project' })
  async start(
    @Param('id') id: string,
    @Body() dto: StartProjectDto = {},
  ): Promise<{ message: string }> {
    await this.projectService.startJob(id, dto);
    return { message: 'Job started' };
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Stop the running job — saves progress, marks as paused' })
  async stop(@Param('id') id: string): Promise<{ message: string }> {
    await this.projectService.stopJob(id);
    return { message: 'Job stop requested' };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Cancel the running job immediately — discards progress' })
  async cancel(@Param('id') id: string): Promise<{ message: string }> {
    await this.projectService.cancelJob(id);
    return { message: 'Job cancel requested' };
  }

  @Post(':id/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset project results so it can run again' })
  async reset(@Param('id') id: string): Promise<IProject> {
    return this.projectService.reset(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete project' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.projectService.delete(id);
  }
}
