import { Body, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { AdminController, CurrentAdmin } from '../common/admin.decorators';
import type { AdminPrincipal } from '../common/types';
import { ReportDto, ReportPageDto, ReportsQueryDto, ResolveReportDto } from './dto/reports.dto';
import { ReportsService } from './reports.service';

@AdminController('reports', 'Reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'User reports', description: 'Defaults to open reports, newest first.' })
  list(@Query() query: ReportsQueryDto): Promise<ReportPageDto> {
    return this.reports.list(query);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve, dismiss or reopen a report, optionally suspending the reported user' })
  resolve(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReportDto,
  ): Promise<ReportDto> {
    return this.reports.resolve(admin, id, dto);
  }
}
