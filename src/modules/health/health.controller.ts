import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';

import { Public } from '../../common/decorators/public.decorator';
import { DB, type Database } from '../../database/database.module';

class HealthDto {
  status: 'ok';
  database: 'up';
  uptimeSeconds: number;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness + database check for load balancers' })
  async check(): Promise<HealthDto> {
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      throw new ServiceUnavailableException('Database unreachable');
    }
    return { status: 'ok', database: 'up', uptimeSeconds: Math.round(process.uptime()) };
  }
}
