import { Controller, Get, Put, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { IsString } from 'class-validator';

class UpdateSettingDto {
  @IsString()
  value!: string;
}

@ApiTags('Settings')
@Controller('v1/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settings' })
  getAll(): Record<string, string> {
    return this.settingsService.getAll();
  }

  @Put(':key')
  @ApiOperation({ summary: 'Update a setting' })
  set(@Param('key') key: string, @Body() dto: UpdateSettingDto): void {
    this.settingsService.set(key, dto.value);
  }
}
