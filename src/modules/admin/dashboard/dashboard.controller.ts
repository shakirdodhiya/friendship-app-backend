import { Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { AdminController } from '../common/admin.decorators';
import { DashboardService } from './dashboard.service';
import { DashboardDto } from './dto/dashboard.dto';

@AdminController('dashboard', 'Dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Headline numbers and 30-day trends' })
  get(): Promise<DashboardDto> {
    return this.dashboard.get();
  }
}
